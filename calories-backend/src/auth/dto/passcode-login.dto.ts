import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class PasscodeLoginDto {
  @IsString()
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passcode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
