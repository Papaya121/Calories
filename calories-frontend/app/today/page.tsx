'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';

import { authLogout, ApiError, getDayDetails } from '@/lib/api';
import { AuthGate } from '@/components/auth-gate';
import { MacroGrid } from '@/components/macro-grid';
import { MealCard } from '@/components/meal-card';
import { ScreenShell } from '@/components/screen-shell';
import { formatDayTitle, toDateKey } from '@/lib/date';
import { useSessionStore } from '@/store/use-session-store';

const EMPTY_TOTALS = {
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  mealsCount: 0,
};

export default function TodayPage() {
  const todayKey = toDateKey(new Date());
  const accessToken = useSessionStore((state) => state.accessToken);
  const lock = useSessionStore((state) => state.lock);

  const dayQuery = useQuery({
    queryKey: ['day', todayKey],
    queryFn: () => getDayDetails(accessToken as string, todayKey),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (dayQuery.error instanceof ApiError && dayQuery.error.status === 401) {
      lock();
    }
  }, [dayQuery.error, lock]);

  const meals = dayQuery.data?.meals || [];
  const totals = dayQuery.data?.totals || EMPTY_TOTALS;

  const handleLock = () => {
    authLogout().catch(() => undefined);
    lock();
  };

  return (
    <AuthGate>
      <ScreenShell title="Сегодня" subtitle={formatDayTitle(new Date())}>
        <div className="flex items-center justify-between rounded-3xl border border-white/80 bg-card px-4 py-3 shadow-card">
          <p className="text-sm text-subtext">Записей за день: {totals.mealsCount}</p>
          <button
            onClick={handleLock}
            className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-subtext transition-all duration-200 ease-ios hover:bg-slate-200"
          >
            Заблокировать
          </button>
        </div>

        <MacroGrid
          calories={totals.caloriesKcal}
          protein={totals.proteinG}
          fat={totals.fatG}
          carbs={totals.carbsG}
        />

        <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium">Приёмы пищи</h2>
            <Link
              href="/add"
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition-all duration-200 ease-ios hover:brightness-110"
            >
              + Добавить
            </Link>
          </div>

          {dayQuery.isLoading ? (
            <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-subtext">Загружаем записи...</p>
          ) : null}

          {dayQuery.isError ? (
            <p className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-4 text-sm text-danger">
              Не удалось загрузить день. Проверьте backend и попробуйте снова.
            </p>
          ) : null}

          {!dayQuery.isLoading && !dayQuery.isError && meals.length === 0 ? (
            <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-subtext">
              Пока пусто. Добавьте первое фото еды.
            </p>
          ) : null}

          {!dayQuery.isLoading && !dayQuery.isError && meals.length > 0 ? (
            <div className="space-y-3">
              {meals.map((meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          ) : null}
        </div>
      </ScreenShell>
    </AuthGate>
  );
}
