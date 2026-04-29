# BluBranch API — Railway deployment playbook

> Stand up the API on Railway with PostgreSQL + PostGIS + Redis, point the
> TestFlight app at it, and add custom domains for staging + production.
>
> Two environments: **staging** (`api-staging.blubranch.com`) and
> **production** (`api.blubranch.com`). The setup below is the same for
> both — repeat it inside two separate Railway projects.

---

## What's already configured in the repo

| File | Role |
|------|------|
| `packages/api/nixpacks.toml` | owns install / build / start. Pins Node 20 + openssl, installs pnpm 10 globally, runs `prisma generate`, and at boot runs `prisma migrate deploy` then `node --import tsx src/server.ts` |
| `packages/api/railway.toml` | deploy-time settings only (healthcheck `/health`, restart policy, watch paths scoped to api / db / shared) |
| `packages/api/src/app.ts` | CORS allowlist for `*.blubranch.com`, `localhost`, no-Origin (mobile native) — extra origins via `EXTRA_ALLOWED_ORIGINS` env var |
| `packages/api/package.json` | `tsx` lives in **dependencies** (used by the start command via `node --import tsx`) |
| `packages/db/package.json` | `prisma` and `tsx` live in **dependencies** so the start command's `npx prisma migrate deploy` and the seed runner work without `--prod=false` |
| `packages/db/prisma/schema.prisma` | declares `extensions = [postgis]` so Prisma enables PostGIS on first migrate |

---

## Prerequisites

1. **Railway account** — sign up at <https://railway.com>. Free Hobby tier works for a single small service while you're building; bump to a paid plan before TestFlight goes wide.
2. **Railway CLI** — installed locally:
   ```bash
   npm install -g @railway/cli
   railway --version
   ```
3. **Domain registrar access** for `blubranch.com` so you can add CNAME records when Railway gives you a domain target.
4. (Recommended) **A separate Railway project per environment** — one for staging, one for production — so a runaway query in staging can't melt your prod DB.

---

## Step 1 — Log in to Railway

```bash
railway login
```

Opens a browser for OAuth. Stores the session in `~/.railway`.

```bash
railway whoami
```

---

## Step 2 — Create the project

From the **monorepo root**:

```bash
cd ~/Dev/blubranch-mono
railway init
```

Prompts:
- "Project name" → `blubranch-staging` (or `blubranch-production`)
- "Workspace" → your personal workspace (or a team one if you have it)

