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
    tzOffsetMinutes = 0,
    timeZone?: string,
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
    const meals = await this.mealsService.getMealsInRange(
      userId,
      from,
      to,
      tzOffsetMinutes,
      timeZone,
    );
    const dayMap = new Map<string, MacroTotals>();

    for (const meal of meals) {
      const dayKey = this.toClientDayKey(
        meal.eatenAt,
        tzOffsetMinutes,
        timeZone,
      );
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
    tzOffsetMinutes = 0,
    timeZone?: string,
  ): Promise<{
    date: string;
    totals: MacroTotals;
    meals: Awaited<ReturnType<MealsService['getMealsByDate']>>;
  }> {
    const meals = await this.mealsService.getMealsByDate(
      userId,
      date,
      tzOffsetMinutes,
      timeZone,
    );

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

  private toClientDayKey(
    value: Date,
    tzOffsetMinutes: number,
    timeZone?: string,
  ): string {
    if (timeZone) {
      return this.toDayKeyInTimeZone(value, timeZone);
    }

    const adjusted = new Date(value.getTime() - tzOffsetMinutes * 60_000);
    return adjusted.toISOString().slice(0, 10);
  }

  private toDayKeyInTimeZone(value: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      return value.toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  }
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}
