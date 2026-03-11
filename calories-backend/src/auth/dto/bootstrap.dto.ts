import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class BootstrapDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passcode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
