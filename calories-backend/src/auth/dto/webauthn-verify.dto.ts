import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class WebauthnVerifyDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @IsString()
  @MaxLength(300)
  assertionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
