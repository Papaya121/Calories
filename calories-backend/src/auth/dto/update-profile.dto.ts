import { IsIn, IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsIn(['male', 'female'])
  biologicalSex!: 'male' | 'female';

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(350)
  weightKg!: number;

  @IsInt()
  @Min(100)
  @Max(250)
  heightCm!: number;

  @IsInt()
  @Min(14)
  @Max(100)
  ageYears!: number;

  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
  activityLevel!: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

  @IsIn(['lose', 'maintain', 'gain'])
  goalType!: 'lose' | 'maintain' | 'gain';
}
