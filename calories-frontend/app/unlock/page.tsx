'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { ScreenShell } from '@/components/screen-shell';
import {
  authListAccounts,
  authBootstrap,
  authPasscodeLogin,
  authWebauthnVerify,
  getApiErrorMessage,
} from '@/lib/api';
import { AuthAccount, AuthSession } from '@/lib/types';
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

function getAccountLabel(account: AuthAccount, index: number): string {
  const trimmedName = account.displayName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return `Профиль ${index + 1}`;
}

export default function UnlockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedAccountId = useSessionStore((state) => state.selectedAccountId);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const biometricEnabled = useSessionStore((state) => state.biometricEnabled);
  const setSelectedAccountId = useSessionStore(
    (state) => state.setSelectedAccountId,
  );
  const setAuthSession = useSessionStore((state) => state.setAuthSession);
  const toggleBiometrics = useSessionStore((state) => state.toggleBiometrics);

  const [setupDisplayName, setSetupDisplayName] = useState('');
  const [setupPasscode, setSetupPasscode] = useState('');
  const [confirmSetupPasscode, setConfirmSetupPasscode] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [error, setError] = useState('');

  const applyAuthSession = (session: AuthSession) => {
    queryClient.removeQueries({ queryKey: ['profile'] });
    queryClient.removeQueries({ queryKey: ['day'] });
    queryClient.removeQueries({ queryKey: ['calendar'] });
    queryClient.removeQueries({ queryKey: ['meal'] });

    setSelectedAccountId(session.user.id);
    setAuthSession(session);
    router.replace('/profile-setup');
  };

  const accountsQuery = useQuery({
    queryKey: ['auth', 'accounts'],
    queryFn: authListAccounts,
    enabled: hasHydrated,
  });

  const bootstrapMutation = useMutation({
    mutationFn: async (payload: { passcode: string; displayName: string }) =>
      authBootstrap({
        passcode: payload.passcode,
        displayName: payload.displayName,
        deviceName: getDeviceName(),
      }),
    onSuccess: applyAuthSession,
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
    mutationFn: async (payload: { userId: string; passcode: string }) =>
      authPasscodeLogin({
        userId: payload.userId,
        passcode: payload.passcode,
        deviceName: getDeviceName(),
      }),
    onSuccess: applyAuthSession,
    onError: (err) => {
      setError(
        getApiErrorMessage(err, 'Не удалось выполнить вход. Проверьте PIN-код.'),
      );
    },
  });

  const biometricMutation = useMutation({
    mutationFn: async (userId: string) =>
      authWebauthnVerify({
        assertionId: buildAssertionId(),
        userId,
        deviceName: getDeviceName(),
      }),
    onSuccess: applyAuthSession,
    onError: (err) => {
      setError(
        getApiErrorMessage(
          err,
          'Биометрическая разблокировка не удалась. Используйте PIN-код.',
        ),
      );
    },
  });

  const isPending =
    bootstrapMutation.isPending ||
    loginMutation.isPending ||
    biometricMutation.isPending;

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const hasAccounts = accounts.length > 0;
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null;
  const visibleAccount = selectedAccount ?? accounts[accounts.length - 1] ?? null;
  const activeAccountForLogin = selectedAccount ?? visibleAccount;

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }

    if (selectedAccountId && accounts.some((account) => account.id === selectedAccountId)) {
      return;
    }

    setSelectedAccountId(accounts[accounts.length - 1].id);
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  if (!hasHydrated) {
    return (
      <ScreenShell
        title="Calories"
        subtitle="Проверяем состояние приложения"
        showNav={false}
      >
        <div className="rounded-3xl border border-white/80 bg-card p-6 text-sm text-subtext shadow-card">
          Загружаем настройки...
        </div>
      </ScreenShell>
    );
  }

  const handleSetupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    setError('');

    const normalizedDisplayName = setupDisplayName.trim();
    if (!normalizedDisplayName) {
      setError('Введите имя профиля.');
      return;
    }

    if (!PASSCODE_REGEX.test(setupPasscode)) {
      setError('Нужен код ровно из 6 цифр.');
      return;
    }

    if (setupPasscode !== confirmSetupPasscode) {
      setError('Коды не совпадают.');
      return;
    }

    bootstrapMutation.mutate({
      passcode: setupPasscode,
      displayName: normalizedDisplayName,
    });
  };

  const handleUnlockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    setError('');

    if (!PASSCODE_REGEX.test(loginPasscode)) {
      setError('Введите 6-значный код.');
      return;
    }

    if (!activeAccountForLogin) {
      setError('Сначала выберите профиль.');
      return;
    }

    loginMutation.mutate({
      userId: activeAccountForLogin.id,
      passcode: loginPasscode,
    });
  };

  const handleBiometric = () => {
    setError('');

    if (!biometricEnabled) {
      setError('Биометрия отключена. Включите её ниже.');
      return;
    }

    if (!activeAccountForLogin) {
      setError('Сначала выберите профиль.');
      return;
    }

    biometricMutation.mutate(activeAccountForLogin.id);
  };

  const handleSelectAccount = (accountId: string) => {
    if (isPending) {
      return;
    }

    setSelectedAccountId(accountId);
    setAccountsExpanded(false);
    setLoginPasscode('');
    setError('');
  };

  return (
    <ScreenShell
      title={
        accountsQuery.isLoading
          ? 'Загружаем профили'
          : hasAccounts
            ? 'Выбор профиля'
            : 'Первый запуск'
      }
      subtitle={
        hasAccounts
          ? 'Выберите профиль и введите 6-значный PIN.'
          : 'Профили не найдены. Создайте первый профиль.'
      }
      showNav={false}
    >
      <div className="rounded-3xl border border-white/90 bg-card p-5 shadow-card">
        {accountsQuery.isLoading ? (
          <div className="rounded-2xl bg-muted px-4 py-4 text-sm text-subtext">
            Получаем список аккаунтов...
          </div>
        ) : accountsQuery.isError ? (
          <div className="space-y-3">
            <p className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-3 text-sm text-danger">
              {getApiErrorMessage(
                accountsQuery.error,
                'Не удалось загрузить список профилей.',
              )}
            </p>
            <button
              type="button"
              onClick={() => accountsQuery.refetch()}
              className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
            >
              Повторить
            </button>
          </div>
        ) : !hasAccounts ? (
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <label className="block text-sm text-subtext">
              Имя профиля
              <input
                value={setupDisplayName}
                onChange={(event) => setSetupDisplayName(event.target.value)}
                placeholder="Например, Артём"
                type="text"
                autoComplete="name"
                className="mt-1"
              />
            </label>
            <label className="block text-sm text-subtext">
              PIN-код
              <input
                inputMode="numeric"
                maxLength={6}
                value={setupPasscode}
                onChange={(event) =>
                  setSetupPasscode(event.target.value.replace(/\D/g, ''))
                }
                placeholder="000000"
                type="password"
                autoComplete="new-password"
                className="mt-1"
              />
            </label>
            <label className="block text-sm text-subtext">
              Повторите PIN-код
              <input
                inputMode="numeric"
                maxLength={6}
                value={confirmSetupPasscode}
                onChange={(event) =>
                  setConfirmSetupPasscode(event.target.value.replace(/\D/g, ''))
                }
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
              {bootstrapMutation.isPending
                ? 'Создаём профиль...'
                : 'Сохранить и открыть'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-subtext">Аккаунт</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setAccountsExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-accent bg-accent/10 px-4 py-3 text-left transition-all duration-200 ease-ios hover:brightness-105"
              >
                <span>
                  <span className="block text-sm font-medium text-text">
                    {visibleAccount
                      ? getAccountLabel(
                          visibleAccount,
                          Math.max(
                            0,
                            accounts.findIndex(
                              (account) => account.id === visibleAccount.id,
                            ),
                          ),
                        )
                      : 'Профиль не выбран'}
                  </span>
                  <span className="mt-1 block text-xs text-subtext">
                    {accountsExpanded ? 'Свернуть список' : 'Показать все профили'}
                  </span>
                </span>
                <span className="text-sm text-subtext">
                  {accountsExpanded ? '▲' : '▼'}
                </span>
              </button>
              {accountsExpanded ? (
                <div className="grid gap-2">
                  {accounts.map((account, index) => {
                    const isSelected = selectedAccount?.id === account.id;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSelectAccount(account.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-ios ${
                          isSelected
                            ? 'border-accent bg-accent text-white shadow-soft'
                            : 'border-white/80 bg-white text-subtext hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`block text-sm font-medium ${
                            isSelected ? 'text-white' : 'text-text'
                          }`}
                        >
                          {getAccountLabel(account, index)}
                        </span>
                        <span
                          className={`mt-1 block text-xs ${
                            isSelected ? 'text-white/80' : ''
                          }`}
                        >
                          {isSelected ? 'Выбран профиль' : 'Нажмите, чтобы выбрать'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <label className="block text-sm text-subtext">
              PIN-код
              <input
                inputMode="numeric"
                maxLength={6}
                value={loginPasscode}
                onChange={(event) => {
                  const nextPasscode = event.target.value.replace(/\D/g, '');
                  setError('');
                  setLoginPasscode(nextPasscode);

                  if (nextPasscode.length === 6) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
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
              {loginMutation.isPending ? 'Проверяем...' : 'Войти'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleBiometric}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-text transition-all duration-200 ease-ios hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {biometricMutation.isPending
                ? 'Проверяем Face ID / Touch ID...'
                : 'Face ID / Touch ID'}
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
