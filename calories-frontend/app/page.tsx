'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSessionStore } from '@/store/use-session-store';

export default function HomePage() {
  const router = useRouter();
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const isUnlocked = useSessionStore((state) => state.isUnlocked);
  const isRestoringSession = useSessionStore((state) => state.isRestoringSession);
  const accessToken = useSessionStore((state) => state.accessToken);

  useEffect(() => {
    if (!hasHydrated || isRestoringSession) {
      return;
    }

    if (!isUnlocked || !accessToken) {
      router.replace('/unlock');
      return;
    }

    router.replace('/profile-setup');
  }, [accessToken, hasHydrated, isRestoringSession, isUnlocked, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] items-center justify-center px-4">
      <p className="text-sm text-subtext">Запуск приложения...</p>
    </main>
  );
}
