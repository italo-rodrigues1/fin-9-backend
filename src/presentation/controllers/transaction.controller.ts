import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AccountRepository,
  CategoryRepository,
  TransactionRepository,
} from '../../domain/repositories';
import {
  ACCOUNT_REPOSITORY,
  CATEGORY_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../domain/repositories';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import {
  CreateTransactionDto,
  FilterTransactionDto,
  UpdateTransactionDto,
} from '../dtos';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly txRepo: TransactionRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() filters: FilterTransactionDto,
  ) {
    return this.txRepo.findAll({ ...filters, userId: user.id });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const tx = await this.txRepo.findById(id, user.id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx;
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTransactionDto,
  ) {
    const category = await this.categoryRepo.findById(dto.categoryId, user.id);
    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const account = await this.accountRepo.findById(dto.accountId, user.id);
    if (!account) {
      throw new BadRequestException(
        'Account not found or does not belong to the user',
      );
    }

    return this.txRepo.create({
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      type: dto.type,
      date: new Date(dto.date),
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      userId: user.id,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const existing = await this.txRepo.findById(id, user.id);
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(
        dto.categoryId,
        user.id,
      );
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.date !== undefined) updateData.date = new Date(dto.date);
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;

    return this.txRepo.update(id, user.id, updateData);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const existing = await this.txRepo.findById(id, user.id);
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    await this.txRepo.delete(id, user.id);
    return { message: 'Transaction deleted successfully' };
  }
}
