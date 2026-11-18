import { getPrisma } from './prisma.js';

function baseSlug(firstName: string, lastName: string): string {
  const raw = `${firstName} ${lastName}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw || 'member';
}

/**
 * Lazily generates and persists a public profile slug for a user who
 * doesn't have one yet. Nothing in the signup flow has ever assigned one
 * (confirmed 2026-10-19, reconfirmed 2026-11-16 sim finding), so
 * `GET /u/:slug` and the public Trade Card share (`GET /share/card/:slug`)
 * were unreachable for every account, old or new. Idempotent — returns the
 * existing slug untouched if already set.
 */
export async function ensureUserSlug(
  userId: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { slug: true } });
  if (existing?.slug) return existing.slug;

  const base = baseSlug(firstName, lastName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { slug: candidate },
        select: { slug: true },
      });
      return updated.slug!;
    } catch {
      // Unique collision on `candidate` — loop and try the next suffix.
    }
  }
  const fallback = `${base}-${userId.slice(0, 8)}`;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { slug: fallback },
    select: { slug: true },
  });
  return updated.slug!;
}
