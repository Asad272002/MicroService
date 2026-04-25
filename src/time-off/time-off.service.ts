import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { HcmMockService } from '../hcm-mock/hcm-mock.service';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { RejectTimeOffRequestDto } from './dto/reject-time-off-request.dto';
import { Balance } from './entities/balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import {
  assertStatusForApproval,
  assertStatusForCancellation,
  assertStatusForRejection,
  finalizeApprovedDays,
  hasSufficientLocalBalance,
  releaseReservedDays,
  reserveDays,
  validateRequestedDaysWithinRange,
} from './time-off.domain';
import { TimeOffRequestStatus } from './time-off-request-status.enum';

@Injectable()
export class TimeOffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hcmMockService: HcmMockService,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  async getBalances(filters: {
    employeeId?: string;
    locationId?: string;
  }): Promise<Balance[]> {
    const query = this.balanceRepository.createQueryBuilder('balance');

    if (filters.employeeId) {
      query.andWhere('balance.employeeId = :employeeId', {
        employeeId: filters.employeeId,
      });
    }

    if (filters.locationId) {
      query.andWhere('balance.locationId = :locationId', {
        locationId: filters.locationId,
      });
    }

    return query
      .orderBy('balance.employeeId', 'ASC')
      .addOrderBy('balance.locationId', 'ASC')
      .addOrderBy('balance.leaveType', 'ASC')
      .getMany();
  }

  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId, leaveType },
    });

    if (!balance) {
      throw new NotFoundException({
        error: 'BalanceNotFound',
        message: 'Balance was not found for the provided dimensions.',
      });
    }

    return balance;
  }

  async createRequest(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    this.validateDimensions(dto);

    try {
      validateRequestedDaysWithinRange(
        dto.startDate,
        dto.endDate,
        dto.requestedDays,
      );
    } catch (error) {
      throw new BadRequestException({
        error: 'InvalidDateRange',
        message: error instanceof Error ? error.message : 'Invalid date range.',
      });
    }

    const localBalance = await this.balanceRepository.findOne({
      where: {
        employeeId: dto.employeeId,
        locationId: dto.locationId,
        leaveType: dto.leaveType,
      },
    });

    if (!localBalance) {
      throw new NotFoundException({
        error: 'BalanceNotFound',
        message: 'Local balance cache was not found for the provided dimensions.',
      });
    }

    if (!hasSufficientLocalBalance(localBalance, dto.requestedDays)) {
      throw new ConflictException({
        error: 'InsufficientBalance',
        message: 'Local balance cache indicates insufficient available days.',
      });
    }

    const hcmValidation = await this.safeValidateWithHcm(dto);
    if (!hcmValidation.accepted) {
      throw new ConflictException({
        error: 'HcmRejected',
        message: hcmValidation.reason ?? 'HCM rejected the request.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const currentBalance = await manager.findOne(Balance, {
        where: {
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          leaveType: dto.leaveType,
        },
      });

      if (!currentBalance) {
        throw new NotFoundException({
          error: 'BalanceNotFound',
          message: 'Local balance cache was not found for the provided dimensions.',
        });
      }

      if (!hasSufficientLocalBalance(currentBalance, dto.requestedDays)) {
        throw new ConflictException({
          error: 'InsufficientBalance',
          message:
            'Reserved balance changed before the request could be created.',
        });
      }

      const updatedBalance = reserveDays(currentBalance, dto.requestedDays);
      await manager.save(Balance, updatedBalance);

      const request = manager.create(TimeOffRequest, {
        ...dto,
        status: TimeOffRequestStatus.PENDING,
        hcmReferenceId: null,
        rejectionReason: null,
      });
      return manager.save(TimeOffRequest, request);
    });
  }

  async getRequests(): Promise<TimeOffRequest[]> {
    return this.requestRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getRequest(id: string): Promise<TimeOffRequest> {
    return this.requireRequest(id);
  }

  async approveRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requireRequest(id);

    try {
      assertStatusForApproval(request.status);
    } catch (error) {
      throw new ConflictException({
        error: 'InvalidStateTransition',
        message: error instanceof Error ? error.message : 'Invalid status.',
      });
    }

    const filingResult = await this.safeFileWithHcm(request);

    return this.dataSource.transaction(async (manager) => {
      const currentRequest = await manager.findOne(TimeOffRequest, {
        where: { id },
      });
      if (!currentRequest) {
        throw new NotFoundException({
          error: 'TimeOffRequestNotFound',
          message: 'Time-off request was not found.',
        });
      }

      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: currentRequest.employeeId,
          locationId: currentRequest.locationId,
          leaveType: currentRequest.leaveType,
        },
      });
      if (!balance) {
        throw new NotFoundException({
          error: 'BalanceNotFound',
          message: 'Balance was not found for the provided dimensions.',
        });
      }

      if (!filingResult.accepted) {
        currentRequest.status = TimeOffRequestStatus.REJECTED;
        currentRequest.rejectionReason =
          filingResult.reason ?? 'HCM rejected the filing request.';
        const released = releaseReservedDays(balance, currentRequest.requestedDays);
        await manager.save(Balance, released);
        return manager.save(TimeOffRequest, currentRequest);
      }

      const finalized = finalizeApprovedDays(balance, currentRequest.requestedDays);
      await manager.save(Balance, finalized);

      currentRequest.status = TimeOffRequestStatus.APPROVED;
      currentRequest.hcmReferenceId = filingResult.referenceId ?? null;
      currentRequest.rejectionReason = null;

      return manager.save(TimeOffRequest, currentRequest);
    });
  }

  async rejectRequest(
    id: string,
    dto: RejectTimeOffRequestDto,
  ): Promise<TimeOffRequest> {
    const request = await this.requireRequest(id);

    try {
      assertStatusForRejection(request.status);
    } catch (error) {
      throw new ConflictException({
        error: 'InvalidStateTransition',
        message: error instanceof Error ? error.message : 'Invalid status.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const currentRequest = await manager.findOne(TimeOffRequest, {
        where: { id },
      });
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveType: request.leaveType,
        },
      });

      if (!currentRequest || !balance) {
        throw new NotFoundException({
          error: 'RequestOrBalanceNotFound',
          message: 'Request or balance was not found while rejecting request.',
        });
      }

      currentRequest.status = TimeOffRequestStatus.REJECTED;
      currentRequest.rejectionReason = dto.rejectionReason;
      const released = releaseReservedDays(balance, currentRequest.requestedDays);
      await manager.save(Balance, released);
      return manager.save(TimeOffRequest, currentRequest);
    });
  }

  async cancelRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requireRequest(id);

    try {
      assertStatusForCancellation(request.status);
    } catch (error) {
      throw new ConflictException({
        error: 'InvalidStateTransition',
        message: error instanceof Error ? error.message : 'Invalid status.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const currentRequest = await manager.findOne(TimeOffRequest, {
        where: { id },
      });
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveType: request.leaveType,
        },
      });

      if (!currentRequest || !balance) {
        throw new NotFoundException({
          error: 'RequestOrBalanceNotFound',
          message: 'Request or balance was not found while cancelling request.',
        });
      }

      currentRequest.status = TimeOffRequestStatus.CANCELLED;
      currentRequest.rejectionReason = 'Cancelled by employee.';
      const released = releaseReservedDays(balance, currentRequest.requestedDays);
      await manager.save(Balance, released);
      return manager.save(TimeOffRequest, currentRequest);
    });
  }

  private validateDimensions(dto: CreateTimeOffRequestDto): void {
    if (
      !dto.employeeId.trim() ||
      !dto.locationId.trim() ||
      !dto.leaveType.trim() ||
      dto.requestedDays <= 0
    ) {
      throw new BadRequestException({
        error: 'InvalidDimensions',
        message: 'employeeId, locationId, leaveType, and requestedDays are required.',
      });
    }
  }

  private async safeValidateWithHcm(
    dto: CreateTimeOffRequestDto,
  ): Promise<{ accepted: boolean; reason?: string; availableDays?: number }> {
    try {
      return await this.hcmMockService.validateTimeOff(dto);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new BadGatewayException({
        error: 'HcmValidationFailed',
        message: 'HCM validation failed before a stable response was returned.',
      });
    }
  }

  private async safeFileWithHcm(
    request: TimeOffRequest,
  ): Promise<{ accepted: boolean; referenceId?: string; reason?: string }> {
    try {
      const response = await this.hcmMockService.fileTimeOff({
        employeeId: request.employeeId,
        locationId: request.locationId,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        requestedDays: request.requestedDays,
      });

      if (!response.accepted) {
        return response;
      }

      const balance = await this.getBalance(
        request.employeeId,
        request.locationId,
        request.leaveType,
      );
      if (balance.availableDays < request.requestedDays) {
        return {
          accepted: false,
          reason:
            'Defensive rejection: local cache no longer supports approval after HCM filing.',
        };
      }

      return response;
    } catch (error) {
      await this.markNeedsReview(request.id, error);
      throw error;
    }
  }

  private async markNeedsReview(id: string, error: unknown): Promise<void> {
    await this.requestRepository.update(id, {
      status: TimeOffRequestStatus.NEEDS_REVIEW,
      rejectionReason:
        error instanceof Error
          ? error.message
          : 'HCM communication failed and request needs review.',
    });
  }

  private async requireRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException({
        error: 'TimeOffRequestNotFound',
        message: 'Time-off request was not found.',
      });
    }

    return request;
  }
}
