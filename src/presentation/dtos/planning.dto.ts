import { IsOptionalField, ToNumber } from './validation.decorators';
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
export class BudgetPeriodDto {
  @ToNumber() @IsInt() @Min(1) @Max(12) month: number;
  @ToNumber() @IsInt() @Min(1900) @Max(9998) year: number;
}
export class PeriodDto extends BudgetPeriodDto {
  @IsOptionalField() @IsUUID() accountId?: string;
}
export class PageDto {
  @IsOptionalField() @ToNumber() @IsInt() @Min(0) @Max(100000) skip: number = 0;
  @IsOptionalField() @ToNumber() @IsInt() @Min(1) @Max(100) take: number = 30;
}
export class TransferDto {
  @IsUUID() fromAccountId: string;
  @IsUUID() toAccountId: string;
  @ToNumber()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsOptionalField() @IsString() @MaxLength(100) title?: string;
}
export class BudgetDto extends BudgetPeriodDto {
  @IsUUID() categoryId: string;
  @ToNumber()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
}
export class RecurrenceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @ToNumber()
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
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;
}
export class EditRecurrenceDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate: string;
  @IsOptionalField() @IsBoolean() active?: boolean;
  @IsOptionalField() @IsString() @IsNotEmpty() @MaxLength(100) title?: string;
  @IsOptionalField()
  @ToNumber()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount?: number;
  @IsOptionalField() @IsIn(['INCOME', 'EXPENSE']) type?: 'INCOME' | 'EXPENSE';
  @IsOptionalField() @IsUUID() accountId?: string;
  @IsOptionalField() @IsUUID() categoryId?: string;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;
}
