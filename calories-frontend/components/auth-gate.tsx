'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, getMyProfile } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { useSessionStore } from '@/store/use-session-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isUnlocked = useSessionStore((state) => state.isUnlocked);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const accessToken = useSessionStore((state) => state.accessToken);
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const lock = useSessionStore((state) => state.lock);

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getMyProfile(accessToken as string),
    enabled: Boolean(accessToken && hasHydrated && isUnlocked && userId),
  });

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!isUnlocked || !accessToken) {
      router.replace('/unlock');
      return;
    }

    if (
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 401 &&
      profileQuery.fetchStatus === 'idle'
    ) {
      lock();
      return;
    }

    if (pathname !== '/profile-setup' && profileQuery.data && !profileQuery.data.isComplete) {
      router.replace('/profile-setup');
    }
  }, [
    accessToken,
    hasHydrated,
    isUnlocked,
    lock,
    pathname,
    profileQuery.data,
    profileQuery.error,
    profileQuery.fetchStatus,
    router,
    userId,
  ]);

  if (!hasHydrated || !isUnlocked || !accessToken || profileQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-subtext">
        Проверяем сессию...
      </div>
    );
  }

  return <>{children}</>;
}
