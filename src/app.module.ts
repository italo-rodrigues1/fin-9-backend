import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AccountModule, AuthModule, CategoryModule, TransactionModule } from './presentation/modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AccountModule,
    CategoryModule,
    TransactionModule,
  ],
})
export class AppModule {}
