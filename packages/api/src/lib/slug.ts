import type { PrismaClient } from '@blubranch/db';

/** firstName/lastName → a URL-safe base ("Ray Delgado" → "ray-delgado"). */
export function slugifyName(firstName: string, lastName: string): string {
  const base = `${firstName} ${lastName}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base.slice(0, 80) || 'member';
}

/**
 * Generate a unique `User.slug` for a new or existing user, retrying with a
 * numeric suffix on collision ("ray-delgado", "ray-delgado-2", ...).
 * `User.slug` is the public Trade Card / profile share identifier
 * (`GET /u/:slug`, `GET /share/card/:slug`) — every user needs one, but it
 * was never actually generated anywhere, so it silently stayed null forever.
 */
export async function generateUniqueSlug(
  prisma: PrismaClient,
  firstName: string,
  lastName: string,
): Promise<string> {
  const base = slugifyName(firstName, lastName);
  let candidate = base;
  let suffix = 2;
  // 50 attempts is far more than any realistic name collision depth will hit.
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.user.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
  // Pathological fallback — astronomically unlikely to collide.
  return `${base}-${Date.now().toString(36)}`;
}
