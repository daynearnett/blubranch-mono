/**
 * Backfill `isTestAccount: true` onto existing throwaway/fixture rows that
 * `/network/suggestions` was leaking into real users' top-20 (sim findings
 * 2026-10-18 → 2026-11-20: 60-65% junk, same roster every week). Run INSIDE
 * the Railway container (staging DB is internal-only), same pattern as
 * scripts/rotate-db-password.ts:
 *   railway ssh --service blubranch \
 *     "cd /app/packages/api && node_modules/.bin/tsx scripts/mark-test-accounts.ts"
 *
 * Dry-run by default — prints what it would flag. Pass APPLY=true to write.
 *
 * Matches two groups, both worker-role only (the junk the sim saw was all in
 * the worker suggestion pool):
 *   1. Emails matching the exact patterns our own regression scripts use
 *      (stripe-e2e.ts, staging-verify.ts, webhook-test.ts,
 *      verify-moderation.ts) — these are unambiguously throwaway.
 *   2. The exact first/last name pairs the sim's weekly findings docs
 *      actually observed in Ray's top-20 (trim/case-fold, so the known
 *      trailing-space "Bob The builder " dup matches too). These predate
 *      any tagging mechanism and came from ad-hoc manual staging checks, not
 *      a script we can patch — this is a one-time cleanup for them.
 *
 * Never deletes (no account-delete endpoint exists yet — see CLAUDE.md) and
 * never touches seed-demo.ts's curated demo personas (Marcus/Sofia/James/
 * Tanya/Dana/Alex), which are real-looking by design and not in either list.
 */
import { getPrisma } from '../src/lib/prisma.js';

const EMAIL_PATTERNS = [
  /^stripe-verify-\d+@example\.com$/i,
  /^emma-stripe-e2e-\d+@test\.local$/i,
  /^wade-webhook-\d+@test\.local$/i,
  /^modcheck-\d+@example\.com$/i,
];

// Exact junk names observed live in docs/SIM-FINDINGS-*.md (Oct 18 → Nov 20).
const KNOWN_JUNK_NAMES = new Set(
  [
    'Cmp Probe',
    'Verify Owner',
    'Probe Test',
    'Email Test',
    'Dt Probe',
    'Feat Six',
    'Ver Ify',
    'Probe Sprint',
    'Testy Test',
    'Tag Ger',
    'Two Two',
    'Post Get',
    'Bob The builder',
    'Stripe Verify',
    'Mod Check',
  ].map((n) => n.trim().toLowerCase()),
);

function normalizeName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const apply = process.env.APPLY === 'true';
  const prisma = getPrisma();

  const candidates = await prisma.user.findMany({
    where: { role: 'worker', isTestAccount: false },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const toFlag = candidates.filter(
    (u) =>
      EMAIL_PATTERNS.some((re) => re.test(u.email)) ||
      KNOWN_JUNK_NAMES.has(normalizeName(u.firstName, u.lastName)),
  );

  if (toFlag.length === 0) {
    console.log('No matching accounts found. Nothing to do.');
    process.exit(0);
  }

  console.log(`${apply ? 'FLAGGING' : 'DRY RUN — would flag'} ${toFlag.length} account(s):`);
  for (const u of toFlag) {
    console.log(`  ${u.id}  ${u.firstName} ${u.lastName}  <${u.email}>`);
  }

  if (!apply) {
    console.log('\nRe-run with APPLY=true to actually set isTestAccount=true on these rows.');
    process.exit(0);
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: toFlag.map((u) => u.id) } },
    data: { isTestAccount: true },
  });
  console.log(`\nDONE — flagged ${result.count} account(s) as isTestAccount.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('mark-test-accounts failed:', err);
  process.exit(1);
});
