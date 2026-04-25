import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateTimeOffRequestDto } from '../time-off/dto/create-time-off-request.dto';
import { MockHcmBalance } from './entities/mock-hcm-balance.entity';

interface FailureConfig {
  mode: 'reject' | 'service_unavailable';
  remainingTimes: number;
}

interface FileTimeOffResult {
  accepted: boolean;
  referenceId?: string;
  reason?: string;
}

@Injectable()
export class HcmMockService {
  private readonly validationFailures = new Map<string, FailureConfig>();
  private readonly filingFailures = new Map<string, FailureConfig>();
  private readonly lenientFilingKeys = new Set<string>();

  constructor(
    @InjectRepository(MockHcmBalance)
    private readonly mockBalanceRepository: Repository<MockHcmBalance>,
  ) {}

  async getBalances(filters: {
    employeeId?: string;
    locationId?: string;
    leaveType?: string;
  }): Promise<MockHcmBalance[]> {
    const query = this.mockBalanceRepository.createQueryBuilder('balance');

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

    if (filters.leaveType) {
      query.andWhere('balance.leaveType = :leaveType', {
        leaveType: filters.leaveType,
      });
    }

    return query
      .orderBy('balance.employeeId', 'ASC')
      .addOrderBy('balance.locationId', 'ASC')
      .addOrderBy('balance.leaveType', 'ASC')
      .getMany();
  }

  async validateTimeOff(
    payload: CreateTimeOffRequestDto,
  ): Promise<{ accepted: boolean; reason?: string; availableDays?: number }> {
    this.maybeApplyFailure(this.validationFailures, payload, 'validation');

    const balance = await this.findBalance(payload);
    if (!balance) {
      return {
        accepted: false,
        reason: 'Unknown employee/location/leaveType combination in HCM.',
      };
    }

    if (balance.availableDays < payload.requestedDays) {
      return {
        accepted: false,
        reason: 'HCM reports insufficient balance.',
        availableDays: balance.availableDays,
      };
    }

    return { accepted: true, availableDays: balance.availableDays };
  }

  async fileTimeOff(payload: CreateTimeOffRequestDto): Promise<FileTimeOffResult> {
    this.maybeApplyFailure(this.filingFailures, payload, 'filing');

    const balance = await this.findBalance(payload);
    if (!balance) {
      return {
        accepted: false,
        reason: 'Unknown employee/location/leaveType combination in HCM.',
      };
    }

    const lenientFiling = this.lenientFilingKeys.has(this.getKey(payload));
    if (!lenientFiling && balance.availableDays < payload.requestedDays) {
      return {
        accepted: false,
        reason: 'HCM rejected filing because balance is insufficient.',
      };
    }

    balance.availableDays -= payload.requestedDays;
    balance.version += 1;
    await this.mockBalanceRepository.save(balance);

    return {
      accepted: true,
      referenceId: `HCM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }

  async batchBalances(): Promise<MockHcmBalance[]> {
    return this.mockBalanceRepository.find({
      order: {
        employeeId: 'ASC',
        locationId: 'ASC',
        leaveType: 'ASC',
      },
    });
  }

  async simulateAnniversaryBonus(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
    bonusDays: number;
  }): Promise<MockHcmBalance> {
    const balance = await this.requireBalance(payload);
    balance.availableDays += payload.bonusDays;
    balance.version += 1;
    return this.mockBalanceRepository.save(balance);
  }

  async simulateBalanceReset(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
    availableDays?: number;
  }): Promise<MockHcmBalance> {
    const balance = await this.requireBalance(payload);
    balance.availableDays = payload.availableDays ?? 0;
    balance.version += 1;
    return this.mockBalanceRepository.save(balance);
  }

  setValidationFailure(
    payload: { employeeId: string; locationId: string; leaveType: string },
    mode: FailureConfig['mode'],
    remainingTimes = 1,
  ): void {
    this.validationFailures.set(this.getKey(payload), { mode, remainingTimes });
  }

  setFilingFailure(
    payload: { employeeId: string; locationId: string; leaveType: string },
    mode: FailureConfig['mode'],
    remainingTimes = 1,
  ): void {
    this.filingFailures.set(this.getKey(payload), { mode, remainingTimes });
  }

  setLenientFilingMode(
    payload: { employeeId: string; locationId: string; leaveType: string },
    enabled: boolean,
  ): void {
    const key = this.getKey(payload);
    if (enabled) {
      this.lenientFilingKeys.add(key);
      return;
    }

    this.lenientFilingKeys.delete(key);
  }

  private async requireBalance(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
  }): Promise<MockHcmBalance> {
    const balance = await this.findBalance(payload);

    if (!balance) {
      throw new NotFoundException({
        error: 'MockHcmBalanceNotFound',
        message: 'Mock HCM balance was not found for the provided dimensions.',
      });
    }

    return balance;
  }

  private async findBalance(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
  }): Promise<MockHcmBalance | null> {
    return this.mockBalanceRepository.findOne({
      where: {
        employeeId: payload.employeeId,
        locationId: payload.locationId,
        leaveType: payload.leaveType,
      },
    });
  }

  private maybeApplyFailure(
    store: Map<string, FailureConfig>,
    payload: { employeeId: string; locationId: string; leaveType: string },
    operation: 'validation' | 'filing',
  ): void {
    const key = this.getKey(payload);
    const failure = store.get(key);

    if (!failure) {
      return;
    }

    failure.remainingTimes -= 1;
    if (failure.remainingTimes <= 0) {
      store.delete(key);
    } else {
      store.set(key, failure);
    }

    if (failure.mode === 'reject') {
      throw new ConflictException({
        error: 'MockHcmRejected',
        message: `Mock HCM rejected ${operation} for the provided dimensions.`,
      });
    }

    if (operation === 'validation') {
      throw new ServiceUnavailableException({
        error: 'MockHcmUnavailable',
        message: 'Mock HCM validation is temporarily unavailable.',
      });
    }

    throw new BadGatewayException({
      error: 'MockHcmUnavailable',
      message: 'Mock HCM filing failed before a stable response was returned.',
    });
  }

  private getKey(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
  }): string {
    return `${payload.employeeId}::${payload.locationId}::${payload.leaveType}`;
  }
}
