import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { JwtStrategy } from '../../infrastructure/auth';
import {
  PrismaCategoryRepository,
  PrismaUserRepository,
} from '../../infrastructure/repositories';
import { AuthController } from '../controllers';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
            '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
