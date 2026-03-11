'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useMemo, useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { ScreenShell } from '@/components/screen-shell';
import { SkeletonAnalyze } from '@/components/skeleton-analyze';
import {
  analyzeMeal,
  ApiError,
  createMeal,
  getApiErrorMessage,
} from '@/lib/api';
import { AnalyzeResult } from '@/lib/types';
import { useSessionStore } from '@/store/use-session-store';

const EMPTY_RESULT: AnalyzeResult = {
  dishName: '',
  dishDescription: '',
  caloriesKcal: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  estimatedWeightG: 0,
  confidence: 0,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

export default function AddMealPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const lock = useSessionStore((state) => state.lock);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzedPhotoPath, setAnalyzedPhotoPath] = useState<string | null>(null);
  const [analyzedAiModel, setAnalyzedAiModel] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [result, setResult] = useState<AnalyzeResult>(EMPTY_RESULT);
  const [hasResult, setHasResult] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const [error, setError] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !photoFile) {
        throw new Error('Нет активной сессии или фото для анализа.');
      }

      return analyzeMeal(accessToken, {
        photo: photoFile,
        comment,
      });
    },
    onSuccess: (data) => {
      setResult({
        dishName: data.dishName,
        dishDescription: data.dishDescription,
        caloriesKcal: data.caloriesKcal,
        proteinG: data.proteinG,
        fatG: data.fatG,
        carbsG: data.carbsG,
        estimatedWeightG: data.estimatedWeightG,
        confidence: data.confidence,
      });
      setAnalyzedPhotoPath(data.photoPath);
      setAnalyzedAiModel(data.aiModel || null);
      setHasResult(true);
      setIsEdited(false);
      setError('');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        lock();
      }

      setError(
        getApiErrorMessage(err, 'Не удалось выполнить AI-анализ. Попробуйте снова.'),
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !analyzedPhotoPath) {
        throw new Error('Сессия недоступна или фото не проанализировано.');
      }

      return createMeal(accessToken, {
        eatenAt: new Date().toISOString(),
        comment: comment.trim() || undefined,
        dishName: result.dishName,
        dishDescription: result.dishDescription,
        caloriesKcal: result.caloriesKcal,
        proteinG: result.proteinG,
        fatG: result.fatG,
        carbsG: result.carbsG,
        confidence: result.confidence,
        photoPath: analyzedPhotoPath,
        aiModel: analyzedAiModel || undefined,
        isUserEdited: isEdited,
      });
    },
    onSuccess: (meal) => {
      queryClient.invalidateQueries({ queryKey: ['day'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      router.push(`/meal/${meal.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        lock();
      }

      setError(
        getApiErrorMessage(err, 'Не удалось сохранить запись. Попробуйте снова.'),
      );
    },
  });

  const confidencePercent = useMemo(
    () => Math.round(result.confidence * 100),
    [result.confidence],
  );
  const estimatedWeightG = useMemo(
    () => {
      const parsed = Number(result.estimatedWeightG);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
      }

      return Math.round(parsed);
    },
    [result.estimatedWeightG],
  );
  const macrosPer100g = useMemo(() => {
    if (estimatedWeightG <= 0) {
      return null;
    }

    const factor = 100 / estimatedWeightG;
    const roundOne = (value: number) => Math.round(value * factor * 10) / 10;

    return {
      caloriesKcal: Math.round(result.caloriesKcal * factor),
      proteinG: roundOne(result.proteinG),
      fatG: roundOne(result.fatG),
      carbsG: roundOne(result.carbsG),
    };
  }, [
    estimatedWeightG,
    result.caloriesKcal,
    result.proteinG,
    result.fatG,
    result.carbsG,
  ]);

  const onPhotoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoFile(file);
      setPhotoPreview(dataUrl);
      setHasResult(false);
      setResult(EMPTY_RESULT);
      setAnalyzedPhotoPath(null);
      setAnalyzedAiModel(null);
      setError('');
    } catch {
      setError('Не удалось прочитать фото. Попробуйте другое изображение.');
    }
  };

  const onAnalyze = () => {
    if (!photoFile) {
      setError('Добавьте фото блюда перед анализом.');
      return;
    }

    analyzeMutation.mutate();
  };

  const onFieldUpdate = (field: keyof AnalyzeResult, value: string) => {
    setIsEdited(true);
    setResult((prev) => {
      if (field === 'dishName' || field === 'dishDescription') {
        return {
          ...prev,
          [field]: value,
        };
      }

      const parsed = Number(value);
      return {
        ...prev,
        [field]: Number.isFinite(parsed) ? parsed : 0,
      };
    });
  };

  const onSave = () => {
    if (!hasResult || !analyzedPhotoPath) {
      setError('Сначала выполните анализ блюда.');
      return;
    }

    saveMutation.mutate();
  };

  const isPending = analyzeMutation.isPending || saveMutation.isPending;

  return (
    <AuthGate>
      <ScreenShell
        title="Добавление еды"
        subtitle="Фото + комментарий, затем AI-оценка и ручная правка"
      >
        <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
          <label className="block text-sm font-medium text-text">Фото блюда</label>
          <label className="mt-3 flex h-44 cursor-pointer items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-muted/70">
            {photoPreview ? (
              <span className="relative block h-full w-full">
                <Image
                  src={photoPreview}
                  alt="Фото блюда"
                  fill
                  unoptimized
                  sizes="(max-width: 460px) 100vw, 460px"
                  className="rounded-3xl object-cover"
                />
              </span>
            ) : (
              <div className="text-center text-sm text-subtext">
                <p className="font-medium">Нажмите, чтобы выбрать фото</p>
                <p className="mt-1 text-xs">Фото будет отправлено на backend для анализа</p>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
          </label>

          <label className="mt-4 block text-sm text-subtext">
            Комментарий (опционально)
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Например: большая порция, добавлен сыр"
              rows={3}
              className="mt-1 resize-none"
            />
          </label>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isPending}
            className="mt-4 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzeMutation.isPending ? 'Анализируем...' : 'Запустить AI-анализ'}
          </button>
        </div>

        {analyzeMutation.isPending ? <SkeletonAnalyze /> : null}

        {hasResult ? (
          <div className="rounded-3xl border border-white/80 bg-card p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium">Предпросмотр результата</h2>
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-subtext">
                Уверенность AI: {confidencePercent}%
              </span>
            </div>

            <div className="grid gap-3">
              <label className="text-sm text-subtext">
                Название блюда
                <input
                  value={result.dishName}
                  onChange={(event) => onFieldUpdate('dishName', event.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-subtext">
                Описание
                <textarea
                  value={result.dishDescription}
                  onChange={(event) => onFieldUpdate('dishDescription', event.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </label>

              <p className="text-sm font-medium text-text">
                {estimatedWeightG > 0 ? `~${estimatedWeightG} г` : '~? г'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-subtext">
                  Ккал
                  <input
                    type="number"
                    value={result.caloriesKcal}
                    onChange={(event) => onFieldUpdate('caloriesKcal', event.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm text-subtext">
                  Белки
                  <input
                    type="number"
                    value={result.proteinG}
                    onChange={(event) => onFieldUpdate('proteinG', event.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm text-subtext">
                  Жиры
                  <input
                    type="number"
                    value={result.fatG}
                    onChange={(event) => onFieldUpdate('fatG', event.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-sm text-subtext">
                  Углеводы
                  <input
                    type="number"
                    value={result.carbsG}
                    onChange={(event) => onFieldUpdate('carbsG', event.target.value)}
                    className="mt-1"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={onSave}
              className="mt-4 w-full rounded-2xl bg-text px-4 py-3 text-sm font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить запись'}
            </button>

            {macrosPer100g ? (
              <p className="mt-2 text-[11px] text-subtext">
                На 100 г: {macrosPer100g.caloriesKcal} ккал · Б {macrosPer100g.proteinG} г · Ж{' '}
                {macrosPer100g.fatG} г · У {macrosPer100g.carbsG} г
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/80 bg-card p-4 text-xs text-subtext shadow-card">
          Оценка КБЖУ по фото приблизительная. Перед сохранением всегда можно скорректировать поля.
        </div>

        {error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        ) : null}
      </ScreenShell>
    </AuthGate>
  );
}
