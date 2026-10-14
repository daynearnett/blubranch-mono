import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';

// Requires a running Postgres with the BluBranch schema, and Redis for the
// LinkedIn state/ticket store.
//
// The LinkedIn exchange and the Claude call are mocked — the point here is
// the route contract: what's gated, what's single-use, what's scoped to the
// caller, and that nothing writes to the profile without confirmation.
//
// Mocks are declared before buildApp is imported (same shape as
// social-auth-flow.test.ts).

const exchangeCode = vi.fn();
const parseResume = vi.fn();

vi.mock('./services/linkedin-import.js', async () => {
  const actual = await vi.importActual<typeof import('./services/linkedin-import.js')>(
    './services/linkedin-import.js',
  );
  return {
    ...actual,
    isLinkedInConfigured: () => true,
    exchangeCode: (...args: unknown[]) => exchangeCode(...args),
  };
});

vi.mock('./services/resume-import.js', async () => {
  const actual = await vi.importActual<typeof import('./services/resume-import.js')>(
    './services/resume-import.js',
  );
  return {
    ...actual,
    isResumeImportConfigured: () => resumeConfigured,
    parseResume: (...args: unknown[]) => parseResume(...args),
  };
});

let resumeConfigured = true;

const { buildApp } = await import('./app.js');

