import { CardsModule } from './presentation/modules/cards.module';
import { GoalsModule } from './presentation/modules/goals.module';
import { API_RATE_LIMIT } from './rate-limit.config';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './infrastructure/database/database.module';
import { DatabaseContextInterceptor } from './infrastructure/database/database-context.interceptor';
import { JwtAuthGuard } from './infrastructure/auth';
import { PublicResponseInterceptor } from './presentation/interceptors/public-response.interceptor';
import {
  AccountModule,
  AuthModule,
  CategoryModule,
  HealthModule,
  TransactionModule,
} from './presentation/modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([API_RATE_LIMIT]),
    DatabaseModule,
    GoalsModule,
    CardsModule,
    HealthModule,
    AuthModule,
    AccountModule,
    CategoryModule,
    TransactionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: PublicResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DatabaseContextInterceptor },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
