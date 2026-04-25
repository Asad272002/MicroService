import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { RejectTimeOffRequestDto } from './dto/reject-time-off-request.dto';
import { TimeOffService } from './time-off.service';

@Controller()
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Get('balances')
  getBalances(
    @Query('employeeId') employeeId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.timeOffService.getBalances({ employeeId, locationId });
  }

  @Get('balances/:employeeId/:locationId/:leaveType')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('leaveType') leaveType: string,
  ) {
    return this.timeOffService.getBalance(employeeId, locationId, leaveType);
  }

  @Post('time-off-requests')
  createRequest(@Body() body: CreateTimeOffRequestDto) {
    return this.timeOffService.createRequest(body);
  }

  @Get('time-off-requests')
  getRequests() {
    return this.timeOffService.getRequests();
  }

  @Get('time-off-requests/:id')
  getRequest(@Param('id') id: string) {
    return this.timeOffService.getRequest(id);
  }

  @Post('time-off-requests/:id/approve')
  approveRequest(@Param('id') id: string) {
    return this.timeOffService.approveRequest(id);
  }

  @Post('time-off-requests/:id/reject')
  rejectRequest(
    @Param('id') id: string,
    @Body() body: RejectTimeOffRequestDto,
  ) {
    return this.timeOffService.rejectRequest(id, body);
  }

  @Post('time-off-requests/:id/cancel')
  cancelRequest(@Param('id') id: string) {
    return this.timeOffService.cancelRequest(id);
  }
}
