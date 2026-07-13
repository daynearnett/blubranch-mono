# Production go-live runbook (Phase 7, chunk 7)

Step-by-step to stand up **production**: a dedicated Railway API service +
database at `api.blubranch.com`, Stripe flipped from test → live, and a
production admin user. Mirrors how **staging** was built; the differences are
**data isolation** and **live keys**.

> Prereqs & context to read first:
> - [docs/RAILWAY-DEPLOY.md](RAILWAY-DEPLOY.md) — the full Railway provisioning +
>   env-matrix + custom-domain procedure (staging). This runbook mirrors it.
> - [docs/RAILWAY-LESSONS.md](RAILWAY-LESSONS.md) — Dockerfile/`migrate deploy`
>   gotchas.
> - [docs/PHASE-4-DEPLOY.md](PHASE-4-DEPLOY.md) — the **`jobs.location` migration
>   landmine** (§2 below) that breaks a fresh `migrate deploy`.
> - [docs/PHASE-5-DEPLOY.md](PHASE-5-DEPLOY.md) — Stripe env + Payment Sheet notes.
>
> **Railway CLI is under the personal account** (`a.daynearnett@gmail.com`). If the
> CLI has re-scoped to the Taist workspace, run `railway login` as the personal
> account first (the CLI has silently re-scoped before — see CLAUDE.md).

Values you must supply are written like `<THIS>`. Check boxes as you go.

---

## 0. Decision: separate project (recommended)

Create a **new Railway project `blubranch-production`**, fully separate from
`blubranch-staging`. Rationale: real user data must never share a database or an
env surface with staging, and a separate project makes an accidental
staging-config change incapable of touching prod. (Railway "environments" within
one project are an alternative, but a separate project is the safest isolation
and mirrors staging 1:1.)

- [ ] Confirm this approach (or decide on a prod environment instead and adapt).

---

## 1. Provision the production Railway project

In the Railway dashboard (personal account):

- [ ] **New Project** → name `blubranch-production`.
- [ ] Add **PostgreSQL** plugin. Then enable PostGIS: open the DB → Query, run
      `CREATE EXTENSION IF NOT EXISTS postgis;` (or leave PostGIS off — the API is
      PostGIS-optional; set `POSTGIS_ENABLED=false` if so).
- [ ] Add **Redis** plugin.
- [ ] Add a **service from the GitHub repo** (`daynearnett/blubranch-mono`, branch
      `main`), root directory = repo root. It builds from the repo `Dockerfile`
      (`builder = "DOCKERFILE"` in `railway.toml`), whose `CMD` runs
      `prisma migrate deploy && node --import tsx src/server.ts`.
- [ ] **Disable public networking on Postgres** (internal-only), same as staging —
      the DB is reachable at `postgres.railway.internal` from the API service.

> ⚠️ Do **not** let the first deploy run `migrate deploy` yet — it will fail at the
> 3.5 migration (§2). Either set env vars first and expect the first deploy to
> fail at migration (then fix + redeploy), or pause the service until §2 is done.

---

## 2. First-deploy migration landmine (do once, per fresh DB)

A clean `prisma migrate deploy` **fails** at the Phase 3.5 migration on a brand-new
DB: that migration adds `jobs.location`, but the earlier PostGIS migration already
created a `location` column, so it collides (see PHASE-4-DEPLOY.md §migration).

Fix: mark the 3.5 migration **applied** so `migrate deploy` skips it, before the
first real deploy. Run inside the prod service container (the DB is internal-only):

```bash
# Register an SSH key for the prod service if needed, then:
railway ssh --service <prod-service-name>
# inside the container:
cd packages/api
npx prisma migrate resolve --applied 20260517000000_phase_3_5_schema
exit
```

- [ ] `migrate resolve --applied 20260517000000_phase_3_5_schema` run against the
      **prod** DB.
- [ ] Redeploy; confirm logs show `No pending migrations to apply` (or only the
      later ones applied) and the server boots.

> If a migration ever half-applies and poisons `_prisma_migrations` (`P3009`), see
> RAILWAY-LESSONS.md — on a DB with **no real data yet** you can one-shot
> `prisma migrate reset --force` then revert to `migrate deploy`. **Never** do that
> once real users exist.

---

## 3. Production environment variables

