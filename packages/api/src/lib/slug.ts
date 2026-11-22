// Public profile slugs (`/u/:slug`, `/share/card/:slug`). No production code
// path ever assigned one before this file existed — `User.slug` has been
// `null` for every real signup since the column was added (migration
// 20260517000000_phase_3_5_schema), which is why Trade Card public sharing
// has read as "dead" in every sim check since Oct 19. Call
// `generateUniqueSlug` at account creation (registration, social sign-in)
// and lazily from `/users/me/trade-card` to self-heal pre-existing rows.
import type { PrismaClient } from '@blubranch/db';

const MAX_BASE_LEN = 80;

function slugifyName(firstName: string, lastName: string): string {
  const base = `${firstName} ${lastName}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LEN);
  return base || 'user';
}

/**
 * Generates a `User.slug` unique against the DB, retrying with a short
 * random suffix on collision (same real name, or two empty-after-slugify
 * names both falling back to "user"). `User.slug` is `@db.VarChar(100)`.
 */
export async function generateUniqueSlug(
  prisma: PrismaClient,
  firstName: string,
  lastName: string,
): Promise<string> {
  const base = slugifyName(firstName, lastName);

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const existing = await prisma.user.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  // Exhausted retries (astronomically unlikely) — fall back to a fully
  // random slug rather than failing registration over a cosmetic field.
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
}
