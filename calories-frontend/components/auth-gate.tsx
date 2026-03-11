'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSessionStore } from '@/store/use-session-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isUnlocked = useSessionStore((state) => state.isUnlocked);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const passcode = useSessionStore((state) => state.passcode);
  const accessToken = useSessionStore((state) => state.accessToken);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!passcode || !isUnlocked || !accessToken) {
      router.replace('/unlock');
    }
  }, [accessToken, hasHydrated, isUnlocked, passcode, router]);

  if (!hasHydrated || !isUnlocked || !passcode || !accessToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-subtext">
        Проверяем сессию...
      </div>
    );
  }

  return <>{children}</>;
}
