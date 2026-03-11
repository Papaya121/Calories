'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { calculateCalorieTargets } from '@/lib/calorie-targets';
import {
  ActivityLevel,
  BiologicalSex,
  CalorieTargets,
  GoalType,
  UserProfile,
} from '@/lib/types';

type ProfileSettingsFormProps = {
  profile: UserProfile | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (payload: {
    biologicalSex: BiologicalSex;
    weightKg: number;
    heightCm: number;
    ageYears: number;
    activityLevel: ActivityLevel;
    goalType: GoalType;
  }) => void;
};

const WEIGHT_REGEX = /^\d{1,3}([.,]\d)?$/;
const HEIGHT_REGEX = /^\d{2,3}$/;
const AGE_REGEX = /^\d{1,3}$/;

const ACTIVITY_OPTIONS: Array<{
  value: ActivityLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'sedentary',
    label: 'Минимальная',
    description: 'Сидячая работа, почти нет тренировок',
  },
  {
    value: 'light',
    label: 'Лёгкая',
    description: '1-3 тренировки в неделю',
  },
  {
    value: 'moderate',
    label: 'Средняя',
    description: '3-5 тренировок в неделю',
  },
  {
    value: 'active',
    label: 'Высокая',
    description: '6-7 тренировок в неделю',
  },
  {
    value: 'very_active',
    label: 'Очень высокая',
    description: 'Тяжёлые ежедневные нагрузки',
  },
];

const GOAL_OPTIONS: Array<{
  value: GoalType;
  label: string;
  description: string;
}> = [
  {
    value: 'lose',
    label: 'Похудение',
    description: 'Дефицит калорий',
  },
  {
    value: 'maintain',
    label: 'Поддержание',
    description: 'Стабильный вес',
  },
  {
    value: 'gain',
    label: 'Набор',
    description: 'Профицит калорий',
  },
];

