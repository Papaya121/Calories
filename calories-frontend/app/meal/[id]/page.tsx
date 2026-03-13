'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { ScreenShell } from '@/components/screen-shell';
import {
  ApiError,
  deleteMeal,
  getApiErrorMessage,
  getMeal,
  updateMeal,
} from '@/lib/api';
import { formatDayTitle, formatTime, toDateKey } from '@/lib/date';
import { AnalyzeResult } from '@/lib/types';
import { useSessionStore } from '@/store/use-session-store';

type DraftState = Omit<AnalyzeResult, 'confidence' | 'estimatedWeightG'> & {
  comment: string;
};

const EMPTY_DRAFT: DraftState = {
  dishName: '',
  dishDescription: '',
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  comment: '',
};

export default function MealDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const mealId = Array.isArray(params.id) ? params.id[0] : params.id;
  const accessToken = useSessionStore((state) => state.accessToken);
  const lock = useSessionStore((state) => state.lock);

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');

  const mealQuery = useQuery({
    queryKey: ['meal', mealId],
    queryFn: () => getMeal(accessToken as string, mealId),
    enabled: Boolean(accessToken && mealId),
  });

  const mealDayKey = useMemo(() => {
    if (!mealQuery.data) return null;
    return toDateKey(mealQuery.data.eatenAt);
  }, [mealQuery.data]);

  useEffect(() => {
    if (mealQuery.error instanceof ApiError && mealQuery.error.status === 401) {
      lock();
    }
  }, [mealQuery.error, lock]);

  useEffect(() => {
    if (!mealQuery.data) {
      return;
    }

    setDraft({
      dishName: mealQuery.data.dishName,
      dishDescription: mealQuery.data.dishDescription,
      caloriesKcal: mealQuery.data.caloriesKcal,
      proteinG: mealQuery.data.proteinG,
      fatG: mealQuery.data.fatG,
      carbsG: mealQuery.data.carbsG,
      comment: mealQuery.data.comment,
    });
  }, [mealQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error('Нет активной сессии.');
      }

      return updateMeal(accessToken, mealId, {
        dishName: draft.dishName,
        dishDescription: draft.dishDescription,
        caloriesKcal: draft.caloriesKcal,
        proteinG: draft.proteinG,
        fatG: draft.fatG,
        carbsG: draft.carbsG,
        comment: draft.comment,
        isUserEdited: true,
      });
    },
    onSuccess: (meal) => {
      queryClient.setQueryData(['meal', meal.id], meal);
      if (mealDayKey) {
        queryClient.invalidateQueries({ queryKey: ['day', mealDayKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setError('');
      setSavedMessage('Сохранено');
      window.setTimeout(() => setSavedMessage(''), 1400);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        lock();
      }
      setError(getApiErrorMessage(err, 'Не удалось сохранить изменения.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error('Нет активной сессии.');
      }

      await deleteMeal(accessToken, mealId);
    },
    onSuccess: () => {
      if (mealDayKey) {
        queryClient.invalidateQueries({ queryKey: ['day', mealDayKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.removeQueries({ queryKey: ['meal', mealId] });
      router.replace('/today');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        lock();
      }
      setError(getApiErrorMessage(err, 'Не удалось удалить запись.'));
    },
  });

  const notFound = useMemo(() => {
    return mealQuery.error instanceof ApiError && mealQuery.error.status === 404;
  }, [mealQuery.error]);

  if (notFound) {
    return (
      <AuthGate>
        <ScreenShell title="Запись не найдена" subtitle="Возможно, она была удалена" showNav={false}>
          <Link href="/today" className="rounded-2xl bg-accent px-4 py-3 text-center text-sm font-medium text-white">
            Вернуться на сегодня
          </Link>
        </ScreenShell>
      </AuthGate>
    );
  }

  const meal = mealQuery.data;

  const onSave = () => {
    setSavedMessage('');
    setError('');
    updateMutation.mutate();
  };

  const onDelete = () => {
    const confirmed = window.confirm('Удалить запись?');
    if (!confirmed) {
      return;
    }

    setSavedMessage('');
    setError('');
    deleteMutation.mutate();
  };

  return (
    <AuthGate>
      <ScreenShell
        title={meal?.dishName || 'Запись'}
        subtitle={meal ? `${formatDayTitle(meal.eatenAt)}, ${formatTime(meal.eatenAt)}` : 'Загружаем...'}
        showNav={false}
      >
        {mealQuery.isLoading ? (
          <div className="rounded-3xl border border-white/80 bg-card p-4 text-sm text-subtext shadow-card">
            Загружаем запись...
          </div>
        ) : null}

        {mealQuery.isError && !notFound ? (
          <div className="rounded-3xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger shadow-card">
            Не удалось загрузить запись.
          </div>
        ) : null}

        {meal ? (
          <>
            <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
              <Image
                src={meal.photoUrl}
                alt={meal.dishName}
                width={900}
                height={520}
                unoptimized
                className="h-52 w-full rounded-2xl object-cover"
              />
              <p className="mt-3 text-xs text-subtext">
                Уверенность AI: {Math.round(meal.confidence * 100)}%{' '}
                {meal.isUserEdited ? '· изменено вручную' : ''}
              </p>
            </div>

            <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
              <div className="grid gap-3">
                <label className="text-sm text-subtext">
                  Название
                  <input
                    value={draft.dishName}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, dishName: event.target.value }))
                    }
                    className="mt-1"
                  />
                </label>
                <label className="text-sm text-subtext">
                  Описание
                  <textarea
                    rows={2}
                    value={draft.dishDescription}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, dishDescription: event.target.value }))
                    }
                    className="mt-1 resize-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-subtext">
                    Ккал
                    <input
                      type="number"
                      value={draft.caloriesKcal}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, caloriesKcal: Number(event.target.value) || 0 }))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm text-subtext">
                    Белки
                    <input
                      type="number"
                      value={draft.proteinG}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, proteinG: Number(event.target.value) || 0 }))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm text-subtext">
                    Жиры
                    <input
                      type="number"
                      value={draft.fatG}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, fatG: Number(event.target.value) || 0 }))
                      }
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm text-subtext">
                    Углеводы
                    <input
                      type="number"
                      value={draft.carbsG}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, carbsG: Number(event.target.value) || 0 }))
                      }
                      className="mt-1"
                    />
                  </label>
                </div>

                <label className="text-sm text-subtext">
                  Комментарий
                  <textarea
                    rows={3}
                    value={draft.comment}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, comment: event.target.value }))
                    }
                    className="mt-1 resize-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={updateMutation.isPending || deleteMutation.isPending}
                  className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={updateMutation.isPending || deleteMutation.isPending}
                  className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger transition-all duration-200 ease-ios hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMutation.isPending ? 'Удаляем...' : 'Удалить'}
                </button>
              </div>

              {savedMessage ? <p className="mt-2 text-xs text-subtext">{savedMessage}</p> : null}
            </div>

            <Link
              href="/today"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-muted px-4 py-3 text-sm font-medium text-text"
            >
              Назад к дню
            </Link>
          </>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        ) : null}
      </ScreenShell>
    </AuthGate>
  );
}
