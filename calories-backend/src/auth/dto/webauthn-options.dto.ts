import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WebauthnOptionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usernameHint?: string;
}
