import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { MockHcmBalance } from '../hcm-mock/entities/mock-hcm-balance.entity';
import { Balance } from '../time-off/entities/balance.entity';
import { TimeOffRequest } from '../time-off/entities/time-off-request.entity';

export const DATABASE_ENTITIES = [Balance, TimeOffRequest, MockHcmBalance];

export function getDatabaseOptions(
  databasePath = process.env.DB_PATH ?? 'data/dev.sqlite',
): TypeOrmModuleOptions {
  return {
    type: 'sqlite',
    database: databasePath,
    entities: DATABASE_ENTITIES,
    synchronize: true,
    autoLoadEntities: true,
  };
}
