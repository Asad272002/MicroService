import { MockHcmBalance } from '../hcm-mock/entities/mock-hcm-balance.entity';
import { Balance } from '../time-off/entities/balance.entity';

export type SeedBalanceRecord = Pick<
  Balance,
  'employeeId' | 'locationId' | 'leaveType' | 'availableDays'
>;

export const SEED_BALANCES: SeedBalanceRecord[] = [
  {
    employeeId: 'EMP-100',
    locationId: 'US-NY',
    leaveType: 'PTO',
    availableDays: 15,
  },
  {
    employeeId: 'EMP-100',
    locationId: 'US-NY',
    leaveType: 'SICK',
    availableDays: 8,
  },
  {
    employeeId: 'EMP-200',
    locationId: 'UK-LON',
    leaveType: 'PTO',
    availableDays: 20,
  },
  {
    employeeId: 'EMP-300',
    locationId: 'DE-BER',
    leaveType: 'PTO',
    availableDays: 12,
  },
];

export function buildSeedLocalBalances(now: Date): Partial<Balance>[] {
  return SEED_BALANCES.map((balance) => ({
    ...balance,
    reservedDays: 0,
    version: 1,
    lastSyncedAt: now,
  }));
}

export function buildSeedHcmBalances(): Partial<MockHcmBalance>[] {
  return SEED_BALANCES.map((balance) => ({
    ...balance,
    version: 1,
  }));
}
