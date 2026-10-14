// Quick Apply readiness — the gate that keeps half-built profiles out of
// employers' applicant lists.
//
// The requirements below are deliberately the exact fields the employer's
// applicant card renders (see the `GET /jobs/:id/applications` projection in
// routes/applications.ts). That's what makes the gate explainable to a worker:
// every item we ask for is something the hiring side actually sees.
//
// This is distinct from WorkerProfile.profileCompleteness (services/
// profile-completeness.ts), which is a 0-100 "profile strength" score used for
// nudges and the "Get found more" card. Completeness is a dial; readiness is a
// door. Keep them separate — tuning the score shouldn't silently change who
// can apply.

import { getPrisma } from '../lib/prisma.js';

export const APPLY_REQUIREMENTS = [
  'phone',
  'photo',
  'headline',
  'trade',
  'location',
  'experience',
] as const;

export type ApplyRequirement = (typeof APPLY_REQUIREMENTS)[number];

export interface MissingRequirement {
  key: ApplyRequirement;
  /** Short row title in the gate sheet. */
  label: string;
  /** One line of "why this matters" under the label. */
  hint: string;
  /** Client route that resolves this item. */
  route: string;
}

/**
 * Copy lives server-side so the gate sheet, the 403 body and any future
 * surface (email nudge, admin view) all say the same thing.
 */
const REQUIREMENT_COPY: Record<ApplyRequirement, Omit<MissingRequirement, 'key'>> = {
  phone: {
    label: 'Verify your phone',
    hint: 'So the employer can actually reach you',
    route: '/(app)/verify-phone',
  },
  photo: {
    label: 'Add a profile photo',
    hint: 'Crews hire faces, not blank circles',
    route: '/(app)/profile-complete?focus=photo',
  },
  headline: {
    label: 'Add a headline',
    hint: 'One line on what you do',
    route: '/(app)/profile-complete?focus=headline',
  },
  trade: {
    label: 'Pick your trade',
    hint: 'It is the first thing an employer filters on',
    route: '/(app)/profile-complete?focus=trade',
  },
  location: {
    label: 'Add your location',
    hint: 'So you show up in jobs near you',
    route: '/(app)/profile-complete?focus=location',
  },
  experience: {
    label: 'Add your work history',
    hint: 'Where you have worked, or tell us you are looking',
    route: '/(app)/profile-complete?focus=experience',
  },
};

export interface ApplyReadiness {
  ready: boolean;
  missing: MissingRequirement[];
  /** Every requirement, with its satisfied state — for progress UI. */
  satisfied: ApplyRequirement[];
}

function describe(keys: ApplyRequirement[]): MissingRequirement[] {
  return keys.map((key) => ({ key, ...REQUIREMENT_COPY[key] }));
}

/**
 * A short human sentence for the 403 body, so older clients that only render
 * `message` still tell the worker something useful.
 */
export function readinessMessage(missing: MissingRequirement[]): string {
  if (missing.length === 0) return 'Your profile is ready to apply.';
  const labels = missing.map((m) => m.label.toLowerCase());
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Finish your profile before applying — you still need to ${list}.`;
}

/**
 * Evaluate the gate for one user. Employers and admins are never gated: they
 * don't apply to jobs, and admins need to be able to exercise the flow.
 */
export async function checkApplyReadiness(userId: string): Promise<ApplyReadiness> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      phoneVerified: true,
      profilePhotoUrl: true,
      workerProfile: {
        select: {
          headline: true,
          city: true,
          state: true,
          currentCompany: true,
          currentTitle: true,
          jobAvailability: true,
        },
      },
      _count: { select: { trades: true, workHistory: true } },
    },
  });

  if (!user) return { ready: false, missing: describe([...APPLY_REQUIREMENTS]), satisfied: [] };
  if (user.role === 'admin') {
    return { ready: true, missing: [], satisfied: [...APPLY_REQUIREMENTS] };
  }

  const profile = user.workerProfile;
  const met: Record<ApplyRequirement, boolean> = {
    phone: user.phoneVerified,
    photo: !!user.profilePhotoUrl,
    headline: !!profile?.headline?.trim(),
    trade: user._count.trades > 0,
    location: !!profile?.city?.trim() && !!profile?.state?.trim(),
    // A worker who told us they're between jobs has given us the signal we
    // need — don't force them to invent a current employer.
    experience:
      user._count.workHistory > 0 ||
      (!!profile?.currentCompany?.trim() && !!profile?.currentTitle?.trim()) ||
      profile?.jobAvailability === 'actively_looking',
  };

  const missing = APPLY_REQUIREMENTS.filter((k) => !met[k]);
  const satisfied = APPLY_REQUIREMENTS.filter((k) => met[k]);
  return { ready: missing.length === 0, missing: describe([...missing]), satisfied: [...satisfied] };
}
