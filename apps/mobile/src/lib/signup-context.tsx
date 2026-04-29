import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExperienceLevel, JobAvailability } from '@blubranch/shared';

export type SignupRole = 'worker' | 'employer';

export interface SignupDraft {
  // Step 2A
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: SignupRole;
  // Step 2B
  tradeIds: number[];
  experienceLevel: ExperienceLevel | null;
  certificationNumber: string;
  unionName: string;
  // Step 2C
  city: string;
  state: string;
  zipCode: string;
  travelRadiusMiles: number;
  jobAvailability: JobAvailability;
}

const empty: SignupDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  role: 'worker',
  tradeIds: [],
  experienceLevel: null,
  certificationNumber: '',
  unionName: '',
  city: '',
  state: '',
  zipCode: '',
  travelRadiusMiles: 25,
  jobAvailability: 'open',
};

interface SignupContextValue {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  reset: () => void;
}

const SignupContext = createContext<SignupContextValue | null>(null);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(empty);
  const value = useMemo<SignupContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(empty),
    }),
    [draft],
  );
  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup(): SignupContextValue {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup must be used inside SignupProvider');
  return ctx;
}
