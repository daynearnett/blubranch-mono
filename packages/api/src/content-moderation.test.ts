import { describe, expect, it } from 'vitest';
import {
  decideFromResult,
  isModerationConfigured,
  moderateText,
  moderateImageBuffer,
} from './services/content-moderation.js';

describe('content moderation', () => {
  it('decideFromResult blocks hard categories', () => {
    const r = decideFromResult({ flagged: true, categories: { sexual: true, hate: false } });
    expect(r.blocked).toBe(true);
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain('sexual');
  });

  it('decideFromResult blocks sexual/minors', () => {
    const r = decideFromResult({ flagged: true, categories: { 'sexual/minors': true } });
    expect(r.blocked).toBe(true);
  });

  it('decideFromResult does NOT block soft-only categories', () => {
    // Flagged on harassment (non-threatening) only → allowed (user-report path).
    const r = decideFromResult({ flagged: true, categories: { harassment: true } });
    expect(r.flagged).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it('decideFromResult allows clean content', () => {
    const r = decideFromResult({ flagged: false, categories: { sexual: false, violence: false } });
    expect(r.blocked).toBe(false);
    expect(r.flagged).toBe(false);
    expect(r.categories).toEqual([]);
  });

  it('fails open when not configured', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(isModerationConfigured()).toBe(false);
      expect((await moderateText('anything')).blocked).toBe(false);
      expect((await moderateImageBuffer(Buffer.from('x'), 'image/jpeg')).blocked).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it('empty text is allowed without a call', async () => {
    expect((await moderateText('   ')).blocked).toBe(false);
  });
});