The command writes `.railway/config.json` linking the local repo to the project. Keep that file out of git (it's already covered by `.railway` patterns being default-ignored, but double-check).

---

## Step 3 — Provision PostgreSQL with PostGIS

Railway's stock Postgres image ships PostGIS; we just need to enable the extension via Prisma's first migration (which is already wired up — `schema.prisma` declares `extensions = [postgis]`).

```bash
railway add --database postgres
```

This:
- Creates a managed Postgres instance
- Auto-injects `DATABASE_URL` into every service in the project
- Tags it `Postgres` in the Railway dashboard

To confirm the version (Railway uses postgres 16 by default, which we know is compatible with our PostGIS migration from local dev):

```bash
railway variables -s Postgres
```

You'll see `DATABASE_URL`, `PGHOST`, `PGUSER`, etc.

> **About the `postgis` extension:** Prisma's first `migrate deploy` will run `CREATE EXTENSION IF NOT EXISTS "postgis"` automatically because we declared it in `schema.prisma`. No manual psql session needed. If for some reason the extension isn't available on the image (you'll see `ERROR: extension "postgis" is not available` in the deploy logs), Railway support can swap to the `postgis/postgis` image; flag this and we'll switch.

---

## Step 4 — Provision Redis

Phase 4 needs Redis for BullMQ + sessions. Add it now so the URL is ready when we get there:

```bash
railway add --database redis
```

Auto-injects `REDIS_URL`. The current API doesn't use Redis yet, so this is a no-op for now — but provisioning early avoids a redeploy later.

---

## Step 5 — Create the API service

```bash
railway add --service blubranch-api
```

Then in the Railway dashboard for that service:

| Setting | Value | Why |
|---------|-------|-----|
| **Source** → Connect Repo | This monorepo | |
| **Source** → Branch | `main` (or whichever you ship from) | |
| **Settings** → Root Directory | **leave blank** (default = repo root) | The build context arrives at `/app` as the monorepo root, which is what `nixpacks.toml`'s `cd /app && pnpm install` expects (the workspace `pnpm-workspace.yaml` lives there) |
| **Settings** → Config-as-Code Path | `packages/api/railway.toml` | Tells Railway to read `railway.toml` from this subpath instead of the repo root. Railway also picks up the sibling `nixpacks.toml` in the same directory. |
| **Settings** → Watch Paths | leave default | `railway.toml`'s `watchPatterns` already scopes rebuilds to api / db / shared |
| **Settings** → Health Check Path | `/health` | Set in `railway.toml`; doubling up in the dashboard is harmless |

After the source connects, Railway runs the install / build phases from `nixpacks.toml`. Watch the build with `railway logs`.

---

## Step 6 — Set environment variables

From the dashboard service → **Variables** tab, add these. The first two are managed automatically by Railway when you link the Postgres + Redis services to the API service via the **Variables → Add Reference** picker — don't paste them by hand.

### Required for Phase 1–3 to function

| Variable | Value | How to set |
|----------|-------|-----------|
| `DATABASE_URL` | (auto) | Add Reference → Postgres.DATABASE_URL |
| `REDIS_URL` | (auto) | Add Reference → Redis.REDIS_URL |
| `JWT_SECRET` | a 64-char random string | `openssl rand -hex 32` locally, paste the result |
| `NODE_ENV` | `production` | plain text |
| `PUBLIC_BASE_URL` | `https://api-staging.blubranch.com` | matches the custom domain you'll set in step 8 — used to build absolute URLs for uploaded image links |

`PORT` is injected automatically by Railway — do **not** set it. The API reads `process.env.PORT` and binds there.

### Optional — APIs the app has dev-fallbacks for

The API will run without these and silently fall back to dev behavior (Twilio logs the verification code instead of texting; geocoding returns Chicago anchor; Stripe / Firebase / Resend simply aren't called yet because Phases 4–5 haven't shipped). Fill them in as services are wired up.

| Variable | When you need it | Note |
|----------|-----------------|------|
| `TWILIO_ACCOUNT_SID` | Phase 1 phone-verify in production | starts with `AC` |
| `TWILIO_AUTH_TOKEN` | same | |
| `TWILIO_VERIFY_SERVICE_SID` | same | starts with `VA` |
| `RESEND_API_KEY` | Phase 4 email | |
| `FIREBASE_PROJECT_ID` | Phase 4 push | |
| `STRIPE_SECRET_KEY` | Phase 5 | starts with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | Phase 5 | starts with `whsec_` |
| `GOOGLE_MAPS_API_KEY` | Phase 3 geocoding (we have a Chicago dev fallback) | |
| `EXTRA_ALLOWED_ORIGINS` | adding a CORS origin without a redeploy (e.g. a Vercel preview URL) | comma-separated, exact origin strings |
| `LOG_LEVEL` | quieter logs | default `info`, can set to `warn` |

You can paste them via the dashboard or use the CLI:

```bash
railway variables --set "JWT_SECRET=$(openssl rand -hex 32)" --set "NODE_ENV=production" --set "PUBLIC_BASE_URL=https://api-staging.blubranch.com"
```

---

## Step 7 — Trigger the first deploy

Railway watches the connected branch — every push triggers a deploy. To kick the first one without committing, run from the monorepo root:

```bash
railway up
```

Watch the build logs:

```bash
railway logs
```

A successful deploy prints something like:
```
Build successful
Starting container...
3 migrations found in prisma/migrations
Applying migration `20260428150143_init`
Applying migration `20260428150200_postgis_geography`
Applying migration `20260428160000_worker_license_number`
All migrations have been successfully applied.
BluBranch API listening on http://0.0.0.0:8080
```

Migrations run inside the start command (per `nixpacks.toml`) right before the server boots. They're idempotent, so a container restart after the first deploy will report "No pending migrations to apply" and skip straight to the `node --import tsx` line.

Then probe `/health`:

```bash
curl https://<railway-generated-domain>.up.railway.app/health
# {"status":"ok"}
```

The Railway-generated domain shows up in the service's **Settings → Networking** tab.

---

## Step 8 — Run the seed (one time, per environment)

After the first migrate completes, the database has the schema but no reference data (12 trades, 102 skills, 9 benefits). Run the seed once via Railway's CLI:

```bash
railway run --service blubranch-api pnpm seed
```

This pipes the production env vars (including `DATABASE_URL`) into a one-off shell that runs `prisma db seed`. Expected output:

```
Seeded 12 trades, 102 skills, 9 benefits.
```

Idempotent — safe to re-run after each new seed entry is added (it uses upsert).

---

## Step 9 — Custom domain

In the API service → **Settings → Networking → Custom Domains**:

1. Click **Generate Domain** if you haven't already (gives you the `*.up.railway.app` placeholder).
2. Click **Custom Domain** → enter `api-staging.blubranch.com` (or `api.blubranch.com` for the prod project).
3. Railway shows a CNAME target like `something.up.railway.app`.
4. At your DNS registrar, add a CNAME record:
   - **Name** → `api-staging` (or `api`)
   - **Value** → the Railway-supplied target
   - **TTL** → 300 (5 min) until things stabilize, then 3600
5. Railway provisions a TLS cert via Let's Encrypt — usually within 5 minutes of DNS propagating.

After the cert lands, update the `PUBLIC_BASE_URL` variable to the new https URL if you didn't already, then redeploy.

```bash
curl https://api-staging.blubranch.com/health
# {"status":"ok"}
```

---

## Step 10 — Point the mobile app at staging

Once `api-staging.blubranch.com` is live, the mobile app's `EXPO_PUBLIC_API_URL` is *already* pointing at it (we set it in `apps/mobile/eas.json` during Phase 2). No config change needed — but you do need to rebuild the IPA so the new bundle picks up a working URL during its background token refresh.

```bash
cd apps/mobile
# bump version + buildNumber in app.json (per TESTFLIGHT-LESSONS.md)
eas build --platform ios --profile preview
eas submit --platform ios --profile preview
```

If you ever need to point at a different URL temporarily (a per-PR Railway preview, say) without rebuilding, edit `EXPO_PUBLIC_API_URL` in `eas.json` `build.preview.env` and rebuild.

---

## Step 11 — Smoke-test against the deployed API

From your laptop, verify the same end-to-end flow we exercised locally during Phase 3:

```bash
API=https://api-staging.blubranch.com

# Register a worker (uses Twilio dev fallback for the phone code)
REG=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"firstName":"Test","lastName":"Worker","email":"smoke@blubranch.test","phone":"+15555550999","password":"superSecret123","role":"worker"}')
TOKEN=$(echo $REG | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

# Pull /users/me
curl -s $API/users/me -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Reference data lookup
curl -s $API/reference/trades | python3 -c 'import sys,json;print(len(json.load(sys.stdin)),"trades")'
```

If reference/trades returns 12 and /users/me returns the new account with an empty worker profile, staging is healthy.

---

## Repeat for production

Steps 2 through 9 again, with these substitutions:

- Project name: `blubranch-production`
- Custom domain: `api.blubranch.com`
- `PUBLIC_BASE_URL`: `https://api.blubranch.com`
- (Recommended) Stronger Postgres/Redis instance sizing
- (Recommended) Different `JWT_SECRET` per environment so a leak in one doesn't cross over

---

## Known issues to flag before going wide

1. **Uploaded images live on the container's local filesystem.** `POST /upload/image` writes to `./uploads`, which Railway wipes on every container restart and redeploy. Acceptable for TestFlight smoke-testing; **NOT acceptable** for real users. Swap in S3 or Cloudflare R2 before any external testers join. The route returns `{ url }` so the mobile contract doesn't need to change — just the storage backend.
2. **No Sentry / log aggregation.** Railway shows the last few thousand lines per service; once we have real traffic we'll want Sentry (errors) + Better Stack or Axiom (logs) wired up. Phase 7 task.
3. **Auto-incrementing build numbers in `eas.json` use Railway-style remote versioning.** Railway has nothing to do with that — it's purely EAS. Mentioned only because someone might assume the two are connected.
4. **`appVersionSource: "remote"` in `eas.json`** means EAS owns iOS `buildNumber` / Android `versionCode`. After a Railway redeploy, you don't need to bump anything in the mobile app — only when you cut a new TestFlight build.

---

## CLI command reference (in run order)

```bash
# One-time setup per environment
railway login
cd ~/Dev/blubranch-mono
railway init                            # name it blubranch-staging
railway add --database postgres
railway add --database redis
railway add --service blubranch-api

# In the dashboard:
#   - Service Source: connect this repo
#   - Settings → Root Directory: leave blank (build context = repo root)
#   - Settings → Config-as-Code Path: packages/api/railway.toml
#   - Variables: link Postgres.DATABASE_URL and Redis.REDIS_URL,
#                set JWT_SECRET / NODE_ENV / PUBLIC_BASE_URL

# First deploy
railway up
railway logs                            # watch the build

# Once `/health` returns 200, seed the DB once:
railway run --service blubranch-api pnpm seed

# Custom domain in dashboard, then verify:
curl https://api-staging.blubranch.com/health

# Repeat all of the above in a second project for production.
```