/** Minimal multipart body — the route only needs filename + bytes. */
function multipart(filename: string, body: Buffer, contentType: string) {
  const boundary = '----bbtest' + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, body, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('Onboarding profile import', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };
  let other: { id: string; token: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.LINKEDIN_CLIENT_ID = 'test-client';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-secret';
    app = await buildApp();

    const trade = await prisma.trade.findFirstOrThrow();
    const w = await prisma.user.create({
      data: {
        firstName: 'Ida',
        lastName: 'Importer',
        email: `ida-import-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        trades: { create: { tradeId: trade.id } },
      },
    });
    worker = { id: w.id, token: signAccessToken(w.id, 'worker') };

    const o = await prisma.user.create({
      data: {
        firstName: 'Otto',
        lastName: 'Other',
        email: `otto-import-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    other = { id: o.id, token: signAccessToken(o.id, 'worker') };
  });

  afterAll(async () => {
    for (const u of [worker, other]) {
      if (u) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await app.close();
  });

  // ── LinkedIn ──────────────────────────────────────────────────

  it('POST /imports/linkedin/start requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/imports/linkedin/start' });
    expect(res.statusCode).toBe(401);
  });

  it('the callback → ticket → redeem round trip returns the verified claims', async () => {
    exchangeCode.mockResolvedValueOnce({
      providerUserId: 'li-sub-1',
      email: 'ida@example.test',
      emailVerified: true,
      firstName: 'Ida',
      lastName: 'Importer',
      pictureUrl: 'https://media.licdn.test/ida.jpg',
    });

    const start = await app.inject({
      method: 'POST',
      url: '/imports/linkedin/start',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(start.statusCode).toBe(200);
    const state = new URL(start.json().authorizeUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const cb = await app.inject({
      method: 'GET',
      url: `/auth/linkedin/callback?code=abc&state=${state}`,
    });
    expect(cb.statusCode).toBe(302);
    const ticket = new URL(cb.headers.location as string).searchParams.get('ticket');
    expect(ticket).toBeTruthy();

    const redeem = await app.inject({
      method: 'POST',
      url: '/users/me/import/linkedin',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { ticket },
    });
    expect(redeem.statusCode).toBe(200);
    expect(redeem.json()).toMatchObject({
      firstName: 'Ida',
      email: 'ida@example.test',
      pictureUrl: 'https://media.licdn.test/ida.jpg',
    });

    // Single use — a replay gets nothing.
    const replay = await app.inject({
      method: 'POST',
      url: '/users/me/import/linkedin',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { ticket },
    });
    expect(replay.statusCode).toBe(401);

    // And nothing was written: confirmation happens client-side.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: worker.id } });
    expect(row.profilePhotoUrl).toBeNull();
  });

  it('a ticket cannot be redeemed by a different account', async () => {
    exchangeCode.mockResolvedValueOnce({
      providerUserId: 'li-sub-2',
      email: 'ida@example.test',
      emailVerified: true,
      firstName: 'Ida',
      lastName: 'Importer',
      pictureUrl: null,
    });
    const start = await app.inject({
      method: 'POST',
      url: '/imports/linkedin/start',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    const state = new URL(start.json().authorizeUrl).searchParams.get('state');
    const cb = await app.inject({
      method: 'GET',
      url: `/auth/linkedin/callback?code=abc&state=${state}`,
    });
    const ticket = new URL(cb.headers.location as string).searchParams.get('ticket');

    const res = await app.inject({
      method: 'POST',
      url: '/users/me/import/linkedin',
      headers: { authorization: `Bearer ${other.token}` },
      payload: { ticket },
    });
    expect(res.statusCode).toBe(401);
  });

  it('an unverified LinkedIn email is not handed back', async () => {
    exchangeCode.mockResolvedValueOnce({
      providerUserId: 'li-sub-3',
      email: 'spoofed@example.test',
      emailVerified: false,
      firstName: 'Ida',
      lastName: 'Importer',
      pictureUrl: null,
    });
    const start = await app.inject({
      method: 'POST',
      url: '/imports/linkedin/start',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    const state = new URL(start.json().authorizeUrl).searchParams.get('state');
    const cb = await app.inject({
      method: 'GET',
      url: `/auth/linkedin/callback?code=abc&state=${state}`,
    });
    const ticket = new URL(cb.headers.location as string).searchParams.get('ticket');
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/import/linkedin',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { ticket },
    });
    expect(res.json().email).toBeNull();
  });

  it('a replayed or unknown state redirects with an error, never data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/linkedin/callback?code=abc&state=not-a-real-state',
    });
    expect(res.statusCode).toBe(302);
    const url = new URL(res.headers.location as string);
    expect(url.searchParams.get('error')).toBe('expired');
    expect(url.searchParams.get('ticket')).toBeNull();
  });

  // ── Resume ────────────────────────────────────────────────────

  it('rejects a non-PDF before spending a Claude call', async () => {
    const { payload, headers } = multipart('resume.docx', Buffer.from('nope'), 'application/msword');
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/import/resume',
      headers: { ...headers, authorization: `Bearer ${worker.token}` },
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(parseResume).not.toHaveBeenCalled();
  });

  it('parses a PDF and clamps skill ids to the trade reference set', async () => {
    const real = await prisma.skill.findFirstOrThrow();
    parseResume.mockImplementationOnce(
      async (_pdf: Buffer, options: { id: number; name: string }[]) => {
        // The route must only ever offer skills that exist.
        expect(options.every((o) => typeof o.id === 'number')).toBe(true);
        return {
          headline: 'Journeyman electrician',
          bio: 'I run commercial service work.',
          workHistory: [
            {
              companyName: 'Morrow Electric',
              title: 'Electrician',
              startDate: '2021-03',
              endDate: null,
              isCurrent: true,
            },
          ],
          skillIds: [real.id],
        };
      },
    );

    const { payload, headers } = multipart(
      'resume.pdf',
      Buffer.from('%PDF-1.4 fake'),
      'application/pdf',
    );
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/import/resume',
      headers: { ...headers, authorization: `Bearer ${worker.token}` },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().workHistory).toHaveLength(1);
    expect(res.json().skillIds).toEqual([real.id]);

    // Still nothing written — the worker confirms first, which is also what
    // keeps the append-only work-history route from duplicating entries.
    const count = await prisma.workHistory.count({ where: { userId: worker.id } });
    expect(count).toBe(0);
  });

  it('503s when ANTHROPIC_API_KEY is unset, and the option hides in /imports/config', async () => {
    resumeConfigured = false;
    try {
      const { payload, headers } = multipart(
        'resume.pdf',
        Buffer.from('%PDF-1.4'),
        'application/pdf',
      );
      const res = await app.inject({
        method: 'POST',
        url: '/users/me/import/resume',
        headers: { ...headers, authorization: `Bearer ${worker.token}` },
        payload,
      });
      expect(res.statusCode).toBe(503);

      const cfg = await app.inject({ method: 'GET', url: '/imports/config' });
      expect(cfg.json()).toMatchObject({ resume: false, linkedin: true });
    } finally {
      resumeConfigured = true;
    }
  });

  it('POST /users/me/import/resume requires auth', async () => {
    const { payload, headers } = multipart('r.pdf', Buffer.from('%PDF'), 'application/pdf');
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/import/resume',
      headers,
      payload,
    });
    expect(res.statusCode).toBe(401);
  });
});
