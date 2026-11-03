import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { PlanningService } from '../../application/planning.service';
import {
  BudgetDto,
  BudgetPeriodDto,
  EditRecurrenceDto,
  PageDto,
  RecurrenceDto,
  TransferDto,
} from '../dtos/planning.dto';
@Controller()
@UseGuards(JwtAuthGuard)
export class PlanningController {
  constructor(private readonly service: PlanningService) {}
  @Get('accounts/:id/statement') statement(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: PageDto,
  ) {
    return this.service.statement(u.id, id, page);
  }
  @Get('transfers/:id') getTransfer(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getTransfer(u.id, id);
  }
  @Get('transfers') transfers(@CurrentUser() u: { id: string }) {
    return this.service.transfers(u.id);
  }
  @Post('transfers') createTransfer(
    @CurrentUser() u: { id: string },
    @Body() data: TransferDto,
  ) {
    return this.service.transfer(u.id, data);
  }
  @Patch('transfers/:id') editTransfer(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: TransferDto,
  ) {
    return this.service.transfer(u.id, data, id);
  }
  @Delete('transfers/:id') deleteTransfer(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteTransfer(u.id, id);
  }
  @Get('budgets') budgets(
    @CurrentUser() u: { id: string },
    @Query() period: BudgetPeriodDto,
  ) {
    return this.service.budgets(u.id, period);
  }
  @Post('budgets') saveBudget(
    @CurrentUser() u: { id: string },
    @Body() data: BudgetDto,
  ) {
    return this.service.saveBudget(u.id, data);
  }
  @Delete('budgets/:id') deleteBudget(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteBudget(u.id, id);
  }
  @Get('recurrences') recurrences(@CurrentUser() u: { id: string }) {
    return this.service.recurrences(u.id);
  }
  @Post('recurrences') createRecurrence(
    @CurrentUser() u: { id: string },
    @Body() data: RecurrenceDto,
  ) {
    return this.service.createRecurrence(u.id, data);
  }
  @Patch('recurrences/:id') editRecurrence(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: EditRecurrenceDto,
  ) {
    return this.service.editRecurrence(u.id, id, data);
  }
  @Get('planning/upcoming') upcoming(@CurrentUser() u: { id: string }) {
    return this.service.upcoming(u.id);
  }
}
