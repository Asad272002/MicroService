import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { MockHcmBalance } from '../src/hcm-mock/entities/mock-hcm-balance.entity';
import { HcmMockService } from '../src/hcm-mock/hcm-mock.service';

function createService() {
  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (value: unknown) => value),
  } as unknown as Repository<MockHcmBalance>;

  return {
    service: new HcmMockService(repository),
    repository,
    queryBuilder,
  };
}

describe('HcmMockService', () => {
  it('applies all optional filters when querying balances', async () => {
    const { service, queryBuilder } = createService();
    jest.mocked(queryBuilder.getMany).mockResolvedValue([]);

    await service.getBalances({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(3);
  });

  it('returns a validation rejection when the HCM balance is missing', async () => {
    const { service, repository } = createService();
    jest.mocked(repository.findOne).mockResolvedValue(null);

    await expect(
      service.validateTimeOff({
        employeeId: 'EMP-404',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'Unknown employee/location/leaveType combination in HCM.',
    });
  });

  it('returns a validation rejection when HCM balance is insufficient', async () => {
    const { service, repository } = createService();
    jest.mocked(repository.findOne).mockResolvedValue({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 1,
      version: 1,
    } as MockHcmBalance);

    await expect(
      service.validateTimeOff({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 2,
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'HCM reports insufficient balance.',
      availableDays: 1,
    });
  });

  it('throws a configured validation rejection failure', async () => {
    const { service } = createService();
    service.setValidationFailure(
      {
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
      },
      'reject',
    );

    await expect(
      service.validateTimeOff({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws a configured validation availability failure', async () => {
    const { service } = createService();
    service.setValidationFailure(
      {
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
      },
      'service_unavailable',
    );

    await expect(
      service.validateTimeOff({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns a filing rejection when balance is insufficient in strict mode', async () => {
    const { service, repository } = createService();
    jest.mocked(repository.findOne).mockResolvedValue({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 1,
      version: 1,
    } as MockHcmBalance);

    await expect(
      service.fileTimeOff({
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        requestedDays: 2,
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'HCM rejected filing because balance is insufficient.',
    });
  });

  it('files time off in lenient mode and persists the updated balance', async () => {
    const { service, repository } = createService();
    const balance = {
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 1,
      version: 1,
    } as MockHcmBalance;
    jest.mocked(repository.findOne).mockResolvedValue(balance);
    service.setLenientFilingMode(
      {
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
      },
      true,
    );

    const result = await service.fileTimeOff({
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      requestedDays: 2,
    });

    expect(result.accepted).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ availableDays: -1, version: 2 }),
    );
  });

  it('throws not found when resetting an unknown HCM balance', async () => {
    const { service, repository } = createService();
    jest.mocked(repository.findOne).mockResolvedValue(null);

    await expect(
      service.simulateBalanceReset({
        employeeId: 'EMP-404',
        locationId: 'US-NY',
        leaveType: 'PTO',
        availableDays: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
