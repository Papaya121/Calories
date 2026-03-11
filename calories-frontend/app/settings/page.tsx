'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { ProfileSettingsForm } from '@/components/profile-settings-form';
import { ScreenShell } from '@/components/screen-shell';
import { ApiError, getApiErrorMessage, getMyProfile, updateMyProfile } from '@/lib/api';
import { useSessionStore } from '@/store/use-session-store';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const lock = useSessionStore((state) => state.lock);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(accessToken as string),
    enabled: Boolean(accessToken && userId),
  });

  useEffect(() => {
    if (profileQuery.error instanceof ApiError && profileQuery.error.status === 401) {
      lock();
    }
  }, [lock, profileQuery.error]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateMyProfile>[1]) =>
      updateMyProfile(accessToken as string, payload),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId], profile);
      setSuccessMessage('Настройки сохранены.');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        lock();
      }
      setSuccessMessage('');
      setError(getApiErrorMessage(err, 'Не удалось сохранить настройки.'));
    },
  });

  return (
    <AuthGate>
      <ScreenShell
        title="Настройки"
        subtitle="Измени пол, вес, рост, возраст и активность. Цели по калориям пересчитаются автоматически."
      >
        <div className="rounded-3xl border border-white/90 bg-card p-5 shadow-card">
          {profileQuery.isLoading ? (
            <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-subtext">
              Загружаем настройки...
            </p>
          ) : profileQuery.isError ? (
            <div className="space-y-3">
              <p className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-3 text-sm text-danger">
                {getApiErrorMessage(
                  profileQuery.error,
                  'Не удалось загрузить параметры профиля.',
                )}
              </p>
              <button
                type="button"
                onClick={() => profileQuery.refetch()}
                className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-white transition-all duration-200 ease-ios hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Повторить
              </button>
            </div>
          ) : (
            <ProfileSettingsForm
              profile={profileQuery.data ?? null}
              isPending={updateProfileMutation.isPending}
              submitLabel={updateProfileMutation.isPending ? 'Сохраняем...' : 'Сохранить настройки'}
              onSubmit={(payload) => {
                setError('');
                setSuccessMessage('');
                updateProfileMutation.mutate(payload);
              }}
            />
          )}
        </div>

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </ScreenShell>
    </AuthGate>
  );
}
