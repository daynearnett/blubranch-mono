// One-time backfill for the dead Trade Card / public-profile share bug:
// `User.slug` was never generated anywhere, so every account registered
// before the slug-generation fix landed has `slug: null` and can't be
// reached via GET /u/:slug or GET /share/card/:slug.
//
// Run against an environment after deploying the fix:
//   pnpm --filter @blubranch/api exec tsx scripts/backfill-user-slugs.ts
import { getPrisma } from '../src/lib/prisma.js';
import { generateUniqueSlug } from '../src/lib/slug.js';

const prisma = getPrisma();

async function main() {
  const users = await prisma.user.findMany({
    where: { slug: null },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(`[backfill-slugs] ${users.length} user(s) with no slug`);

  let done = 0;
  for (const u of users) {
    const slug = await generateUniqueSlug(prisma, u.firstName, u.lastName);
    await prisma.user.update({ where: { id: u.id }, data: { slug } });
    done++;
    console.log(`[backfill-slugs] ${u.id} -> ${slug} (${done}/${users.length})`);
  }

  console.log(`[backfill-slugs] done — ${done} user(s) updated`);
}

main()
  .catch((err) => {
    console.error('[backfill-slugs] failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
