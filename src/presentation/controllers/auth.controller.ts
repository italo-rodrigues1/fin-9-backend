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
import * as bcrypt from 'bcrypt';
import type {
  CategoryRepository,
  UserRepository,
} from '../../domain/repositories';
import {
  CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '../../domain/repositories';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { LoginDto, RegisterDto, UpdateProfileDto } from '../dtos';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepository,
    private readonly jwtService: JwtService,
  ) { }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const domainEmailAccepted = ['gmail.com', 'outlook.com', 'hotmail.com'];
    const emailValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email) &&
      domainEmailAccepted.some((domain) => dto.email.endsWith(domain));

    if (!emailValid) {
      throw new ConflictException(
        'Email inválido. Por favor, utilize um email válido (ex: @gmail.com, @outlook.com)',
      );
    }

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
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
