'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { AuthSession, SessionUser } from '@/lib/types';

type SessionState = {
  passcode: string | null;
  biometricEnabled: boolean;
  accessToken: string | null;
  user: SessionUser | null;
  isUnlocked: boolean;
  hasHydrated: boolean;
  setPasscode: (passcode: string) => void;
  setAuthSession: (session: AuthSession) => void;
  lock: () => void;
  toggleBiometrics: (enabled: boolean) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      passcode: null,
      biometricEnabled: false,
      accessToken: null,
      user: null,
      isUnlocked: false,
      hasHydrated: false,
      setPasscode: (passcode) => set({ passcode }),
      setAuthSession: (session) =>
        set({
          accessToken: session.accessToken,
          user: session.user,
          isUnlocked: true
        }),
      lock: () => set({ isUnlocked: false, accessToken: null, user: null }),
      toggleBiometrics: (enabled) => set({ biometricEnabled: enabled }),
      setHasHydrated: (value) => set({ hasHydrated: value })
    }),
    {
      name: 'calories-session-v1',
      partialize: (state) => ({
        passcode: state.passcode,
        biometricEnabled: state.biometricEnabled
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
