import { Body, Controller, Post } from '@nestjs/common';

import { SyncBalancesDto } from './dto/sync-balances.dto';
import { SyncService } from './sync.service';

@Controller('sync/hcm')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('balances')
  syncBalances(@Body() body: SyncBalancesDto = {}) {
    return this.syncService.syncFromHcm(body.balances);
  }
}
