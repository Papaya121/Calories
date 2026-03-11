import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeMealDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  comment?: string;
}
