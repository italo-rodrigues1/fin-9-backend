import { IsOptionalField, ToNumber } from './validation.decorators';
import {
  IsBoolean,
  IsNotEmpty,
  IsHexColor,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  institution: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999.99, { message: 'Saldo máximo excedido' })
  @ToNumber()
  balance: number;

  @IsOptionalField()
  @IsHexColor()
  color?: string;

  @IsOptionalField()
  @IsString()
  @MaxLength(100)
  icon?: string;
}

export class UpdateAccountDto {
  @IsOptionalField()
  @IsBoolean()
  isArchived?: boolean;
  @IsOptionalField()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptionalField()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @IsOptionalField()
  @IsHexColor()
  color?: string;

  @IsOptionalField()
  @IsString()
  @MaxLength(100)
  icon?: string;
}
