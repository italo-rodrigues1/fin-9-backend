import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { CardsService } from '../../application/cards.service';
import {
  SaveCardDto,
  SaveCardPurchaseDto,
  PayCardInvoiceDto,
} from '../dtos/card.dto';
import { PageDto } from '../dtos/planning.dto';
@Controller('cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(private readonly service: CardsService) {}
  @Get() list(@CurrentUser() u: { id: string }) {
    return this.service.list(u.id);
  }
  @Post() create(@CurrentUser() u: { id: string }, @Body() d: SaveCardDto) {
    return this.service.saveCard(u.id, d);
  }
  @Get(':cardId') detail(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
  ) {
    return this.service.detail(u.id, c);
  }
  @Patch(':cardId') edit(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Body() d: SaveCardDto,
  ) {
    return this.service.saveCard(u.id, d, c);
  }
  @Post(':cardId/purchases') purchase(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Body() d: SaveCardPurchaseDto,
  ) {
    return this.service.savePurchase(u.id, c, d);
  }
  @Get(':cardId/purchases/:id') getPurchase(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.purchase(u.id, c, id);
  }
  @Patch(':cardId/purchases/:id') editPurchase(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SaveCardPurchaseDto,
  ) {
    return this.service.savePurchase(u.id, c, d, id);
  }
  @Delete(':cardId/purchases/:id') removePurchase(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removePurchase(u.id, c, id);
  }
  @Get(':cardId/invoices/:id') invoice(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() p: PageDto,
  ) {
    return this.service.invoice(u.id, c, id, p);
  }
  @Post(':cardId/invoices/:id/payments') pay(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PayCardInvoiceDto,
  ) {
    return this.service.pay(u.id, c, id, d);
  }
  @Delete(':cardId/invoices/:invoiceId/payments/:id') reverse(
    @CurrentUser() u: { id: string },
    @Param('cardId', ParseUUIDPipe) c: string,
    @Param('invoiceId', ParseUUIDPipe) i: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reverse(u.id, c, i, id);
  }
}
