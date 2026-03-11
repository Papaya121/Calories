import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMealDto {
  @IsOptional()
  @IsDateString()
  eatenAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  comment?: string;

  @IsString()
  @MaxLength(180)
  dishName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  dishDescription?: string;

  @IsNumber()
  @Min(0)
  @Max(10000)
  caloriesKcal!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  proteinG!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  fatG!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  carbsG!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsString()
  @MaxLength(500)
  photoPath!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  aiModel?: string;

  @IsOptional()
  @IsBoolean()
  isUserEdited?: boolean;
}
