import { Module } from '@nestjs/common';
import { CardsService } from '../../application/cards.service';
import { CardsController } from '../controllers/cards.controller';
@Module({ controllers: [CardsController], providers: [CardsService] })
export class CardsModule {}
