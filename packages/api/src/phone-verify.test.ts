import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema, and no real Twilio
// credentials in the environment — the dev fallback returns the code as
// `devCode` so the check step can be exercised end to end.
//
// Regression cover for the bug that silently blocked Quick Apply forever:
// the phone number was never persisted (the mobile client routed it through
// the worker-profile schema, which has no phone field, so Zod dropped it),
// and /auth/verify-phone then flipped phoneVerified with an updateMany keyed
// on that unsaved number — matching zero rows. Secondary: that updateMany
// marked *every* account holding the number verified, from an unauthenticated
// route.

describe('Phone verification', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  // Distinct numbers per run so a re-run doesn't trip the unique constraint.
  const phone = `+1312555${String(stamp).slice(-4)}`;
  let user: { id: string; token: string };
  let bystander: { id: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const u = await prisma.user.create({
      data: {
        firstName: 'Pat',
        lastName: 'Phone',
        email: `pat-phone-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        // Deliberately no phone — this is the state that used to dead-end.
      },
    });
    user = { id: u.id, token: signAccessToken(u.id, 'worker') };

    const b = await prisma.user.create({
      data: {
        firstName: 'By',
        lastName: 'Stander',
        email: `by-stander-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    bystander = { id: b.id };
  });

  afterAll(async () => {
    if (user) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    if (bystander) await prisma.user.delete({ where: { id: bystander.id } }).catch(() => {});
    await app.close();
  });

  it('both verify-phone routes require auth', async () => {
    const send = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone/send',
      payload: { phone },
    });
    expect(send.statusCode).toBe(401);

    const check = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone',
      payload: { phone, code: '123456' },
    });
    expect(check.statusCode).toBe(401);
  });

  it('send persists the number on the caller, normalized to E.164', async () => {
    // Sent in the loose shape a phone keypad produces.
    const local = phone.replace('+1', '');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone/send',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { phone: local },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.phone).toBe(phone);
    expect(row.phoneVerified).toBe(false);
  });

  it('a number already on another account is refused 409, not a raw P2002', async () => {
    const taken = `+1312444${String(stamp).slice(-4)}`;
    await prisma.user.update({ where: { id: bystander.id }, data: { phone: taken } });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone/send',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { phone: taken },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('PhoneInUse');

    // The caller's own number is untouched by the rejected claim.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.phone).toBe(phone);
  });

  it('a wrong code does not verify', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { phone, code: '000000' },
    });
    expect(res.statusCode).toBe(400);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.phoneVerified).toBe(false);
  });

  it('the full send → verify round trip flips phoneVerified on the caller only', async () => {
    const send = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone/send',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { phone },
    });
    const devCode = send.json().devCode as string | undefined;
    // Guards against this test silently passing against real Twilio creds.
    expect(devCode, 'dev fallback must be active (no Twilio creds in env)').toBeTruthy();

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-phone',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { phone, code: devCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().verified).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.phoneVerified).toBe(true);
    expect(row.isVerified).toBe(true);
    expect(row.phone).toBe(phone);

    // The old updateMany-by-phone would have swept up anyone else too.
    const other = await prisma.user.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(other.phoneVerified).toBe(false);
  });

  it('a verified phone clears the phone requirement on the apply gate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/apply-readiness',
      headers: { authorization: `Bearer ${user.token}` },
    });
    const keys = res.json().missing.map((m: { key: string }) => m.key);
    expect(keys).not.toContain('phone');
  });
});
