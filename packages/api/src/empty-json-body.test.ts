import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Regression: a request with `Content-Type: application/json` and an EMPTY body
// used to 400 with FST_ERR_CTP_EMPTY_JSON_BODY, breaking no-payload mutations
// (PUT /connections/:id/accept, POST /payments/jobs/:id/intent, POST /posts/:id/like)
// for any client that sets the JSON header without sending `{}`. buildApp now
// registers a lenient JSON parser that treats an empty body as `{}`.

describe('empty JSON body tolerance', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const u = await prisma.user.create({
      data: {
        firstName: 'Empty',
        lastName: 'Body',
        email: `empty-body-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    worker = { id: u.id, token: signAccessToken(u.id, 'worker') };
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    await app.close();
  });

  it('accepts a no-payload mutation sent with an empty application/json body', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/read-all',
      headers: {
        authorization: `Bearer ${worker.token}`,
        'content-type': 'application/json',
      },
      payload: '',
    });
    // The only acceptable failure here is auth/logic — never the empty-body 400.
    expect(res.statusCode).not.toBe(400);
    expect(res.json()).not.toHaveProperty('code', 'FST_ERR_CTP_EMPTY_JSON_BODY');
    expect(res.statusCode).toBe(200);
  });

  it('still rejects a malformed (non-empty) JSON body with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/read-all',
      headers: {
        authorization: `Bearer ${worker.token}`,
        'content-type': 'application/json',
      },
      payload: '{ not valid json',
    });
    expect(res.statusCode).toBe(400);
  });
});
