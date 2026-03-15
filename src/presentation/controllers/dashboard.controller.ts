import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../infrastructure/auth';
import { ACCOUNT_REPOSITORY, TRANSACTION_REPOSITORY } from '../../domain/repositories';
import type { AccountRepository, TransactionRepository } from '../../domain/repositories';
import { MonthlySummaryQueryDto } from '../dtos';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly txRepo: TransactionRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
  ) {}

  @Get('summary')
  async getMonthlySummary(
    @CurrentUser() user: { id: string },
    @Query() query: MonthlySummaryQueryDto,
  ) {
    const [summary, accounts] = await Promise.all([
      this.txRepo.getMonthlySummary(user.id, query.month, query.year),
      this.accountRepo.findAll(user.id),
    ]);

    return {
      ...summary,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        institution: account.institution,
        balance: account.balance,
        color: account.color,
        icon: account.icon,
      })),
    };
  }
}
