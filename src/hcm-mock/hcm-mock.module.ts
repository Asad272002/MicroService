import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MockHcmBalance } from './entities/mock-hcm-balance.entity';
import { HcmMockController } from './hcm-mock.controller';
import { HcmMockService } from './hcm-mock.service';

@Module({
  imports: [TypeOrmModule.forFeature([MockHcmBalance])],
  controllers: [HcmMockController],
  providers: [HcmMockService],
  exports: [HcmMockService],
})
export class HcmMockModule {}
