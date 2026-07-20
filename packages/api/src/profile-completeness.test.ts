import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import {
  COMPLETENESS_WEIGHTS,
  scoreProfile,
  recomputeProfileCompleteness,
} from './services/profile-completeness.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Verifies that
// profileCompleteness — previously a dead column stuck at 0 — is computed on
// every profile mutation and by the admin license-verify action.

const EMPTY = {
  hasProfilePhoto: false,
  hasHeadline: false,
  hasBio: false,
  tradeCount: 0,
  skillCount: 0,
  workHistoryCount: 0,
  verifiedLicenseCount: 0,
  portfolioPhotoCount: 0,
};

describe('scoreProfile (unit)', () => {
  it('weights sum to exactly 100', () => {
    const total = Object.values(COMPLETENESS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('empty profile scores 0; full profile scores 100', () => {
    expect(scoreProfile(EMPTY)).toBe(0);
    expect(
      scoreProfile({
        hasProfilePhoto: true,
        hasHeadline: true,
        hasBio: true,
        tradeCount: 2,
        skillCount: 5,
        workHistoryCount: 1,
        verifiedLicenseCount: 1,
        portfolioPhotoCount: 3,
      }),
    ).toBe(100);
  });

  it('each component contributes exactly its weight', () => {
    expect(scoreProfile({ ...EMPTY, hasProfilePhoto: true })).toBe(COMPLETENESS_WEIGHTS.profilePhoto);
    expect(scoreProfile({ ...EMPTY, hasHeadline: true })).toBe(COMPLETENESS_WEIGHTS.headline);
    expect(scoreProfile({ ...EMPTY, hasBio: true })).toBe(COMPLETENESS_WEIGHTS.bio);
    expect(scoreProfile({ ...EMPTY, tradeCount: 1 })).toBe(COMPLETENESS_WEIGHTS.trade);
    expect(scoreProfile({ ...EMPTY, skillCount: 1 })).toBe(COMPLETENESS_WEIGHTS.skills);
    expect(scoreProfile({ ...EMPTY, workHistoryCount: 1 })).toBe(COMPLETENESS_WEIGHTS.workHistory);
    expect(scoreProfile({ ...EMPTY, verifiedLicenseCount: 1 })).toBe(
      COMPLETENESS_WEIGHTS.verifiedLicense,
    );
    expect(scoreProfile({ ...EMPTY, portfolioPhotoCount: 1 })).toBe(
      COMPLETENESS_WEIGHTS.portfolioPhoto,
    );
  });
});

describe('profileCompleteness recompute flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };
  let adminUser: { id: string; token: string };
  let tradeId: number;
  let skillId: number;
  let licenseId: string;

  const myCompleteness = async (): Promise<number> => {
    const p = await prisma.workerProfile.findUnique({
      where: { userId: worker.id },
      select: { profileCompleteness: true },
    });
    return p?.profileCompleteness ?? -1;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const w = await prisma.user.create({
      data: {
        firstName: 'Score',
        lastName: 'Worker',
        email: `score-worker-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    worker = { id: w.id, token: signAccessToken(w.id, 'worker') };

    const a = await prisma.user.create({
      data: {
        firstName: 'Score',
        lastName: 'Admin',
        email: `score-admin-${stamp}@test.local`,
        role: 'admin',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    adminUser = { id: a.id, token: signAccessToken(a.id, 'admin') };

    const trade = await prisma.trade.create({
      data: { name: `Test Trade ${stamp}`, slug: `test-trade-${stamp}` },
    });
    tradeId = trade.id;
    const skill = await prisma.skill.create({
      data: { name: `Test Skill ${stamp}`, tradeId },
    });
    skillId = skill.id;
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    if (tradeId) await prisma.trade.delete({ where: { id: tradeId } }).catch(() => {});
    await app.close();
  });

  it('recompute is a no-op for users without a worker profile', async () => {
    expect(await recomputeProfileCompleteness(adminUser.id)).toBeNull();
  });

  it('profile upsert with headline + bio scores headline + bio', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me/worker-profile',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {
        headline: 'Journeyman electrician',
        bio: 'Twenty years bending conduit.',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43004',
      },
    });
    expect(res.statusCode).toBe(200);
    const expected = COMPLETENESS_WEIGHTS.headline + COMPLETENESS_WEIGHTS.bio;
    expect(res.json().profileCompleteness).toBe(expected);
    expect(await myCompleteness()).toBe(expected);
  });

  it('profile photo bumps the score', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me/photo',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { profilePhotoUrl: 'https://example.com/photo.jpg' },
    });
    expect(res.statusCode).toBe(200);
    expect(await myCompleteness()).toBe(35); // headline 10 + bio 10 + photo 15
  });

  it('trades and skills bump the score', async () => {
    await app.inject({
      method: 'POST',
      url: '/users/me/trades',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { tradeIds: [tradeId] },
    });
    expect(await myCompleteness()).toBe(50);

    await app.inject({
      method: 'POST',
      url: '/users/me/skills',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { skillIds: [skillId] },
    });
    expect(await myCompleteness()).toBe(60);
  });

  it('work history bumps the score', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/work-history',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {
        companyName: 'Turner Construction',
        title: 'Electrician',
        startDate: '2020-01-01',
        endDate: '2023-01-01',
        isCurrent: false,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(await myCompleteness()).toBe(75);
  });

  it('a PENDING license does not score; admin verification does', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/licenses',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { type: 'Journeyman Electrician', number: 'EL-1', issuingState: 'OH' },
    });
    expect(res.statusCode).toBe(201);
    licenseId = res.json().id;
    expect(await myCompleteness()).toBe(75); // unchanged

    const verify = await app.inject({
      method: 'PUT',
      url: `/admin/licenses/${licenseId}`,
      headers: { authorization: `Bearer ${adminUser.token}` },
      payload: { status: 'verified' },
    });
    expect(verify.statusCode).toBe(200);
    expect(await myCompleteness()).toBe(90);
  });

  it('portfolio photo completes the profile at 100', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/portfolio-photos',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { photoUrl: 'https://example.com/work.jpg' },
    });
    expect(res.statusCode).toBe(201);
    expect(await myCompleteness()).toBe(100);
  });

  it('onboarding currentCompany counts as work history', async () => {
    // Fresh user with only the onboarding-style current job set.
    const u = await prisma.user.create({
      data: {
        firstName: 'Current',
        lastName: 'Job',
        email: `current-job-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        workerProfile: {
          create: {
            experienceLevel: 'years_3_5',
            city: 'Columbus',
            state: 'OH',
            zipCode: '43004',
            travelRadiusMiles: 25,
            jobAvailability: 'open',
            currentCompany: 'Acme Electric',
          },
        },
      },
    });
    try {
      expect(await recomputeProfileCompleteness(u.id)).toBe(COMPLETENESS_WEIGHTS.workHistory);
    } finally {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  });
});
