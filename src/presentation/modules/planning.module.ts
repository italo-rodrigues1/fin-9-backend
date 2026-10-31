import { Module } from '@nestjs/common';
import { PlanningService } from '../../application/planning.service';
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma-transaction.repository';
import { PlanningController } from '../controllers/planning.controller';
@Module({
  controllers: [PlanningController],
  providers: [PlanningService, PrismaTransactionRepository],
  exports: [PlanningService],
})
export class PlanningModule {}
