import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'examplehr-time-off-microservice',
      timestamp: new Date().toISOString(),
    };
  }
}
