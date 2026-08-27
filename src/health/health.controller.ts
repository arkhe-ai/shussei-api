import { Controller, Get } from '@nestjs/common';

@Controller('/api/v1/health')
export class HealthController {
  @Get()
  async getHealth() {
    return { status: 'ok' as const };
  }
}
