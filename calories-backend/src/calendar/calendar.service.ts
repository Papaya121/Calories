import { Injectable } from '@nestjs/common';
import { MealsService } from '../meals/meals.service';

export type MacroTotals = {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealsCount: number;
};

@Injectable()
export class CalendarService {
  constructor(private readonly mealsService: MealsService) {}

  async getCalendarRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<{
    from: string;
    to: string;
    days: Array<{
      date: string;
      caloriesKcal: number;
      proteinG: number;
      fatG: number;
      carbsG: number;
      mealsCount: number;
    }>;
  }> {
    const meals = await this.mealsService.getMealsInRange(userId, from, to);
    const dayMap = new Map<string, MacroTotals>();

    for (const meal of meals) {
      const dayKey = meal.eatenAt.toISOString().slice(0, 10);
      const current = dayMap.get(dayKey) ?? {
        caloriesKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        mealsCount: 0,
      };

      current.caloriesKcal += meal.caloriesKcal;
      current.proteinG += Number(meal.proteinG);
      current.fatG += Number(meal.fatG);
      current.carbsG += Number(meal.carbsG);
      current.mealsCount += 1;

      dayMap.set(dayKey, current);
    }

    const days = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, totals]) => ({
        date,
        caloriesKcal: Math.round(totals.caloriesKcal),
        proteinG: roundToOne(totals.proteinG),
        fatG: roundToOne(totals.fatG),
        carbsG: roundToOne(totals.carbsG),
        mealsCount: totals.mealsCount,
      }));

    return {
      from,
      to,
      days,
    };
  }

  async getDayDetails(
    userId: string,
    date: string,
  ): Promise<{
    date: string;
    totals: MacroTotals;
    meals: Awaited<ReturnType<MealsService['getMealsByDate']>>;
  }> {
    const meals = await this.mealsService.getMealsByDate(userId, date);

    const totals = meals.reduce<MacroTotals>(
      (acc, meal) => {
        acc.caloriesKcal += meal.caloriesKcal;
        acc.proteinG += meal.proteinG;
        acc.fatG += meal.fatG;
        acc.carbsG += meal.carbsG;
        acc.mealsCount += 1;
        return acc;
      },
      {
        caloriesKcal: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        mealsCount: 0,
      },
    );

    return {
      date,
      totals: {
        caloriesKcal: Math.round(totals.caloriesKcal),
        proteinG: roundToOne(totals.proteinG),
        fatG: roundToOne(totals.fatG),
        carbsG: roundToOne(totals.carbsG),
        mealsCount: totals.mealsCount,
      },
      meals,
    };
  }
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}
