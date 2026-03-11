import { ActivityLevel, BiologicalSex, CalorieTargets } from '@/lib/types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateCalorieTargets(input: {
  biologicalSex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activityLevel: ActivityLevel;
}): CalorieTargets {
  const sexAdjustment = input.biologicalSex === 'male' ? 5 : -161;
  const bmr =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * input.ageYears +
    sexAdjustment;
  const maintain = roundToNearestTen(
    bmr * ACTIVITY_MULTIPLIERS[input.activityLevel],
  );
  const minLose = input.biologicalSex === 'male' ? 1400 : 1200;
  const lose = Math.max(minLose, roundToNearestTen(maintain * 0.85));
  const gain = roundToNearestTen(maintain * 1.15);

  return {
    lose,
    maintain,
    gain,
  };
}

function roundToNearestTen(value: number): number {
  return Math.round(value / 10) * 10;
}
