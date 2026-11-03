import { IsOptionalField } from './validation.decorators';
import { IsHexColor, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsHexColor()
  @IsOptionalField()
  color?: string;

  @IsString()
  @IsOptionalField()
  @MaxLength(100)
  icon?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptionalField()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsHexColor()
  @IsOptionalField()
  color?: string;

  @IsString()
  @IsOptionalField()
  @MaxLength(100)
  icon?: string;
}