Set these on the **prod API service** (Railway → service → Variables). This is the
staging matrix from RAILWAY-DEPLOY.md **plus** the Phase 7 additions, with
**prod/live** values.

### Core
| Var | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | **a fresh long random string** — NOT the staging one |
| `PUBLIC_BASE_URL` | `https://api.blubranch.com` |
| `POSTGIS_ENABLED` | `true` if you enabled the extension, else `false` |
| `LOG_LEVEL` | `info` |
| `EXTRA_ALLOWED_ORIGINS` | prod admin origin if hosted separately (e.g. `https://admin.blubranch.com`) |

### Integrations (live/prod credentials)
| Var | Notes |
|-----|-------|
| `STRIPE_SECRET_KEY` | **`sk_live_…`** (see §5) |
| `STRIPE_PUBLISHABLE_KEY` | **`pk_live_…`** |
| `STRIPE_WEBHOOK_SECRET` | **live** endpoint secret from the prod webhook (see §5) |
| `STRIPE_PRICE_PRO` | **live** price id for the **Blu** plan ($79/mo → code tier `pro`) |
| `STRIPE_PRICE_UNLIMITED` | **live** price id for the **Blu Max** plan ($139/mo → code tier `unlimited`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` | **paid** Twilio account (trial only texts verified numbers) |
| `RESEND_API_KEY` | prod sending key (`blubranch.com` domain already verified) |
| `FIREBASE_PROJECT_ID` | `blubranch-2e582` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the service-account JSON |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | ideally a **separate prod bucket** (e.g. `blubranch-uploads-prod`), not the staging one |
| `GOOGLE_MAPS_API_KEY` | prod-restricted key |
| `OPENAI_API_KEY` | enables auto-moderation (unset = report flow only) |

### Phase 7 additions
| Var | Notes |
|-----|-------|
| `SENTRY_DSN` | prod Node DSN (unset = Sentry off) — see [docs/MONITORING.md](MONITORING.md) |
| `APPLE_CLIENT_IDS` | `com.blubranch.app` (default; only override for a web Services ID) |
| `GOOGLE_CLIENT_IDS` | comma-sep web+iOS OAuth client ids — see [docs/SOCIAL-AUTH-SETUP.md](SOCIAL-AUTH-SETUP.md) |

- [ ] All core vars set. **`JWT_SECRET` is a NEW value** (a shared secret across
      envs would let a staging token authenticate in prod).
- [ ] All integration vars set with **prod/live** credentials.
- [ ] Redeploy and confirm a clean boot (workers + Socket.io Redis adapter up).

---

## 4. DNS — `api.blubranch.com`

Mirror the staging custom-domain setup (RAILWAY-DEPLOY.md §Custom Domains):

- [ ] Prod service → **Settings → Networking → Custom Domains** → **Custom Domain**
      → enter `api.blubranch.com`.
- [ ] Railway shows a CNAME target like `xxxx.up.railway.app`.
- [ ] At **Network Solutions** (registrar for `blubranch.com`), add a CNAME:
      `api` → `<the railway target>`. (Staging's `api-staging` CNAME points at
      `baccg4xv.up.railway.app` — prod gets its **own** target.)
- [ ] Wait for TLS to provision (Let's Encrypt, a few minutes), then:
      `curl https://api.blubranch.com/health` → `{"status":"ok"}`.

The `eas.json` **production** profile already points the app at
`https://api.blubranch.com` (`EXPO_PUBLIC_API_URL`), so no app change is needed for
the API host.

---

## 5. Stripe: flip test → live

Do this **only at go-live** — live keys move real money.

1. **Live mode keys:** Stripe dashboard → toggle **Test mode → off** → Developers →
   API keys. Copy `sk_live_…` and `pk_live_…`.
2. **Recreate products/prices in LIVE mode** (test-mode price ids do NOT work live):
   - Blu (subscription) → **$79/mo** → new live price id → `STRIPE_PRICE_PRO`.
   - Blu Max (subscription) → **$139/mo** → new live price id → `STRIPE_PRICE_UNLIMITED`.
   - Basic is a one-time $19 PaymentIntent (amount from `PLAN_PRICE_CENTS`, no price
     object needed).
3. **Live webhook:** Developers → Webhooks → **Add endpoint** →
   `https://api.blubranch.com/webhooks/stripe` → subscribe to
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`. Copy the
   **live** signing secret → `STRIPE_WEBHOOK_SECRET`.
4. **Railway (prod service):** set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_UNLIMITED`, `STRIPE_WEBHOOK_SECRET` to the live
   values. Redeploy.
5. **Mobile (`eas.json` production profile):** replace
   `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_REPLACE_ME"` with the real
   `pk_live_…`.
6. **Apple Pay merchant id** (only if enabling Apple Pay — currently card-only):
   the `@stripe/stripe-react-native` plugin in `app.json` has
   `merchantIdentifier: ""` (deliberately empty → card-only, no Apple Pay
   entitlement). To enable Apple Pay: register a Merchant ID in the Apple Developer
   portal, set it here + `enableGooglePay`/Apple Pay in `StripeProvider`, and the
   App ID gains the Apple Pay capability (needs an interactive build). **Skip unless
   you want Apple Pay for launch** — card payments work without it.

- [ ] Live keys + live prices + live webhook all set on prod.
- [ ] `GET https://api.blubranch.com/payments/config` returns a **non-empty**
      `publishableKey` starting `pk_live_`.
- [ ] One real end-to-end test purchase (a real card, small — you can refund it in
      the Stripe dashboard) confirms a job posts live via the webhook.

> **Guard already in place:** `PUT /jobs/:id` cannot flip a draft job to `open`
> for non-admins (the payment-bypass fix), so publishing stays gated on real
> payment even in prod.

---

## 6. Production admin user

The prod DB is internal-only, so create the admin **in-container** (same as
staging), using `packages/api/scripts/create-admin.ts`:

```bash
railway ssh --service <prod-service-name>
# inside the container, from repo root:
ADMIN_EMAIL=<admin@blubranch.com> ADMIN_PASSWORD='<a-strong-unique-password>' \
  pnpm --filter @blubranch/api exec tsx scripts/create-admin.ts
exit
```

- [ ] Admin created (script prints `✓`). Use a **strong, unique** password (not the
      staging admin's).
- [ ] Point the hosted admin panel at prod (rebuild `apps/admin` with
      `VITE_API_URL=https://api.blubranch.com` and redeploy, or use a separate prod
      admin deployment) and verify login returns 200.

---

## 7. Mobile production build

- [ ] `eas.json` production profile: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = live
      key (§5); add `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
      `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the profile `env` if activating those.
- [ ] `submit.production` in `eas.json` has `REPLACE_WITH_…` placeholders — fill
      with the same values already in `submit.preview` (appleId
      `a.daynearnett@gmail.com`, appleTeamId `WXY2PMFQB7`, ascAppId `6764493229`) —
      it's the same App Store app.
- [ ] Build: `eas build --platform ios --profile production` (App Store dist). This
      is also the build that carries the **Apple Sign-in capability** — the one
      interactive build that unblocks social sign-in (see SOCIAL-AUTH-SETUP.md).

---

## 8. Go-live verification checklist

- [ ] `https://api.blubranch.com/health` → 200 `{"status":"ok"}`.
- [ ] `/legal/privacy` + `/legal/terms` render (App Store Privacy URL works).
- [ ] Register a real account on the prod build; email verification arrives (Resend
      prod), SMS verification arrives (paid Twilio).
- [ ] Post a job with a real card → webhook flips it live.
- [ ] Apply + message flow works end-to-end.
- [ ] Sentry receives a test event (temporarily throw in a route, confirm, revert).
- [ ] External uptime monitor pointed at `https://api.blubranch.com/health`
      (MONITORING.md).
- [ ] Admin panel login works against prod.

---

## 9. Rollback & gotchas

- **Auto-deploy:** pushing `main` auto-deploys prod once the GitHub service is
  connected. Confirm the first auto-deploy actually fires (staging has needed a
  manual `railway up` before — see feedback_railway_autodeploy).
- **Env-var redeploys rebuild from `main`.** A dashboard/env change triggers a
  rebuild from the connected branch — so `main` must always be the intended prod
  code (this bit staging once; see CLAUDE.md 2026-06-23).
- **Rollback:** Railway → Deployments → redeploy the previous good deployment.
  Migrations are forward-only — a schema rollback needs a compensating migration,
  not a redeploy.
- **Secrets hygiene:** prod `JWT_SECRET`, Stripe live keys, Twilio, Resend, S3, and
  the DB password must all be **distinct from staging** and never pasted into chat.
