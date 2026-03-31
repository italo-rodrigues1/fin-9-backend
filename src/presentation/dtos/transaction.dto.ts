import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
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

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  date: string;

  @IsUUID()
  categoryId: string;
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

  @IsNumber()
  @Min(0.01)
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
}

export class MonthlySummaryQueryDto {
  @Type(() => Number)
  @IsNumber()
  month: number;

  @Type(() => Number)
  @IsNumber()
  year: number;
}
