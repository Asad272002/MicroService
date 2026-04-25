import { DataSource } from 'typeorm';

import { MockHcmBalance } from '../hcm-mock/entities/mock-hcm-balance.entity';
import { Balance } from '../time-off/entities/balance.entity';
import { TimeOffRequest } from '../time-off/entities/time-off-request.entity';
import { buildSeedHcmBalances, buildSeedLocalBalances } from './seed-data';

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const balanceRepository = dataSource.getRepository(Balance);
  const requestRepository = dataSource.getRepository(TimeOffRequest);
  const hcmBalanceRepository = dataSource.getRepository(MockHcmBalance);
  const now = new Date();

  await requestRepository.clear();
  await balanceRepository.clear();
  await hcmBalanceRepository.clear();

  await balanceRepository.save(buildSeedLocalBalances(now));
  await hcmBalanceRepository.save(buildSeedHcmBalances());
}
