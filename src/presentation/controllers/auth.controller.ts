import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import type {
  CategoryRepository,
  UserRepository,
} from '../../domain/repositories';
import {
  CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { CurrentUser, JwtAuthGuard, Public } from '../../infrastructure/auth';
import {
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from '../dtos';
import { GoogleIdentityService } from '../../infrastructure/auth/google-identity.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepository,
    private readonly jwtService: JwtService,
    private readonly googleIdentity: GoogleIdentityService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    const existing = await this.userRepo.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    await this.categoryRepo.createDefaultCategories(user.id);

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const user = await this.userRepo.findByEmailWithHash(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  }

  @Public()
  @Post('google')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async google(@Body() dto: GoogleLoginDto) {
    const identity = await this.googleIdentity.verify(dto.idToken);
    const user = await this.userRepo.findOrCreateGoogleUser(identity);
    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    const found = await this.userRepo.findById(user.id);
    if (!found) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      createdAt: found.createdAt,
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.userRepo.update(user.id, { name: dto.name });
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
    };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: { id: string }) {
    const found = await this.userRepo.findById(user.id);
    if (!found) {
      throw new UnauthorizedException('User not found');
    }

    await this.userRepo.delete(user.id);

    return {
      message: 'Conta excluida com sucesso',
    };
  }
}
