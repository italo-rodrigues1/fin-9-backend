import { IsOptionalField, ToNumber } from './validation.decorators';
import { Transform } from 'class-transformer';
import { CardBrand } from '../../generated/client/enums';
import {
  IsBoolean,
  IsEnum,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class SaveCardDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
  @IsOptional()
  @IsEnum(CardBrand, { message: 'Selecione uma bandeira válida.' })
  brand?: CardBrand | null;
  @ToNumber()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  creditLimit: number;
  @ToNumber() @IsInt() @Min(1) @Max(31) closingDay: number;
  @ToNumber() @IsInt() @Min(1) @Max(31) dueDay: number;
  @IsOptionalField() @IsBoolean() isArchived?: boolean;
}
export class SaveCardPurchaseDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;
  @IsUUID() categoryId: string;
  @ToNumber()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ToNumber() @IsInt() @Min(1) @Max(36) installmentCount: number;
  @IsOptionalField()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{8,80}$/)
  requestId?: string;
}
export class PayCardInvoiceDto {
  @IsUUID() accountId: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsString() @Matches(/^[a-zA-Z0-9-]{8,80}$/) requestId: string;
}
