import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
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
export class PeriodDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @Type(() => Number) @IsInt() @Min(1900) @Max(9998) year: number;
  @IsOptional() @IsUUID() accountId?: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) skip: number =
    0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take: number =
    30;
}
export class TransferDto {
  @IsUUID() fromAccountId: string;
  @IsUUID() toAccountId: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
}
export class BudgetDto extends PeriodDto {
  @IsUUID() categoryId: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
}
export class RecurrenceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
  @IsIn(['INCOME', 'EXPENSE']) type: 'INCOME' | 'EXPENSE';
  @IsUUID() accountId: string;
  @IsUUID() categoryId: string;
  @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) interval:
    | 'WEEKLY'
    | 'MONTHLY'
    | 'YEARLY';
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate: string;
  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?:
    | string
    | null;
}
export class EditRecurrenceDto {
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) effectiveDate: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) title?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount?: number;
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) type?: 'INCOME' | 'EXPENSE';
  @IsOptional() @IsUUID() accountId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsDateString() endDate?: string | null;
}
