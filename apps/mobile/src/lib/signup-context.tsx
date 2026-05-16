import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExperienceLevel, JobAvailability } from '@blubranch/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SignupRole = 'worker' | 'employer';

export interface SignupDraft {
  // Step 1 (S4): name + role
  firstName: string;
  lastName: string;
  role: SignupRole;
  // Step 2 (S5): email + password + terms
  email: string;
  password: string;
  termsAccepted: boolean;
  // Step 3 (S6): email verified flag
  emailVerified: boolean;
  // Step 4 (S7): location
  city: string;
  state: string;
  zipCode: string;
  travelRadiusMiles: number;
  jobAvailability: JobAvailability;
  // Step 5 (S8): trade + company + title
  tradeIds: number[];
  experienceLevel: ExperienceLevel | null;
  currentCompany: string;
  currentTitle: string;
  certificationNumber: string;
  unionName: string;
}

const empty: SignupDraft = {
  firstName: '',
  lastName: '',
  role: 'worker',
  email: '',
  password: '',
  termsAccepted: false,
  emailVerified: false,
  city: '',
  state: '',
  zipCode: '',
  travelRadiusMiles: 25,
  jobAvailability: 'open',
  tradeIds: [],
  experienceLevel: null,
  currentCompany: '',
  currentTitle: '',
  certificationNumber: '',
  unionName: '',
};

const STORAGE_KEY = 'bb.signup-draft';

interface SignupContextValue {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  reset: () => void;
}

const SignupContext = createContext<SignupContextValue | null>(null);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) {
          try {
            const saved = JSON.parse(json);
            setDraft((prev) => ({ ...prev, ...saved, password: '' }));
          } catch { /* ignore corrupt data */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((next: SignupDraft) => {
    const { password, ...safe } = next;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safe)).catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<SignupDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setDraft(empty);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<SignupContextValue>(
    () => ({ draft, update, reset }),
    [draft, update, reset],
  );

  if (!loaded) return null;

  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup(): SignupContextValue {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup must be used inside SignupProvider');
  return ctx;
}
