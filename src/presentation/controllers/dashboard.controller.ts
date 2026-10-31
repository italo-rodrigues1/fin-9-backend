import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { PlanningService } from '../../application/planning.service';
import { PeriodDto } from '../dtos/planning.dto';
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly planning: PlanningService) {}
  @Get('summary') getMonthlySummary(
    @CurrentUser() user: { id: string },
    @Query() period: PeriodDto,
  ) {
    return this.planning.report(user.id, period);
  }
}
