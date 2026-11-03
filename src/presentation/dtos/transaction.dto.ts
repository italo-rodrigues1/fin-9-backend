import { IsOptionalField, ToNumber } from './validation.decorators';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { TransactionType } from '../../domain/entities';

export class CreateTransactionDto {
  @IsOptionalField() @IsIn(['CONFIRMED', 'PLANNED']) status?:
    | 'CONFIRMED'
    | 'PLANNED';
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsOptionalField()
  @MaxLength(500)
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor inválido (máximo 2 casas decimais)' },
  )
  @Min(0.01)
  @Max(999_999_999.99, { message: 'Valor máximo excedido' })
  @ToNumber()
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;
}

export class UpdateTransactionDto {
  @IsOptionalField() @IsIn(['CONFIRMED', 'PLANNED']) status?:
    | 'CONFIRMED'
    | 'PLANNED';
  @IsString()
  @IsOptionalField()
  @IsNotEmpty()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptionalField()
  @MaxLength(500)
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor inválido (máximo 2 casas decimais)' },
  )
  @Min(0.01)
  @Max(999_999_999.99, { message: 'Valor máximo excedido' })
  @IsOptionalField()
  @ToNumber()
  amount?: number;

  @IsEnum(TransactionType)
  @IsOptionalField()
  type?: TransactionType;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptionalField()
  date?: string;

  @IsUUID()
  @IsOptionalField()
  categoryId?: string;

  @IsUUID()
  @IsOptionalField()
  accountId?: string;
}

export class FilterTransactionDto {
  @IsOptionalField() @IsString() @MaxLength(100) search?: string;
  @IsOptionalField() @ToNumber() @IsInt() @Min(0) @Max(100000) skip: number = 0;
  @IsOptionalField() @ToNumber() @IsInt() @Min(1) @Max(100) take: number = 30;
  @IsOptionalField() @IsIn(['CONFIRMED', 'PLANNED']) status?:
    | 'CONFIRMED'
    | 'PLANNED';
  @IsOptionalField()
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptionalField()
  @ToNumber()
  @IsInt()
  @Min(1900)
  @Max(9998)
  year?: number;

  @IsOptionalField()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use the YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptionalField()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use the YYYY-MM-DD format',
  })
  endDate?: string;

  @IsOptionalField()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptionalField()
  @IsUUID()
  categoryId?: string;

  @IsOptionalField()
  @IsIn(['date', 'amount'])
  orderBy?: 'date' | 'amount';

  @IsOptionalField()
  @IsIn(['asc', 'desc'])
  orderDir?: 'asc' | 'desc';

  @IsOptionalField()
  @IsUUID()
  accountId?: string;
}

export class MonthlySummaryQueryDto {
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ToNumber()
  @IsInt()
  @Min(1900)
  @Max(9998)
  year: number;

  @IsOptionalField()
  @IsUUID()
  accountId?: string;
}
