import { Module } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  CATEGORY_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../domain/repositories';
import {
  PrismaAccountRepository,
  PrismaCategoryRepository,
  PrismaTransactionRepository,
} from '../../infrastructure/repositories';
import { DashboardController, TransactionController } from '../controllers';

@Module({
  controllers: [TransactionController, DashboardController],
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
})
export class TransactionModule {}
