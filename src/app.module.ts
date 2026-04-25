import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getDatabaseOptions } from './database/database.config';
import { HealthController } from './health.controller';
import { HcmMockModule } from './hcm-mock/hcm-mock.module';
import { SyncModule } from './sync/sync.module';
import { TimeOffModule } from './time-off/time-off.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseOptions()),
    TimeOffModule,
    HcmMockModule,
    SyncModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
