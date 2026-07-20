// Profile-strength scoring — computes WorkerProfile.profileCompleteness.
// The column existed since Phase 1 but was never written (every profile sat
// at 0, so the weekly nudge fired for everyone and the mobile "Get found
// more" card showed a meaningless %). See docs/DIFFERENTIATION.md item B4.
//
// All weights live here so they're tunable in one place; they sum to 100.
// Verified credentials weigh more than free-text fields on purpose — a
// verified license says more about a tradesperson than a bio does.

import { getPrisma } from '../lib/prisma.js';

export const COMPLETENESS_WEIGHTS = {
  profilePhoto: 15,
  headline: 10,
  bio: 10,
  trade: 15,
  skills: 10,
  workHistory: 15,
  verifiedLicense: 15,
  portfolioPhoto: 10,
} as const;

export interface CompletenessInput {
  hasProfilePhoto: boolean;
  hasHeadline: boolean;
  hasBio: boolean;
  tradeCount: number;
  skillCount: number;
  workHistoryCount: number;
  verifiedLicenseCount: number;
  portfolioPhotoCount: number;
}

export function scoreProfile(input: CompletenessInput): number {
  let score = 0;
  if (input.hasProfilePhoto) score += COMPLETENESS_WEIGHTS.profilePhoto;
  if (input.hasHeadline) score += COMPLETENESS_WEIGHTS.headline;
  if (input.hasBio) score += COMPLETENESS_WEIGHTS.bio;
  if (input.tradeCount > 0) score += COMPLETENESS_WEIGHTS.trade;
  if (input.skillCount > 0) score += COMPLETENESS_WEIGHTS.skills;
  if (input.workHistoryCount > 0) score += COMPLETENESS_WEIGHTS.workHistory;
  if (input.verifiedLicenseCount > 0) score += COMPLETENESS_WEIGHTS.verifiedLicense;
  if (input.portfolioPhotoCount > 0) score += COMPLETENESS_WEIGHTS.portfolioPhoto;
  return score;
}

/**
 * Recompute and persist a worker's profileCompleteness. No-op (returns null)
 * for users without a worker profile — employers/admins have nothing to score.
 * Callers on the request path may await it (one read + one write) or fire and
 * forget; it never throws to the caller's flow beyond DB errors.
 */
export async function recomputeProfileCompleteness(userId: string): Promise<number | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profilePhotoUrl: true,
      workerProfile: {
        select: { headline: true, bio: true, currentCompany: true },
      },
      _count: {
        select: {
          trades: true,
          skills: true,
          workHistory: true,
          portfolioPhotos: true,
          licenses: { where: { status: 'verified' } },
        },
      },
    },
  });
  if (!user?.workerProfile) return null;

  const score = scoreProfile({
    hasProfilePhoto: !!user.profilePhotoUrl,
    hasHeadline: !!user.workerProfile.headline?.trim(),
    hasBio: !!user.workerProfile.bio?.trim(),
    tradeCount: user._count.trades,
    skillCount: user._count.skills,
    // The onboarding "current job" counts as work history even before a
    // WorkHistory row exists — it's the same signal.
    workHistoryCount: user._count.workHistory + (user.workerProfile.currentCompany ? 1 : 0),
    verifiedLicenseCount: user._count.licenses,
    portfolioPhotoCount: user._count.portfolioPhotos,
  });

  await prisma.workerProfile.update({
    where: { userId },
    data: { profileCompleteness: score },
  });
  return score;
}
