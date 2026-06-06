# Phase 4 — deploy playbook (messaging, notifications, push)

> Status as of 2026-06-06: **prepped, not deployed.** Firebase + APNs are fully
> configured (Steps 1–2 below, done). What remains is the Railway deploy, which
> is gated on (a) your Railway account auth and (b) a migration-ledger check.
> Follow this top-to-bottom when you're ready to ship Phase 4 to **staging**.

---

## What's already done (no action needed)

- **Firebase project** `blubranch-2e582` created; iOS + Android apps registered (`com.blubranch.app`).
- **Client config files** committed: `apps/mobile/google-services.json`, `apps/mobile/GoogleService-Info.plist` (Firebase *client* keys — safe to commit; restricted by bundle ID + Security Rules).
- **Service-account key** (server send credential) → `~/.config/blubranch/firebase-service-account.json` (chmod 600, gitignored). Smoke-tested: `firebase-admin` initializes and FCM is reachable.
- **APNs auth key** `UTP8S7DY39` created (team-scoped, Sandbox+Production) and uploaded to Firebase → Cloud Messaging, **both** Development and Production slots. Key file: `~/.config/blubranch/apns-key-UTP8S7DY39.p8`.
- **Phase 4 Prisma migration** generated + validated: `packages/db/prisma/migrations/20260606000000_phase4_messaging_notifications/` (2 enums, `notifications` + `device_tokens` tables, 4 `notify_*` columns on `user_settings`).

## Key facts

| Thing | Value |
|-------|-------|
| Firebase project ID | `blubranch-2e582` |
| FCM sender ID | `1021030466216` |
| iOS bundle / Android package | `com.blubranch.app` |
| Apple Team ID | `WXY2PMFQB7` (Taist, Inc.) |
| APNs Key ID | `UTP8S7DY39` |

---

## ⚠️ Pre-deploy landmine — verify the migration ledger first

A clean `prisma migrate deploy` **fails** at the Phase 3.5 migration on a fresh DB:

```
Applying 20260517000000_phase_3_5_schema
Error: column "location" of relation "jobs" already exists  (42701)
```

The 3.5 migration adds `jobs.location`, but the earlier PostGIS migration already
added it. This is a **pre-existing bug**, unrelated to Phase 4. Phase 4's own
migration is clean — it's #5 in the chain; #4 is the broken one.

Phase 3.5 is live on Railway staging, so it got there somehow (db push / hand-fix).
The deploy is only safe if Railway's `_prisma_migrations` ledger has 3.5 recorded
as **applied** (so `migrate deploy` skips it and runs only Phase 4).

### Step A — check the ledger (read-only)

```bash
railway login          # as a.daynearnett@gmail.com (the account that owns blubranch-staging)
railway link           # pick: blubranch-staging
railway run --service blubranch-api -- npx prisma migrate status
```

- **If it says `Database schema is up to date!` or lists 3.5 under applied** → safe. Skip to Step C.
- **If 3.5 shows under "not yet applied" / pending** → do Step B first.

### Step B — only if 3.5 is NOT recorded as applied

The schema objects already exist on Railway (3.5 is live), so we just tell Prisma
the migration is already in the DB — *without* re-running it:

```bash
railway run --service blubranch-api -- npx prisma migrate resolve --applied 20260517000000_phase_3_5_schema
```

Then re-run `migrate status` to confirm only Phase 4 is pending.

> Long-term: a brand-new **production** DB (deferred TODO) would hit the same wall.
> The durable fix is to make the 3.5 migration idempotent (`ADD COLUMN IF NOT EXISTS`)
> — but editing an applied migration changes its checksum and breaks envs where it's
> recorded. So do the `resolve --applied` baseline per-environment for now; tackle the
> idempotency rewrite as a separate, careful migration-repair task before prod cutover.

---

## Step C — Railway env vars

Set these on the **blubranch-api** service (Railway dashboard → Variables, or `railway variables`):

| Variable | Value |
|----------|-------|
| `REDIS_URL` | reference the existing Redis service: `${{Redis.REDIS_URL}}` (confirm the Redis service name) |
| `FIREBASE_PROJECT_ID` | `blubranch-2e582` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the **minified one-line JSON** (see below) |
| `TWILIO_VERIFY_SERVICE_SID` | your Twilio Verify service SID (`VA…`) — only needed for real SMS on the apply-flow gate; dev fallback logs codes otherwise |

Get the `FIREBASE_SERVICE_ACCOUNT_JSON` value onto your clipboard (never prints to screen):

```bash
cat ~/.config/blubranch/firebase-service-account.min.json | pbcopy
```

Then paste into the Railway variable. (The API reads either `FIREBASE_SERVICE_ACCOUNT_JSON`
*or* `GOOGLE_APPLICATION_CREDENTIALS`; on Railway use the JSON var. Local dev uses the
file path via `GOOGLE_APPLICATION_CREDENTIALS` in `.env`.)

---

## Step D — deploy + verify

Deploy is automatic on push to `main` (Dockerfile `CMD` runs `prisma migrate deploy`
then starts the server, which also boots the in-process BullMQ workers + Socket.io).

```bash
# from a feature branch, open a PR or push to main per your flow
git push
```

Verify after Railway finishes:

1. `curl https://api-staging.blubranch.com/health` → `{"status":"ok"}`
2. Railway logs show: `[Firebase] Initialized with service account` and `[Socket.io] attached to HTTP server` and `[Workers] All queues and repeatable jobs registered`.
3. Migration applied: `railway run --service blubranch-api -- npx prisma migrate status` → up to date.
4. End-to-end push test once a dev/TestFlight build is installed (real FCM token registers via `POST /devices/register`).

---

## Step E — iOS build (EAS) — push provisioning

`@react-native-firebase/messaging` is a native module → **requires a dev/prod build, not Expo Go.**
On the next `eas build -p ios`, EAS will prompt for your Apple login (2FA in terminal) and
set up the Push Notifications provisioning profile — let it **manage credentials automatically**
(it can reuse the `BluBranch Push` APNs key). The `.p8` is also at
`~/.config/blubranch/apns-key-UTP8S7DY39.p8` if EAS ever asks you to supply one.

---

## Secrets inventory (all gitignored / outside repo)

| File | Purpose |
|------|---------|
| `~/.config/blubranch/firebase-service-account.json` | server FCM send credential (firebase-admin) |
| `~/.config/blubranch/firebase-service-account.min.json` | minified, for Railway paste |
| `~/.config/blubranch/apns-key-UTP8S7DY39.p8` | APNs auth key (also uploaded to Firebase + reusable by EAS) |

`.gitignore` guards: `*firebase-adminsdk*.json`, `**/firebase-service-account.json`, `*.p8`.
