import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { TransactionType } from '../../domain/entities';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor inválido (máximo 2 casas decimais)' },
  )
  @Min(0.01)
  @Max(999_999_999.99, { message: 'Valor máximo excedido' })
  @Type(() => Number)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  date: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;
}

export class UpdateTransactionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor inválido (máximo 2 casas decimais)' },
  )
  @Min(0.01)
  @Max(999_999_999.99, { message: 'Valor máximo excedido' })
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;
}

export class FilterTransactionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use the YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use the YYYY-MM-DD format',
  })
  endDate?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['date', 'amount'])
  orderBy?: 'date' | 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderDir?: 'asc' | 'desc';

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class MonthlySummaryQueryDto {
  @Type(() => Number)
  @IsNumber()
  month: number;

  @Type(() => Number)
  @IsNumber()
  year: number;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}
