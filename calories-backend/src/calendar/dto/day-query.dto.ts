import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DayQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tzOffsetMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeZone?: string;
}
