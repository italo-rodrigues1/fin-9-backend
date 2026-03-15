import { Module } from '@nestjs/common';
import { TransactionController, DashboardController } from '../controllers';
import { TRANSACTION_REPOSITORY, CATEGORY_REPOSITORY, ACCOUNT_REPOSITORY } from '../../domain/repositories';
import { PrismaTransactionRepository, PrismaCategoryRepository } from '../../infrastructure/repositories';
import { PrismaAccountRepository } from '../../infrastructure/repositories';

@Module({
  controllers: [TransactionController, DashboardController],
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
})
export class TransactionModule {}
