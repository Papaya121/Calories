import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WebauthnVerifyDto {
  @IsString()
  @MaxLength(300)
  assertionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
