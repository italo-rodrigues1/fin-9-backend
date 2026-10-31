import { Module } from '@nestjs/common';
import { AccountController } from '../controllers';
import {
  ACCOUNT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../domain/repositories';
import {
  PrismaAccountRepository,
  PrismaTransactionRepository,
} from '../../infrastructure/repositories';

@Module({
  controllers: [AccountController],
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: PrismaTransactionRepository,
    },
  ],
})
export class AccountModule {}
