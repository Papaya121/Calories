export type MealEntry = {
  id: string;
  eatenAt: string;
  comment: string;
  dishName: string;
  dishDescription: string;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: number;
  photoUrl: string;
  isUserEdited: boolean;
};

export type AnalyzeResult = {
  dishName: string;
  dishDescription: string;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: number;
};

export type AnalyzeMealResponse = AnalyzeResult & {
  aiModel: string;
  needsUserConfirmation: boolean;
  photoPath: string;
  isStub: boolean;
  userId: string;
};

export type MacroTotals = {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealsCount: number;
};

export type SessionUser = {
  id: string;
  displayName: string | null;
  isActive: boolean;
};

export type AuthSession = {
  accessToken: string;
  accessExpiresInSec: number;
  user: SessionUser;
};

export type DayDetailsResponse = {
  date: string;
  totals: MacroTotals;
  meals: MealEntry[];
};

export type CalendarDaySummary = MacroTotals & {
  date: string;
};

export type CalendarRangeResponse = {
  from: string;
  to: string;
  days: CalendarDaySummary[];
};
