import { describe, expect, it } from 'vitest';
import { postInputSchema } from '@blubranch/shared';

// Carousel bump: posts carry up to 5 photos (was 4) — Instagram-style paging.

describe('postInputSchema photo limit', () => {
  const urls = (n: number) =>
    Array.from({ length: n }, (_, i) => `https://example.com/p${i}.jpg`);

  it('accepts 5 photos', () => {
    expect(postInputSchema.safeParse({ content: 'crew pic', photoUrls: urls(5) }).success).toBe(
      true,
    );
  });

  it('rejects 6 photos', () => {
    expect(postInputSchema.safeParse({ content: 'crew pic', photoUrls: urls(6) }).success).toBe(
      false,
    );
  });
});
