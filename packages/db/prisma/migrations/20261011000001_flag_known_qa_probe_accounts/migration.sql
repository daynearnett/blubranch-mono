-- One-time cleanup: flag the specific synthetic placeholder accounts the
-- Aug/Oct tester-agent sim repeatedly observed leaking into
-- /network/suggestions (sim-logs/2026-10-08.md, 2026-10-10.md). These are
-- obviously-synthetic probe names (never a real tradesperson's name), not
-- a real person's account, so flagging them by exact name is safe here.
-- Anything more ambiguous (a real team member's own staging test account)
-- is left for an admin to flag by hand via
-- PUT /admin/workers/:id/test-account.
UPDATE "users"
SET "is_test_account" = true
WHERE "role" = 'worker'
  AND (lower(trim("first_name" || ' ' || "last_name"))) IN (
    'cmp probe',
    'verify owner',
    'probe test',
    'dt probe',
    'email test',
    'feat six',
    'ver ify'
  );
