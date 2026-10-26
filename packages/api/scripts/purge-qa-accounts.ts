// One-time staging cleanup for leftover QA/script accounts (the ones behind
// the "Testy Test" / "Gate Smoketest" / "Cmp Probe" / "Verify Owner" junk in
// /network/suggestions and people search). These come from running
// staging-verify.ts / verify-moderation.ts / similar probes directly against
// a live database without ever deleting what they created.
//
// This does NOT touch duplicate real-named accounts (e.g. manual
// device-testing signups under a real person's name) — those aren't
// reliably distinguishable by pattern and need a human to pick the right
// one to keep; delete those by id by hand via the admin panel or
// `prisma.user.delete`.
//
// Dry-run by default — lists what WOULD be deleted. Pass --confirm to
// actually delete.
//   pnpm --filter @blubranch/api exec tsx scripts/purge-qa-accounts.ts
//   pnpm --filter @blubranch/api exec tsx scripts/purge-qa-accounts.ts --confirm
import { getPrisma } from '../src/lib/prisma.js';
import { QA_EMAIL_SUFFIXES } from '../src/lib/qa-filter.js';

const prisma = getPrisma();

async function main() {
  const confirm = process.argv.includes('--confirm');

  // Same patterns `excludeQaAccountsWhere()` filters out of suggestions/search.
  const matches = await prisma.user.findMany({
    where: {
      OR: QA_EMAIL_SUFFIXES.map((suffix) => ({
        email: { endsWith: suffix, mode: 'insensitive' as const },
      })),
    },
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[purge-qa] ${matches.length} QA/script account(s) found`);
  for (const u of matches) {
    console.log(`  ${u.createdAt.toISOString().slice(0, 10)}  ${u.email}  (${u.firstName} ${u.lastName})`);
  }

  if (!confirm) {
    console.log('\n[purge-qa] Dry run — pass --confirm to actually delete these accounts.');
    return;
  }

  let deleted = 0;
  for (const u of matches) {
    await prisma.user.delete({ where: { id: u.id } }).catch((err) => {
      console.error(`[purge-qa] failed to delete ${u.email}:`, err);
    });
    deleted++;
  }
  console.log(`[purge-qa] deleted ${deleted}/${matches.length}`);
}

main()
  .catch((err) => {
    console.error('[purge-qa] failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
