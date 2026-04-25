import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HcmMockModule } from '../hcm-mock/hcm-mock.module';
import { Balance } from './entities/balance.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest, Balance]),
    HcmMockModule,
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
