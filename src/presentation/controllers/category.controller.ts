import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../infrastructure/auth';
import { CATEGORY_REPOSITORY } from '../../domain/repositories';
import type { CategoryRepository } from '../../domain/repositories';
import { CreateCategoryDto, UpdateCategoryDto } from '../dtos';
import { ConflictException, NotFoundException } from '@nestjs/common';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categoryRepo: CategoryRepository,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.categoryRepo.findAllByUser(user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateCategoryDto) {
    const existing = await this.categoryRepo.findByNameAndUser(dto.name, user.id);
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.categoryRepo.create({
      name: dto.name,
      color: dto.color || '#6366f1',
      icon: dto.icon || 'tag',
      isDefault: false,
      userId: user.id,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.categoryRepo.findById(id, user.id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name && dto.name !== category.name) {
      const duplicate = await this.categoryRepo.findByNameAndUser(dto.name, user.id);
      if (duplicate) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    return this.categoryRepo.update(id, user.id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const category = await this.categoryRepo.findById(id, user.id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryRepo.delete(id, user.id);
    return { message: 'Category deleted successfully' };
  }
}
