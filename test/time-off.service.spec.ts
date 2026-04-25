import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { HcmMockService } from '../src/hcm-mock/hcm-mock.service';
import { Balance } from '../src/time-off/entities/balance.entity';
import { TimeOffRequest } from '../src/time-off/entities/time-off-request.entity';
import { TimeOffService } from '../src/time-off/time-off.service';
import { TimeOffRequestStatus } from '../src/time-off/time-off-request-status.enum';

function createService() {
  const dataSource = {
    transaction: jest.fn(),
  } as unknown as DataSource;

  const hcmMockService = {
    validateTimeOff: jest.fn(),
    fileTimeOff: jest.fn(),
  } as unknown as HcmMockService;

  const requestRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  } as unknown as Repository<TimeOffRequest>;

  const balanceRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<Balance>;

  return {
    service: new TimeOffService(
      dataSource,
      hcmMockService,
      requestRepository,
      balanceRepository,
    ),
    dataSource,
    hcmMockService,
    requestRepository,
    balanceRepository,
  };
}

describe('TimeOffService', () => {
  it('rejects invalid dimensions before any repository work', async () => {
    const { service, balanceRepository } = createService();

    await expect(
      service.createRequest({
        employeeId: '',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(balanceRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects requests when local balance is insufficient', async () => {
    const { service, balanceRepository } = createService();
    jest.mocked(balanceRepository.findOne).mockResolvedValue({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 2,
      reservedDays: 1,
      version: 1,
    } as Balance);

    await expect(
      service.createRequest({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('surfaces HCM validation unavailability during request creation', async () => {
    const { service, balanceRepository, hcmMockService } = createService();
    jest.mocked(balanceRepository.findOne).mockResolvedValue({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 10,
      reservedDays: 0,
      version: 1,
    } as Balance);
    jest
      .mocked(hcmMockService.validateTimeOff)
      .mockRejectedValue(new ServiceUnavailableException('HCM down'));

    await expect(
      service.createRequest({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('surfaces HCM validation rejection during request creation', async () => {
    const { service, balanceRepository, hcmMockService } = createService();
    jest.mocked(balanceRepository.findOne).mockResolvedValue({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 10,
      reservedDays: 0,
      version: 1,
    } as Balance);
    jest.mocked(hcmMockService.validateTimeOff).mockResolvedValue({
      accepted: false,
      reason: 'HCM reports insufficient balance.',
    });

    await expect(
      service.createRequest({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when a balance lookup misses', async () => {
    const { service, balanceRepository } = createService();
    jest.mocked(balanceRepository.findOne).mockResolvedValue(null);

    await expect(
      service.getBalance('EMP-404', 'US-NY', 'PTO'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks request rejected and releases reserved balance when HCM filing rejects', async () => {
    const { service, dataSource, hcmMockService, requestRepository } = createService();
    const request = {
      id: 'req-1',
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      requestedDays: 2,
      status: TimeOffRequestStatus.PENDING,
      rejectionReason: null,
    } as TimeOffRequest;
    const balance = {
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 10,
      reservedDays: 2,
      version: 3,
    } as Balance;
    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === TimeOffRequest) {
          return request;
        }
        return balance;
      }),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
    };

    jest.mocked(requestRepository.findOne).mockResolvedValue(request);
    jest.mocked(hcmMockService.fileTimeOff).mockResolvedValue({
      accepted: false,
      reason: 'HCM rejected filing because balance is insufficient.',
    });
    (dataSource.transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(manager),
    );

    const result = await service.approveRequest('req-1');

    expect(result.status).toBe(TimeOffRequestStatus.REJECTED);
    expect(result.rejectionReason).toBe(
      'HCM rejected filing because balance is insufficient.',
    );
    expect(manager.save).toHaveBeenCalledWith(
      Balance,
      expect.objectContaining({ reservedDays: 0, version: 4 }),
    );
  });

  it('rejects approval when the request is already cancelled', async () => {
    const { service, requestRepository } = createService();
    jest.mocked(requestRepository.findOne).mockResolvedValue({
      id: 'req-2',
      status: TimeOffRequestStatus.CANCELLED,
    } as TimeOffRequest);

    await expect(service.approveRequest('req-2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
