import { Module } from '@nestjs/common';
import { GoalsService } from '../../application/goals.service';
import { GoalsController } from '../controllers/goals.controller';
@Module({ controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
