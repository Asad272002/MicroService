import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CreateTimeOffRequestDto } from '../time-off/dto/create-time-off-request.dto';
import { SimulateAnniversaryBonusDto } from './dto/simulate-anniversary-bonus.dto';
import { SimulateBalanceResetDto } from './dto/simulate-balance-reset.dto';
import { HcmMockService } from './hcm-mock.service';

@Controller('mock-hcm')
export class HcmMockController {
  constructor(private readonly hcmMockService: HcmMockService) {}

  @Get('balances')
  getBalances(
    @Query('employeeId') employeeId?: string,
    @Query('locationId') locationId?: string,
    @Query('leaveType') leaveType?: string,
  ) {
    return this.hcmMockService.getBalances({ employeeId, locationId, leaveType });
  }

  @Post('validate-time-off')
  validateTimeOff(@Body() body: CreateTimeOffRequestDto) {
    return this.hcmMockService.validateTimeOff(body);
  }

  @Post('file-time-off')
  fileTimeOff(@Body() body: CreateTimeOffRequestDto) {
    return this.hcmMockService.fileTimeOff(body);
  }

  @Post('batch-balances')
  batchBalances() {
    return this.hcmMockService.batchBalances();
  }

  @Post('simulate-anniversary-bonus')
  simulateAnniversaryBonus(@Body() body: SimulateAnniversaryBonusDto) {
    return this.hcmMockService.simulateAnniversaryBonus(body);
  }

  @Post('simulate-balance-reset')
  simulateBalanceReset(@Body() body: SimulateBalanceResetDto) {
    return this.hcmMockService.simulateBalanceReset(body);
  }
}
