import { Module } from '@nestjs/common';
import { CategoryController } from '../controllers';
import { CATEGORY_REPOSITORY } from '../../domain/repositories';
import { PrismaCategoryRepository } from '../../infrastructure/repositories';

@Module({
  controllers: [CategoryController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
  exports: [CATEGORY_REPOSITORY],
})
export class CategoryModule {}
