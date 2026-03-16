'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { authRefresh } from '@/lib/api';
import { useSessionStore } from '@/store/use-session-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: false
          }
        }
      })
  );
  const [didAttemptSessionRestore, setDidAttemptSessionRestore] = useState(false);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const accessToken = useSessionStore((state) => state.accessToken);
  const isUnlocked = useSessionStore((state) => state.isUnlocked);
  const setAuthSession = useSessionStore((state) => state.setAuthSession);
  const setIsRestoringSession = useSessionStore(
    (state) => state.setIsRestoringSession,
  );

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {
            // ignore service worker unregister errors in development
          });
        });
      });

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).catch(() => {
              // ignore cache deletion errors in development
            });
          });
        });
      }

      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore service worker registration errors
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated || didAttemptSessionRestore) {
      return;
    }

    if (isUnlocked && accessToken) {
      setDidAttemptSessionRestore(true);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, 7000);

    setDidAttemptSessionRestore(true);
    setIsRestoringSession(true);

    authRefresh({ signal: abortController.signal })
      .then((session) => {
        setAuthSession(session);
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeoutId);
        setIsRestoringSession(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    accessToken,
    didAttemptSessionRestore,
    hasHydrated,
    isUnlocked,
    setAuthSession,
    setIsRestoringSession,
  ]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
