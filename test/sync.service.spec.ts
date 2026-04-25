import { DataSource, Repository } from 'typeorm';

import { HcmMockService } from '../src/hcm-mock/hcm-mock.service';
import { Balance } from '../src/time-off/entities/balance.entity';
import { SyncService } from '../src/sync/sync.service';

function createService() {
  const dataSource = {
    transaction: jest.fn(),
  } as unknown as DataSource;

  const hcmMockService = {
    batchBalances: jest.fn(),
  } as unknown as HcmMockService;

  const balanceRepository = {
    find: jest.fn(),
  } as unknown as Repository<Balance>;

  return {
    service: new SyncService(dataSource, hcmMockService, balanceRepository),
    dataSource,
    hcmMockService,
    balanceRepository,
  };
}

describe('SyncService', () => {
  it('pulls from HCM when no inbound balance body is supplied', async () => {
    const { service, dataSource, hcmMockService, balanceRepository } = createService();
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
    };

    jest.mocked(hcmMockService.batchBalances).mockResolvedValue([
      {
        employeeId: 'EMP-400',
        locationId: 'CA-TOR',
        leaveType: 'PTO',
        availableDays: 9,
      } as Balance,
    ]);
    jest.mocked(balanceRepository.find).mockResolvedValue([]);
    (dataSource.transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(manager),
    );

    await service.syncFromHcm();

    expect(hcmMockService.batchBalances).toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalled();
  });

  it('uses inbound balances and preserves reserved days on existing local rows', async () => {
    const { service, dataSource, hcmMockService, balanceRepository } = createService();
    const existingBalance = {
      employeeId: 'EMP-100',
      locationId: 'US-NY',
      leaveType: 'PTO',
      availableDays: 15,
      reservedDays: 3,
      version: 2,
    } as Balance;
    const manager = {
      findOne: jest.fn().mockResolvedValue(existingBalance),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
    };

    jest.mocked(balanceRepository.find).mockResolvedValue([existingBalance]);
    (dataSource.transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(manager),
    );

    const result = await service.syncFromHcm([
      {
        employeeId: 'EMP-100',
        locationId: 'US-NY',
        leaveType: 'PTO',
        availableDays: 25,
      },
    ]);

    expect(hcmMockService.batchBalances).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      Balance,
      expect.objectContaining({
        availableDays: 25,
        reservedDays: 3,
        version: 3,
      }),
    );
    expect(result.syncedCount).toBe(1);
  });
});
