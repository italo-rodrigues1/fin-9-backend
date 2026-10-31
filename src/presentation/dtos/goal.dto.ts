import { Transform, Type } from 'class-transformer';
import {
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
export class SaveGoalDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  targetAmount: number;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string | null;
}
export class SaveGoalContributionDto {
  @IsUUID() accountId: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9-]{8,80}$/) requestId?: string;
}
export class GoalPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) skip: number =
    0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take: number =
    30;
}
