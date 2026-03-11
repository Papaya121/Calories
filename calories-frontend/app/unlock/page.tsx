'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

import { ScreenShell } from '@/components/screen-shell';
import {
  authBootstrap,
  authPasscodeLogin,
  authWebauthnVerify,
  getApiErrorMessage,
} from '@/lib/api';
import { useSessionStore } from '@/store/use-session-store';

const PASSCODE_REGEX = /^\d{6}$/;

function getDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'web-client';
  }

  const platform = navigator.platform || 'web';
  const language = navigator.language || 'ru';
  return `${platform} (${language})`.slice(0, 160);
}

function buildAssertionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `webauthn-${Date.now()}`;
}

export default function UnlockPage() {
  const router = useRouter();
  const passcode = useSessionStore((state) => state.passcode);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const biometricEnabled = useSessionStore((state) => state.biometricEnabled);
  const setPasscode = useSessionStore((state) => state.setPasscode);
  const setAuthSession = useSessionStore((state) => state.setAuthSession);
  const toggleBiometrics = useSessionStore((state) => state.toggleBiometrics);

  const isSetupMode = useMemo(() => !passcode, [passcode]);

  const [draftPasscode, setDraftPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [error, setError] = useState('');

  const bootstrapMutation = useMutation({
    mutationFn: async (nextPasscode: string) =>
      authBootstrap({
        passcode: nextPasscode,
        deviceName: getDeviceName(),
      }),
    onSuccess: (session, usedPasscode) => {
      setPasscode(usedPasscode);
      setAuthSession(session);
      router.replace('/today');
    },
    onError: (err) => {
      setError(
        getApiErrorMessage(
          err,
          'Не удалось создать профиль. Проверьте backend и попробуйте снова.',
        ),
      );
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (nextPasscode: string) =>
      authPasscodeLogin({
        passcode: nextPasscode,
        deviceName: getDeviceName(),
      }),
    onSuccess: (session) => {
      setAuthSession(session);
      router.replace('/today');
    },
    onError: (err) => {
      setError(
        getApiErrorMessage(err, 'Не удалось выполнить вход. Проверьте passcode.'),
      );
    },
  });

  const biometricMutation = useMutation({
    mutationFn: async () =>
      authWebauthnVerify({
        assertionId: buildAssertionId(),
        deviceName: getDeviceName(),
      }),
    onSuccess: (session) => {
      setAuthSession(session);
      router.replace('/today');
    },
    onError: (err) => {
      setError(
        getApiErrorMessage(
          err,
          'Биометрическая разблокировка не удалась. Используйте passcode.',
        ),
      );
    },
  });

  const isPending =
    bootstrapMutation.isPending ||
    loginMutation.isPending ||
    biometricMutation.isPending;

  if (!hasHydrated) {
    return (
      <ScreenShell title="Calories" subtitle="Проверяем состояние приложения" showNav={false}>
        <div className="rounded-3xl border border-white/80 bg-card p-6 text-sm text-subtext shadow-card">
          Загружаем настройки...
        </div>
      </ScreenShell>
    );
  }

  const handleSetupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!PASSCODE_REGEX.test(draftPasscode)) {
      setError('Нужен код ровно из 6 цифр.');
      return;
    }

    if (draftPasscode !== confirmPasscode) {
      setError('Коды не совпадают.');
      return;
    }

    bootstrapMutation.mutate(draftPasscode);
  };

  const handleUnlockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!PASSCODE_REGEX.test(loginPasscode)) {
      setError('Введите 6-значный код.');
      return;
    }

    loginMutation.mutate(loginPasscode);
  };

  const handleBiometric = () => {
    setError('');

    if (!biometricEnabled) {
      setError('Биометрия отключена. Включите её ниже.');
      return;
    }

    biometricMutation.mutate();
  };

  return (
    <ScreenShell
      title={isSetupMode ? 'Первый запуск' : 'Разблокировка'}
      subtitle={
        isSetupMode
          ? 'Создайте 6-значный passcode. Он сохранится на backend.'
          : 'Введите passcode или используйте Face ID / Touch ID.'
      }
      showNav={false}
    >
      <div className="rounded-3xl border border-white/90 bg-card p-5 shadow-card">
        {isSetupMode ? (
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <label className="block text-sm text-subtext">
              Passcode
              <input
                inputMode="numeric"
                maxLength={6}
                value={draftPasscode}
                onChange={(event) => setDraftPasscode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                type="password"
                autoComplete="new-password"
                className="mt-1"
              />
            </label>
            <label className="block text-sm text-subtext">
              Повторите passcode
              <input
                inputMode="numeric"
                maxLength={6}
                value={confirmPasscode}
                onChange={(event) => setConfirmPasscode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                type="password"
                autoComplete="new-password"
                className="mt-1"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-3 text-sm text-text">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={biometricEnabled}
                onChange={(event) => toggleBiometrics(event.target.checked)}
              />
              Включить Face ID / Touch ID
            </label>
            <button
              disabled={isPending}
              type="submit"
              className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bootstrapMutation.isPending ? 'Создаём профиль...' : 'Сохранить и открыть'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <label className="block text-sm text-subtext">
              Passcode
              <input
                inputMode="numeric"
                maxLength={6}
                value={loginPasscode}
                onChange={(event) => setLoginPasscode(event.target.value.replace(/\D/g, ''))}
                placeholder="Введите 6 цифр"
                type="password"
                autoComplete="current-password"
                className="mt-1"
              />
            </label>
            <button
              disabled={isPending}
              type="submit"
              className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending ? 'Проверяем...' : 'Разблокировать'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleBiometric}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-text transition-all duration-200 ease-ios hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {biometricMutation.isPending ? 'Проверяем Face ID / Touch ID...' : 'Face ID / Touch ID'}
            </button>
            <label className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-3 text-sm text-text">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={biometricEnabled}
                onChange={(event) => toggleBiometrics(event.target.checked)}
              />
              Биометрия активна
            </label>
          </form>
        )}
      </div>

      <div className="rounded-3xl border border-white/80 bg-card p-4 text-xs text-subtext shadow-card">
        КБЖУ в приложении являются оценкой AI и не являются медицинским измерением.
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      ) : null}
    </ScreenShell>
  );
}
