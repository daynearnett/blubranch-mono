// Wizard state for the 6-step employer posting flow (Mockup 7A→7F).
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { JobType, PlanTier, WorkSetting, CompanySize } from '@blubranch/shared';

export interface PostJobDraft {
  // 7A
  planTier: PlanTier;
  // 7B (also persisted via /companies API)
  companyName: string;
  industry: string;
  companySize: CompanySize | null;
  website: string;
  about: string;
  contactEmail: string;
  // 7C
  title: string;
  tradeId: number | null; // primary (first selected) — matching/search/display
  tradeIds: number[]; // full multi-selection
  tradeOther: string; // free text when the "Other" trade is picked
  experienceLevel: string;
  payMin: string;
  payMax: string;
  jobType: JobType; // primary (first selected)
  jobTypes: JobType[]; // full multi-selection
  workSetting: WorkSetting;
  city: string;
  state: string;
  zipCode: string;
  openingsCount: number;
  description: string;
  // 7D
  benefitIds: number[];
  isUrgent: boolean;
  boostPushNotification: boolean;
  boostFeaturedPlacement: boolean;
}

const empty: PostJobDraft = {
  planTier: 'pro',
  companyName: '',
  industry: '',
  companySize: null,
  website: '',
  about: '',
  contactEmail: '',
  title: '',
  tradeId: null,
  tradeIds: [],
  tradeOther: '',
  experienceLevel: '',
  payMin: '',
  payMax: '',
  jobType: 'full_time',
  jobTypes: [],
  workSetting: 'commercial',
  city: '',
  state: '',
  zipCode: '',
  openingsCount: 1,
  description: '',
  benefitIds: [],
  isUrgent: false,
  boostPushNotification: false,
  boostFeaturedPlacement: false,
};

interface CtxValue {
  draft: PostJobDraft;
  update: (patch: Partial<PostJobDraft>) => void;
  reset: () => void;
  // Pre-fill from /users/me/company so an employer doesn't retype every time.
  hydrateCompanyFromExisting: (c: {
    name: string;
    industry: string | null;
    sizeRange: CompanySize;
    website: string | null;
    description: string | null;
    contactEmail: string;
  }) => void;
}

const Ctx = createContext<CtxValue | null>(null);

export function PostJobProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PostJobDraft>(empty);
  const value = useMemo<CtxValue>(
    () => ({
      draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(empty),
      hydrateCompanyFromExisting: (c) =>
        setDraft((prev) => ({
          ...prev,
          companyName: c.name,
          industry: c.industry ?? '',
          companySize: c.sizeRange,
          website: c.website ?? '',
          about: c.description ?? '',
          contactEmail: c.contactEmail,
        })),
    }),
    [draft],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePostJob(): CtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePostJob must be used inside PostJobProvider');
  return ctx;
}
