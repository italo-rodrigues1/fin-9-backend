import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../infrastructure/auth';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
