import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import type { FastifyInstance } from 'fastify';

// Public legal pages must be fetchable without auth (App Store listing links,
// web, in-app) and render the canonical shared content.
describe('Legal pages', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /legal/privacy renders HTML, no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/legal/privacy' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('BluBranch Privacy Policy');
    expect(res.body).toContain('Information We Collect');
  });

  it('GET /legal/terms renders HTML, no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/legal/terms' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('BluBranch Terms of Service');
    expect(res.body).toContain('Limitation of Liability');
  });

  it('GET /support renders the App Store support page, no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/support' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('BluBranch Support');
    expect(res.body).toContain('support@blubranch.com');
    expect(res.body).toContain('/legal/privacy');
    expect(res.body).toContain('/legal/terms');
  });

  it('GET /legal lists both documents', async () => {
    const res = await app.inject({ method: 'GET', url: '/legal' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('/legal/privacy');
    expect(res.body).toContain('/legal/terms');
  });
});
