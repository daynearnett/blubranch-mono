import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import { parseRss, refreshHeadlines, HEADLINE_FEEDS } from './services/headlines.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers Today's
// Headlines: RSS parsing (real Construction Dive item shape), feed priority
// + fallback with a stubbed fetcher, idempotent upsert, and the route.

const FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Construction Dive - Latest News</title>
<item><title>Data center contractors learn to live with the backlash</title>
<link>https://example.com/news/data-center-backlash-test-${Date.now()}/</link>
<description>&lt;figure&gt;&lt;div&gt;&lt;img src="https://img.example.com/story.webp"/&gt;&lt;/div&gt;&lt;/figure&gt;&lt;p&gt;Contractors strive to be &amp;lsquo;active listeners&amp;rsquo; to community concerns.&lt;/p&gt;</description>
<pubDate>Mon, 05 Oct 2026 11:49:00 -0400</pubDate></item>
<item><title>Older story</title>
<link>https://example.com/news/older-test-${Date.now()}/</link>
<description>&lt;p&gt;Old news.&lt;/p&gt;</description>
<pubDate>Sun, 04 Oct 2026 09:00:00 -0400</pubDate></item>
</channel></rss>`;

describe('parseRss (unit)', () => {
  it('extracts title, link, date, image, and summary; newest first', () => {
    const items = parseRss(FIXTURE);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('Data center contractors learn to live with the backlash');
    expect(items[0]!.imageUrl).toBe('https://img.example.com/story.webp');
    expect(items[0]!.summary).toContain("Contractors strive to be 'active listeners'");
    expect(items[0]!.publishedAt.getTime()).toBeGreaterThan(items[1]!.publishedAt.getTime());
    expect(items[1]!.imageUrl).toBeNull();
  });

  it('skips malformed items instead of throwing', () => {
    expect(parseRss('<rss><channel><item><title>No link</title></item></channel></rss>')).toEqual([]);
    expect(parseRss('not xml at all')).toEqual([]);
  });
});

describe('refreshHeadlines + GET /headlines/today', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let workerToken: string;
  let storedUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const w = await prisma.user.create({
      data: {
        firstName: 'Head',
        lastName: 'Liner',
        email: `headline-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    workerToken = signAccessToken(w.id, 'worker');
  });

  afterAll(async () => {
    await prisma.headline.deleteMany({ where: { url: { contains: 'example.com' } } });
    await prisma.user.deleteMany({ where: { email: `headline-${stamp}@test.local` } });
    await app.close();
  });

  it('falls through failing feeds and stores the first that answers', async () => {
    const calls: string[] = [];
    const stub = async (url: string) => {
      calls.push(url);
      if (url === HEADLINE_FEEDS[0]!.url) {
        return { ok: false, text: async () => '' }; // primary down
      }
      return { ok: true, text: async () => FIXTURE };
    };
    const row = await refreshHeadlines(stub);
    expect(row).not.toBeNull();
    expect(calls[0]).toBe(HEADLINE_FEEDS[0]!.url);
    expect(calls[1]).toBe(HEADLINE_FEEDS[1]!.url);
    const stored = await prisma.headline.findFirst({
      where: { url: { contains: 'example.com' } },
      orderBy: { publishedAt: 'desc' },
    });
    expect(stored).not.toBeNull();
    expect(stored!.source).toBe(HEADLINE_FEEDS[1]!.source); // attributed to the feed that answered
    storedUrl = stored!.url;

    // Idempotent: same stub again doesn't duplicate.
    await refreshHeadlines(stub);
    const count = await prisma.headline.count({ where: { url: storedUrl } });
    expect(count).toBe(1);
  });

  it('returns null (not a throw) when every feed fails', async () => {
    const row = await refreshHeadlines(async () => ({ ok: false, text: async () => '' }));
    expect(row).toBeNull();
  });

  it('GET /headlines/today requires auth and serves the stored story', async () => {
    expect((await app.inject({ method: 'GET', url: '/headlines/today' })).statusCode).toBe(401);

    const res = await app.inject({
      method: 'GET',
      url: '/headlines/today',
      headers: { authorization: `Bearer ${workerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { headline } = res.json();
    expect(headline).not.toBeNull();
    expect(headline.title.length).toBeGreaterThan(0);
    expect(headline.source.length).toBeGreaterThan(0);
  });
});