export function ProfileSettingsForm({
  profile,
  isPending,
  submitLabel,
  onSubmit,
}: ProfileSettingsFormProps) {
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(
    profile?.biologicalSex ?? null,
  );
  const [weightKg, setWeightKg] = useState(
    profile?.weightKg ? String(profile.weightKg) : '',
  );
  const [heightCm, setHeightCm] = useState(
    profile?.heightCm ? String(profile.heightCm) : '',
  );
  const [ageYears, setAgeYears] = useState(
    profile?.ageYears ? String(profile.ageYears) : '',
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    profile?.activityLevel ?? null,
  );
  const [goalType, setGoalType] = useState<GoalType | null>(
    profile?.goalType ?? null,
  );
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setBiologicalSex(profile?.biologicalSex ?? null);
    setWeightKg(profile?.weightKg ? String(profile.weightKg) : '');
    setHeightCm(profile?.heightCm ? String(profile.heightCm) : '');
    setAgeYears(profile?.ageYears ? String(profile.ageYears) : '');
    setActivityLevel(profile?.activityLevel ?? null);
    setGoalType(profile?.goalType ?? null);
  }, [
    profile?.activityLevel,
    profile?.ageYears,
    profile?.biologicalSex,
    profile?.goalType,
    profile?.heightCm,
    profile?.weightKg,
  ]);

  const parsedWeight = useMemo(() => {
    const normalized = weightKg.replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : NaN;
  }, [weightKg]);

  const parsedHeight = useMemo(() => {
    const value = Number(heightCm);
    return Number.isFinite(value) ? value : NaN;
  }, [heightCm]);

  const parsedAge = useMemo(() => {
    const value = Number(ageYears);
    return Number.isFinite(value) ? value : NaN;
  }, [ageYears]);

  const previewTargets = useMemo<CalorieTargets | null>(() => {
    if (!biologicalSex || !activityLevel) {
      return null;
    }

    if (
      !Number.isFinite(parsedWeight) ||
      !Number.isFinite(parsedHeight) ||
      !Number.isFinite(parsedAge) ||
      parsedWeight < 30 ||
      parsedWeight > 350 ||
      parsedHeight < 100 ||
      parsedHeight > 250 ||
      parsedAge < 14 ||
      parsedAge > 100
    ) {
      return null;
    }

    return calculateCalorieTargets({
      biologicalSex,
      weightKg: parsedWeight,
      heightCm: Math.round(parsedHeight),
      ageYears: Math.round(parsedAge),
      activityLevel,
    });
  }, [activityLevel, biologicalSex, parsedAge, parsedHeight, parsedWeight]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }

    if (!biologicalSex) {
      setLocalError('Выберите пол.');
      return;
    }

    if (!activityLevel) {
      setLocalError('Выберите уровень активности.');
      return;
    }

    if (!goalType) {
      setLocalError('Выберите цель.');
      return;
    }

    if (!WEIGHT_REGEX.test(weightKg.trim())) {
      setLocalError('Вес должен быть в формате 70 или 70.5');
      return;
    }

    if (!HEIGHT_REGEX.test(heightCm.trim())) {
      setLocalError('Рост должен быть целым числом в см.');
      return;
    }

    if (!AGE_REGEX.test(ageYears.trim())) {
      setLocalError('Возраст должен быть целым числом.');
      return;
    }

    const normalizedWeight = Number(weightKg.replace(',', '.'));
    const normalizedHeight = Number(heightCm);
    const normalizedAge = Number(ageYears);

    if (normalizedWeight < 30 || normalizedWeight > 350) {
      setLocalError('Введите вес от 30 до 350 кг.');
      return;
    }

    if (normalizedHeight < 100 || normalizedHeight > 250) {
      setLocalError('Введите рост от 100 до 250 см.');
      return;
    }

    if (normalizedAge < 14 || normalizedAge > 100) {
      setLocalError('Введите возраст от 14 до 100 лет.');
      return;
    }

    setLocalError('');
    onSubmit({
      biologicalSex,
      weightKg: Number(normalizedWeight.toFixed(1)),
      heightCm: Math.round(normalizedHeight),
      ageYears: Math.round(normalizedAge),
      activityLevel,
      goalType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-subtext">Пол</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setLocalError('');
              setBiologicalSex('male');
            }}
            className={`rounded-2xl border px-3 py-3 text-sm transition-all duration-200 ease-ios ${
              biologicalSex === 'male'
                ? 'border-accent bg-accent text-white shadow-soft'
                : 'border-white/80 bg-white text-subtext hover:bg-muted'
            }`}
          >
            Мужской
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setLocalError('');
              setBiologicalSex('female');
            }}
            className={`rounded-2xl border px-3 py-3 text-sm transition-all duration-200 ease-ios ${
              biologicalSex === 'female'
                ? 'border-accent bg-accent text-white shadow-soft'
                : 'border-white/80 bg-white text-subtext hover:bg-muted'
            }`}
          >
            Женский
          </button>
        </div>
      </div>

      <label className="block text-sm text-subtext">
        Вес (кг)
        <input
          inputMode="decimal"
          value={weightKg}
          onChange={(event) => {
            setLocalError('');
            setWeightKg(event.target.value.replace(/[^\d.,]/g, ''));
          }}
          placeholder="Например, 72.5"
          className="mt-1"
        />
      </label>

      <label className="block text-sm text-subtext">
        Рост (см)
        <input
          inputMode="numeric"
          value={heightCm}
          onChange={(event) => {
            setLocalError('');
            setHeightCm(event.target.value.replace(/\D/g, ''));
          }}
          placeholder="Например, 178"
          className="mt-1"
        />
      </label>

      <label className="block text-sm text-subtext">
        Возраст (полных лет)
        <input
          inputMode="numeric"
          value={ageYears}
          onChange={(event) => {
            setLocalError('');
            setAgeYears(event.target.value.replace(/\D/g, ''));
          }}
          placeholder="Например, 29"
          className="mt-1"
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm text-subtext">Цель</p>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_OPTIONS.map((option) => {
            const isSelected = goalType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setLocalError('');
                  setGoalType(option.value);
                }}
                className={`rounded-2xl border px-3 py-3 text-center transition-all duration-200 ease-ios ${
                  isSelected
                    ? 'border-accent bg-accent text-white shadow-soft'
                    : 'border-white/80 bg-white text-subtext hover:bg-muted'
                }`}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    isSelected ? 'text-white/85' : 'text-subtext'
                  }`}
                >
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-subtext">Уровень активности</p>
        <div className="grid gap-2">
          {ACTIVITY_OPTIONS.map((option) => {
            const isSelected = activityLevel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setLocalError('');
                  setActivityLevel(option.value);
                }}
                className={`rounded-2xl border px-3 py-3 text-left transition-all duration-200 ease-ios ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-soft'
                    : 'border-white/80 bg-white hover:bg-muted'
                }`}
              >
                <p className="text-sm font-medium text-text">{option.label}</p>
                <p className="mt-1 text-xs text-subtext">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/80 bg-muted/60 p-3 text-xs text-subtext">
        Формула:
        <br />
        BMR = 10 x вес + 6.25 x рост - 5 x возраст + поправка пола
        <br />
        Поддержание = BMR x коэффициент активности (1.2 .. 1.9)
        <br />
        Поправка пола: +5 (мужской), -161 (женский)
        <br />
        Похудение = поддержание -15%, набор = поддержание +15%, округление до 10 ккал
      </div>

      {previewTargets ? (
        <div className="grid grid-cols-3 gap-2">
          <TargetCard label="Похудение" value={previewTargets.lose} />
          <TargetCard label="Поддержание" value={previewTargets.maintain} />
          <TargetCard label="Набор" value={previewTargets.gain} />
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>

      {localError ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          {localError}
        </div>
      ) : null}
    </form>
  );
}

function TargetCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-card px-3 py-3 text-center shadow-card">
      <p className="text-[11px] text-subtext">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value} ккал</p>
    </div>
  );
}
