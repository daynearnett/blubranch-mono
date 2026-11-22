/**
 * One-off backfill: assign `User.slug` to every existing row where it's
 * still null. No production code path ever set it before lib/slug.ts
 * (registration + social sign-in now set it at creation; trade-card
 * self-heals lazily on first view) — so every account created before this
 * fix landed has `slug: null`, which is why the Trade Card public-share
 * routes (`/u/:slug`, `/share/card/:slug`) 404 for every one of them
 * (confirmed in docs/SIM-FINDINGS-*.md since 2026-10-19).
 *
 * Run INSIDE the Railway container (staging DB is internal-only), same
 * pattern as scripts/rotate-db-password.ts:
 *   railway ssh --service blubranch \
 *     "cd /app/packages/api && node_modules/.bin/tsx scripts/backfill-user-slugs.ts"
 *
 * Safe to re-run — only touches rows where slug is still null.
 */
import { getPrisma } from '../src/lib/prisma.js';
import { generateUniqueSlug } from '../src/lib/slug.js';

async function main() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { slug: null },
    select: { id: true, firstName: true, lastName: true },
  });

  if (users.length === 0) {
    console.log('No users missing a slug. Nothing to do.');
    process.exit(0);
  }

  console.log(`Backfilling slugs for ${users.length} user(s)...`);
  let done = 0;
  for (const u of users) {
    const slug = await generateUniqueSlug(prisma, u.firstName, u.lastName);
    await prisma.user.update({ where: { id: u.id }, data: { slug } });
    done++;
    console.log(`  [${done}/${users.length}] ${u.firstName} ${u.lastName} -> ${slug}`);
  }
  console.log(`DONE — backfilled ${done} slug(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('backfill-user-slugs failed:', err);
  process.exit(1);
});
