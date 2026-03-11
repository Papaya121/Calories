'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, getCalendarRange, getDayDetails } from '@/lib/api';
import { AuthGate } from '@/components/auth-gate';
import { MealCard } from '@/components/meal-card';
import { ScreenShell } from '@/components/screen-shell';
import { formatMonthLabel, toDateKey } from '@/lib/date';
import { useSessionStore } from '@/store/use-session-store';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const EMPTY_TOTALS = {
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  mealsCount: 0,
};

function shiftMonth(base: Date, amount: number): Date {
  const next = new Date(base);
  next.setMonth(base.getMonth() + amount, 1);
  return next;
}

function buildMonthGrid(month: Date): Array<{ date: Date; key: string; isCurrentMonth: boolean }> {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      isCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const accessToken = useSessionStore((state) => state.accessToken);
  const lock = useSessionStore((state) => state.lock);

  const monthGrid = useMemo(() => buildMonthGrid(month), [month]);
  const rangeFrom = monthGrid[0]?.key || selectedDate;
  const rangeTo = monthGrid[monthGrid.length - 1]?.key || selectedDate;

  const calendarQuery = useQuery({
    queryKey: ['calendar', rangeFrom, rangeTo],
    queryFn: () => getCalendarRange(accessToken as string, rangeFrom, rangeTo),
    enabled: Boolean(accessToken),
  });

  const dayQuery = useQuery({
    queryKey: ['day', selectedDate],
    queryFn: () => getDayDetails(accessToken as string, selectedDate),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (calendarQuery.error instanceof ApiError && calendarQuery.error.status === 401) {
      lock();
    }
  }, [calendarQuery.error, lock]);

  useEffect(() => {
    if (dayQuery.error instanceof ApiError && dayQuery.error.status === 401) {
      lock();
    }
  }, [dayQuery.error, lock]);

  const totalsByDate = useMemo(() => {
    const map = new Map<string, typeof EMPTY_TOTALS>();

    for (const day of calendarQuery.data?.days || []) {
      map.set(day.date, day);
    }

    return map;
  }, [calendarQuery.data?.days]);

  const selectedMeals = dayQuery.data?.meals || [];
  const selectedTotals = dayQuery.data?.totals || EMPTY_TOTALS;

  return (
    <AuthGate>
      <ScreenShell title="Календарь" subtitle="Суммы по дням и быстрый переход к записям">
        <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
              className="rounded-full bg-muted px-3 py-2 text-sm text-subtext transition-all duration-200 ease-ios hover:bg-slate-200"
            >
              ←
            </button>
            <h2 className="text-base font-medium capitalize">{formatMonthLabel(month)}</h2>
            <button
              type="button"
              onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
              className="rounded-full bg-muted px-3 py-2 text-sm text-subtext transition-all duration-200 ease-ios hover:bg-slate-200"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="pb-1 text-center text-xs font-medium text-subtext">
                {day}
              </div>
            ))}
            {monthGrid.map((cell) => {
              const totals = totalsByDate.get(cell.key) || EMPTY_TOTALS;
              const isSelected = cell.key === selectedDate;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.key)}
                  className={`min-h-16 rounded-2xl border px-1 py-2 text-center transition-all duration-200 ease-ios ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent bg-muted/65 hover:border-slate-200'
                  } ${cell.isCurrentMonth ? 'text-text' : 'text-subtext/50'}`}
                >
                  <div className="text-xs font-medium">{cell.date.getDate()}</div>
                  {totals.mealsCount > 0 ? (
                    <>
                      <div className="mt-1 text-[10px] font-semibold text-accent">{totals.caloriesKcal} ккал</div>
                      <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                    </>
                  ) : (
                    <div className="mt-2 text-[10px] text-subtext/60">-</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">{selectedDate}</h3>
            <p className="text-xs text-subtext">{selectedTotals.caloriesKcal} ккал</p>
          </div>

          {dayQuery.isLoading ? (
            <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-subtext">Загружаем записи дня...</p>
          ) : null}

          {dayQuery.isError ? (
            <p className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-4 text-sm text-danger">
              Не удалось загрузить выбранный день.
            </p>
          ) : null}

          {!dayQuery.isLoading && !dayQuery.isError && selectedMeals.length === 0 ? (
            <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-subtext">В этот день нет записей.</p>
          ) : null}

          {!dayQuery.isLoading && !dayQuery.isError && selectedMeals.length > 0 ? (
            <div className="space-y-3">
              {selectedMeals.map((meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          ) : null}
        </div>
      </ScreenShell>
    </AuthGate>
  );
}
