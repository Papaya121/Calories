'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { AuthSession, SessionUser } from '@/lib/types';

type SessionState = {
  selectedAccountId: string | null;
  biometricEnabled: boolean;
  accessToken: string | null;
  user: SessionUser | null;
  isUnlocked: boolean;
  hasHydrated: boolean;
  setSelectedAccountId: (accountId: string | null) => void;
  setAuthSession: (session: AuthSession) => void;
  lock: () => void;
  toggleBiometrics: (enabled: boolean) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      biometricEnabled: false,
      accessToken: null,
      user: null,
      isUnlocked: false,
      hasHydrated: false,
      setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
      setAuthSession: (session) =>
        set({
          accessToken: session.accessToken,
          selectedAccountId: session.user.id,
          user: session.user,
          isUnlocked: true
        }),
      lock: () => set({ isUnlocked: false, accessToken: null, user: null }),
      toggleBiometrics: (enabled) => set({ biometricEnabled: enabled }),
      setHasHydrated: (value) => set({ hasHydrated: value })
    }),
    {
      name: 'calories-session-v2',
      partialize: (state) => ({
        selectedAccountId: state.selectedAccountId,
        biometricEnabled: state.biometricEnabled
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
