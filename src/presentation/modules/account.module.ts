import { Module } from '@nestjs/common';
import { AccountController } from '../controllers';
import { ACCOUNT_REPOSITORY } from '../../domain/repositories';
import { PrismaAccountRepository } from '../../infrastructure/repositories';

@Module({
  controllers: [AccountController],
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
  ],
})
export class AccountModule {}
