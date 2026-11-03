import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { OAuth2Client } from 'google-auth-library';
import {
  GoogleIdentityService,
  GOOGLE_TOKEN_CLIENT,
} from '../../infrastructure/auth/google-identity.service';
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
            '7d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    GoogleIdentityService,
    { provide: GOOGLE_TOKEN_CLIENT, useFactory: () => new OAuth2Client() },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
