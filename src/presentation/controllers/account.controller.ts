import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../domain/repositories';
import type { AccountRepository } from '../../domain/repositories';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { CreateAccountDto, UpdateAccountDto } from '../dtos';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.accountRepo.findAll(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateAccountDto) {
    return this.accountRepo.create({
      name: dto.name,
      institution: dto.institution,
      balance: dto.balance,
      color: dto.color,
      icon: dto.icon,
      userId: user.id,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const existing = await this.accountRepo.findById(id, user.id);
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    return this.accountRepo.update(id, user.id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const existing = await this.accountRepo.findById(id, user.id);
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    await this.accountRepo.delete(id, user.id);
    return { message: 'Account deleted successfully' };
  }
}
