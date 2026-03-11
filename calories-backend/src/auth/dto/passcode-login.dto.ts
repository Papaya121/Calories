import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class PasscodeLoginDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passcode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
