import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HcmMockModule } from '../hcm-mock/hcm-mock.module';
import { Balance } from '../time-off/entities/balance.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Balance]), HcmMockModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
