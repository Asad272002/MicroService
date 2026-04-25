import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { HcmMockService } from '../hcm-mock/hcm-mock.service';
import { Balance } from '../time-off/entities/balance.entity';
import { SyncBalanceRecordDto } from './dto/sync-balances.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hcmMockService: HcmMockService,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  async syncFromHcm(
    inboundBalances?: SyncBalanceRecordDto[],
  ): Promise<{ syncedCount: number; balances: Balance[] }> {
    const remoteBalances =
      inboundBalances && inboundBalances.length > 0
        ? inboundBalances
        : await this.hcmMockService.batchBalances();
    const syncedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      for (const remoteBalance of remoteBalances) {
        const existing = await manager.findOne(Balance, {
          where: {
            employeeId: remoteBalance.employeeId,
            locationId: remoteBalance.locationId,
            leaveType: remoteBalance.leaveType,
          },
        });

        if (!existing) {
          await manager.save(
            Balance,
            manager.create(Balance, {
              employeeId: remoteBalance.employeeId,
              locationId: remoteBalance.locationId,
              leaveType: remoteBalance.leaveType,
              availableDays: remoteBalance.availableDays,
              reservedDays: 0,
              version: 1,
              lastSyncedAt: syncedAt,
            }),
          );
          continue;
        }

        existing.availableDays = remoteBalance.availableDays;
        existing.lastSyncedAt = syncedAt;
        existing.version += 1;
        await manager.save(Balance, existing);
      }
    });

    return {
      syncedCount: remoteBalances.length,
      balances: await this.balanceRepository.find({
        order: {
          employeeId: 'ASC',
          locationId: 'ASC',
          leaveType: 'ASC',
        },
      }),
    };
  }
}
