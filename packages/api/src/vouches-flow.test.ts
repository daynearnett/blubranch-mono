import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import { normalizeCompanyName, findSharedWorkplaces } from './routes/vouches.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// Covers the "worked together" vouch flow: shared-workplace suggestions →
// claim → vouchee confirmation → public-profile display, plus the guardrails
// (self-vouch, duplicate pair, confirm authorization).

describe('normalizeCompanyName / findSharedWorkplaces (unit)', () => {
  it('normalizes case, punctuation, and whitespace', () => {
    expect(normalizeCompanyName('Turner  Construction')).toBe('turner construction');
    expect(normalizeCompanyName("turner const.'s ")).toBe('turner consts');
    expect(normalizeCompanyName('TURNER, CONSTRUCTION')).toBe('turner construction');
  });

  it('finds overlap ≥30 days at the same normalized company', () => {
    const now = new Date('2026-07-01');
    const mine = [
      { companyName: 'Turner Construction', start: new Date('2023-01-01'), end: new Date('2024-01-01'), current: false },
    ];
    const theirs = [
      { companyName: 'turner  construction', start: new Date('2023-06-01'), end: null, current: true },
    ];
    const shared = findSharedWorkplaces(mine, theirs, now);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.companyName).toBe('Turner Construction');
    expect(shared[0]!.startYear).toBe('2023');
    expect(shared[0]!.endYear).toBe('2024');
  });

  it('excludes overlaps under 30 days and different companies', () => {
    const now = new Date('2026-07-01');
    const mine = [
      { companyName: 'Turner Construction', start: new Date('2023-01-01'), end: new Date('2023-01-15'), current: false },
      { companyName: 'Acme Electric', start: new Date('2020-01-01'), end: new Date('2022-01-01'), current: false },
    ];
    const theirs = [
      { companyName: 'Turner Construction', start: new Date('2023-01-01'), end: new Date('2024-01-01'), current: false },
      { companyName: 'Bolt Electric', start: new Date('2020-01-01'), end: new Date('2022-01-01'), current: false },
    ];
    expect(findSharedWorkplaces(mine, theirs, now)).toHaveLength(0);
  });
});

describe('Vouch flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let carol: { id: string; token: string };
  let vouchId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const mk = async (first: string) => {
      const u = await prisma.user.create({
        data: {
          firstName: first,
          lastName: 'Vouch',
          email: `${first.toLowerCase()}-vouch-${stamp}@test.local`,
          role: 'worker',
          authProvider: 'email',
          passwordHash: 'not-a-real-hash',
          slug: `${first.toLowerCase()}-vouch-${stamp}`,
        },
      });
      return { id: u.id, token: signAccessToken(u.id, 'worker') };
    };
    alice = await mk('Alice');
    bob = await mk('Bob');
    carol = await mk('Carol');

    // Alice + Bob overlapped at Turner Construction (name variants on purpose).
    await prisma.workPlace.createMany({
      data: [
        {
          userId: alice.id,
          companyName: 'Turner Construction',
          role: 'Electrician',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-06-01'),
          current: false,
        },
        {
          userId: bob.id,
          companyName: 'turner  construction',
          role: 'Foreman',
          startDate: new Date('2023-06-01'),
          endDate: null,
          current: true,
        },
      ],
    });
  });

  afterAll(async () => {
    for (const u of [alice, bob, carol]) {
      if (u) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await app.close();
  });

  it('GET /users/:id/vouch-context — suggests the shared workplace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/users/${bob.id}/vouch-context`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.given).toBeNull();
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].companyName).toBe('Turner Construction');
  });

  it('GET /users/:id/vouch-context — no suggestions without shared history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/users/${carol.id}/vouch-context`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().suggestions).toHaveLength(0);
  });

  it('POST /users/:id/vouch — cannot vouch for yourself (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${alice.id}/vouch`,
      headers: { authorization: `Bearer ${alice.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /users/:id/vouch — Alice vouches for Bob (201, pending)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${bob.id}/vouch`,
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { companyName: 'Turner Construction', startYear: '2023', endYear: '2024' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('pending');
    vouchId = res.json().id;
  });

  it('POST /users/:id/vouch — duplicate pair rejected (409)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${bob.id}/vouch`,
      headers: { authorization: `Bearer ${alice.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('vouchee got a vouch_received notification', async () => {
    const notif = await prisma.notification.findFirst({
      where: { userId: bob.id, type: 'vouch_received' },
    });
    expect(notif).not.toBeNull();
    expect(notif!.title).toContain('Alice');
  });

  it('GET /vouches/pending — Bob sees the claim awaiting confirmation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/vouches/pending',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.some((v: { id: string }) => v.id === vouchId)).toBe(true);
  });

  it('pending vouches do NOT display on the public profile', async () => {
    const res = await app.inject({ method: 'GET', url: `/users/${bob.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().vouches).toHaveLength(0);
    expect(res.json().stats.vouches).toBe(0);
  });

  it('PUT /vouches/:id/confirm — only the vouchee can confirm (404 for others)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/vouches/${vouchId}/confirm`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /vouches/:id/confirm — Bob confirms (200)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/vouches/${vouchId}/confirm`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('confirmed');
    expect(res.json().confirmedAt).not.toBeNull();

    // Notification dispatch is fire-and-forget — poll briefly for the row.
    let notif = null;
    for (let i = 0; i < 20 && !notif; i++) {
      notif = await prisma.notification.findFirst({
        where: { userId: alice.id, type: 'vouch_confirmed' },
      });
      if (!notif) await new Promise((r) => setTimeout(r, 100));
    }
    expect(notif).not.toBeNull();
  });

  it('confirmed vouch displays on the public profile with shared context', async () => {
    const res = await app.inject({ method: 'GET', url: `/users/${bob.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stats.vouches).toBe(1);
    expect(body.vouches).toHaveLength(1);
    expect(body.vouches[0].companyName).toBe('Turner Construction');
    expect(body.vouches[0].voucher.firstName).toBe('Alice');
  });

  it('confirming twice is rejected (400)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/vouches/${vouchId}/confirm`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('mutual direction is allowed — Bob can vouch Alice separately', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${alice.id}/vouch`,
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { companyName: 'Turner Construction' },
    });
    expect(res.statusCode).toBe(201);
  });
});
