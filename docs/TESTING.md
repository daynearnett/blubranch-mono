# Testing — API integration suite

The `@blubranch/api` package holds the automated test suite we run to validate a
change before pushing **dev → staging → production**. These are **integration
tests**: each file builds the real Fastify app (`buildApp()`) and exercises the
HTTP routes against a **real local Postgres** (the same DB the API uses in dev).

## Running

```bash
# From the repo root
pnpm --filter @blubranch/api test        # or: cd packages/api && pnpm test
```

`pnpm test` at the repo root runs the same suite through Turborepo.

### Prerequisites

1. **Postgres running locally** with the `blubranch` database and `DATABASE_URL`
   set (see `.env`). `pg_isready` should report accepting connections.
2. **Schema in sync with the Prisma client.** If tests fail with `P2022 …
   column … does not exist`, the local DB is behind the schema — sync it:

   ```bash
   export $(grep -E "^DATABASE_URL=" .env | xargs)
   pnpm --filter @blubranch/db exec prisma db push
   ```

   > `db push` syncs the dev DB to the Prisma schema without touching migration
   > history. It does **not** create the PostGIS `geo` columns (those are added
   > by raw SQL in migrations, not modeled by Prisma) — that's fine locally,
   > where the app runs PostGIS-optional and geocoding is best-effort.

The tests create their own users/companies/jobs with a timestamp-suffixed email
and delete them (cascade) in `afterAll`, so they're safe to re-run against a dev
DB. Files run **serially** (`vitest.config.ts` → `fileParallelism: false`) so the
many PrismaClients don't contend on the single shared Postgres.

## What's covered

Core user + monetization flows (the ones we validate against on every change):

| File | Flow |
|------|------|
| `src/worker-onboarding.test.ts` | Worker signup → login → refresh → fill worker profile → pick trades; duplicate-email + validation guards |
| `src/posts-flow.test.ts` | Worker posts; a second worker likes (idempotent), unlikes, comments; single-post fetch; OG share/reshare target; owner-only delete/archive |
| `src/applications-flow.test.ts` | Worker Quick Apply: phone-verification gate → apply → duplicate guard; employer role-gate; employer applicant review + status update; closed-job guard |
| `src/employer-jobs.test.ts` | Employer job posting per plan tier — **Basic** ($19/post), **Blu** (`pro`, $199/mo), **Blu Max** (`unlimited`, $299/mo): publish status, 30/60-day TTL, plan-gated featured/urgent boosts, ownership + payMin/payMax guards |
| `src/connections-flow.test.ts` | Peer networking: request → self/duplicate guards → accept; an accepted connection's post surfaces in the requester's feed |
| `src/payments.test.ts` | Stripe payment gating (draft/402) when Stripe **is** configured; subscription sync/status helpers |
| `src/messages.test.ts` | Messaging REST (conversations, send, read, unread count) |
| `src/admin.test.ts` | Admin login/role-gate + dashboard/list endpoints |
| `src/moderation.test.ts`, `src/content-moderation.test.ts` | Report/issue flow + auto text/image moderation |
| `src/health.test.ts` | `/health` liveness |

### Plan-tier naming

Product names → `PlanTier` enum used in code/tests:

- **Basic** → `basic` — $19 / post (one-time PaymentIntent)
- **Blu** → `pro` — $199 / month (subscription)
- **Blu Max** → `unlimited` — $299 / month (subscription)

### Not covered here

- **Mobile UI** (`apps/mobile`) — these are backend flow tests; RN component
  tests are a separate effort.
- **Reshare** has no backend row — it's a native OS share of the public
  `GET /share/post/:id` URL (OG HTML), which the posts-flow test asserts.
- **PostGIS radius search** ranking — the local dev DB runs without PostGIS, so
  distance ordering is exercised in deploy/staging, not here.
