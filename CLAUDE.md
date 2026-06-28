# BluBranch — Claude Code Project Context

> **What this file is:** Context for Claude Code sessions. It captures all architectural decisions, mockup analysis, and implementation plans from the initial planning chat so you can pick up exactly where we left off.

## Project overview

BluBranch is a two-sided professional networking and job marketplace platform built specifically for blue-collar skilled workers, tradespeople, and contractors. Workers showcase experience, find local opportunities, and connect with peers. Employers and contractors post and fill jobs.

**Tagline:** "The professional network built for the Blue Collar."

## Key reference docs

- [docs/TESTFLIGHT.md](./docs/TESTFLIGHT.md) — first-time iOS TestFlight setup playbook. `eas login` / `eas init` / `eas build` / `eas submit` step-by-step, plus what's needed in the Apple Developer portal.
- [docs/TESTFLIGHT-LESSONS.md](./docs/TESTFLIGHT-LESSONS.md) — gotchas hit during the first iOS TestFlight cycle (cert limits, SDK version requirements, SDK 52 → 55 launch crash, version-bump conventions). Read this **before** the next iOS rebuild.
- [docs/RAILWAY-DEPLOY.md](./docs/RAILWAY-DEPLOY.md) — API deployment playbook for Railway: provisioning Postgres + PostGIS + Redis, env var matrix, custom-domain setup for `api-staging.blubranch.com` and `api.blubranch.com`, post-deploy seed step.
- [docs/RAILWAY-LESSONS.md](./docs/RAILWAY-LESSONS.md) — gotchas from the first Railway deploy cycle (Nix package naming, pnpm PATH resolution failures, monorepo root-directory setting, NODE_ENV stripping devDeps, `${{Service.VAR}}` reference syntax). Read this **before** the next deploy if anything changes in `nixpacks.toml` or service settings.
- [docs/PHASE-4-DEPLOY.md](./docs/PHASE-4-DEPLOY.md) — Phase 4 deploy playbook (Firebase/APNs config done; Railway env vars + migration-ledger check + deploy steps). **Read this before deploying Phase 4.** Flags a pre-existing 3.5-migration landmine (`jobs.location` collision breaks a fresh `migrate deploy`) and the per-environment `migrate resolve --applied` fix.
- [docs/PHASE-4-TESTFLIGHT-CHECKLIST.md](./docs/PHASE-4-TESTFLIGHT-CHECKLIST.md) — on-device test checklist (messaging real-time, push triggers, SMS apply-gate, presence, 3.5 regression) for Anthony + Balint once the Phase 4 build is in TestFlight.
- [docs/CHANGE-REQUESTS.md](./docs/CHANGE-REQUESTS.md) — append-only log of CRs (Bug, Extension, Enhancement) from cofounder testing. Markdown is source of truth; mirror in Google Sheet via `pnpm sync-crs`.
- [docs/CR-HANDLING.md](./docs/CR-HANDLING.md) — procedure to follow when filing or editing CRs. **Read this** before filing a new ticket or modifying an existing one. Trigger phrases: "CR:", "file this as a CR", "ticket this", or pasted Slack content with a screenshot.
- [docs/CR-LESSONS.md](./docs/CR-LESSONS.md) — gotchas from setting up the CR sync system (grep anchoring, `\K` portability, OAuth consent screen red herring). Read this if `pnpm sync-crs` or `CR-HANDLING.md` behaves unexpectedly.
- [docs/CR-SETUP.md](./docs/CR-SETUP.md) — one-time setup for the Google Sheet sync (service account, env vars). Already completed 2026-05-14; only relevant if re-provisioning on a new machine or for a new contributor.

## Current deployment state (last updated 2026-06-26)

> **Phase 4 is fully shipped + tested via cofounder device-testing. `main` is current (HEAD `b54d921`); branch `phase-4-messaging-notifications` is in sync. Mobile is at `0.1.5 (15)` on TestFlight. Phase 5 (payments) is next — but see "Open items before launch" below: several pre-beta blockers (content moderation, Twilio paid, security-key rotations, admin-panel wiring) are NOT part of Phase 5 and stand between "Phase 5 done" and "launch-ready."**

### Open items before launch (consolidated 2026-06-26 — read before scoping the Phase 7 deadline)
- **PRE-BETA BLOCKERS (must do before any external beta):**
  - **Explicit-content moderation** — auto image/text moderation + user report flow + admin review queue. Launch/legal blocker. Needs admin-panel API routes (see below).
  - **Twilio → paid** — currently on trial; can only SMS *verified caller IDs*. Upgrade before beta or the apply-gate breaks for real testers.
  - **Security-key rotations** — Twilio Auth Token, Resend API key, and the Postgres password were all exposed in chat history. Rotate before widening access.
  - **Admin panel wiring** — `apps/admin` is scaffolded but has NO `/admin/*` API routes. Needed for the moderation queue + in-app bug reports.
- **PRODUCT GAPS (not blockers, but visible):**
  - **Universal Links** — AASA + `/share/open` routes live server-side; needs ONE interactive `eas build --platform ios --profile preview` (Apple 2FA) to enable the Associated Domains capability, then re-add `ios.associatedDomains` to app.json.
  - **Video posts** (LinkedIn-style: upload/storage/playback/thumbnails) — deferred.
  - **Rebuild onboarding-removed fields in account settings** — skills, work history, license/cert, union, travel radius, experience level were removed from onboarding but never relocated.
  - **Unbuilt settings screens** — Profile & visibility, Sign in & security, Language, Help, Feedback, Privacy, Add skills all show "coming soon" (profile-photo persist is done).
  - **Wire Claude for the About bio** — currently template-generated; needs `ANTHROPIC_API_KEY`.
- **DEFERRED INFRA:** Postgres password rotation (full procedure); production custom domain `api.blubranch.com`; Android test device (Samsung A15, deferred to Phase 7 per Anthony).

- **API:** live at both `https://blubranch-production.up.railway.app` (auto-generated) and `https://api-staging.blubranch.com` (custom domain). Custom domain TLS provisioned via Let's Encrypt; CNAME at Network Solutions points at `baccg4xv.up.railway.app`.
- **Database:** Postgres on Railway (`blubranch-staging` project). Seeded with 12 trades, 102 skills, 9 benefits. Public Networking is **disabled** intentionally — `DATABASE_PUBLIC_URL` was exposed in chat history; closing the public endpoint invalidated the URL. Internal access via `postgres.railway.internal` still works for the API service.
- **Mobile app:** version **0.1.5 build (15)** on TestFlight (2026-06-26) — latest cofounder-testing build (location permission no longer auto-fires on signup + iOS usage string; "Me" tab → "My Branch"; inline @-mention tagging w/ 3-branch limit; tap-feed-author-to-profile; functional add-photo card; "Branches" stat). Builds (3)–(15) were rapid device-testing iterations; see the dated entries below for per-build content. **TestFlight submit gotcha (2026-06-23):** Apple froze uploads with `SUBMISSION_SERVICE_IOS_MISSING_REQUIRED_AGREEMENT` until the Account Holder signed an updated agreement in App Store Connect — if a headless submit ERRORs with that code, the Account Holder must sign, then `eas submit --platform ios --profile preview --id <buildId>` re-submits the existing IPA (no rebuild). _Original note:_ build (2) was the first build with the native Firebase module (`@react-native-firebase/messaging`, Direct FCM) and full Phase 4 messaging/push UI. **On TestFlight as of 2026-06-08, testable.** `eas.json` preview profile points at the staging API (`blubranch-production.up.railway.app`). Earlier builds reflect the Phase 3.5 v2 rebuild (5-step signup, Network tab, profile/verification system, upgraded feed + search). Preview profile now has `autoIncrement: true` + `submit.preview.ios.ascAppId = 6764493229` so builds + TestFlight submits run headlessly.
- **Admin panel:** `apps/admin` scaffolded (Vite + React 19 + shadcn/ui, BluBranch palette) and builds green, but is **not yet wired** — no `/admin/*` API routes exist. Not deployed.
- **CR system:** fully operational as of 2026-05-14. Google Sheet (`20260508_BluBranch_CRTracker_MasterList_v01`) mirrors `docs/CHANGE-REQUESTS.md` via `pnpm sync-crs`. Service account credentials at `~/.config/blubranch/cr-sync-service-account.json`; env vars in `~/.zshrc`. End-to-end round-trip verified with a test ticket. ~15 unprocessed CRs from cofounder still in Slack channels (`#admin-panel`, `#android-builds`, `#automation`, `#ios-builds`, `#payments`, `#performance`, `#styling`) — not yet transcribed into the system.
- **Deferred TODO:** full Postgres password rotation. Public Networking is off (closed ~80–90% of risk), but the actual DB password is still the one that was visible in chat. Multi-step procedure (`ALTER USER` + Edit `POSTGRES_PASSWORD` + verify API reconnects) — do when nothing else is in flight; budget ~15–20 min.
- **Deferred TODO:** custom domain for production (`api.blubranch.com`). Eas.json `production` profile already references it; just needs DNS + Railway custom-domain setup mirroring what was done for staging.
- **Phase 4 new deps (not yet deployed):** `socket.io`, `ioredis`, `@socket.io/redis-adapter`, `bullmq`, `firebase-admin` in `packages/api`; `socket.io-client`, `expo-notifications`, `expo-device`, `expo-constants`, `@react-native-firebase/app`, `@react-native-firebase/messaging` in `apps/mobile`. Railway deploy needs: `REDIS_URL` wired to the existing Redis service (already provisioned), `FIREBASE_SERVICE_ACCOUNT_JSON` + `FIREBASE_PROJECT_ID=blubranch-2e582` for push notifications.
- **Phase 4 — DEPLOYED to staging + on TestFlight (2026-06-08):** Phase 4 (messaging, notifications, real-time, push) is live on staging (`api-staging.blubranch.com`) and the iOS build `0.1.5 (2)` is on TestFlight. `main` at `b220d2b`. Staging startup verified clean from logs: Phase 4 migration applied (`No pending migrations to apply`), `[Workers] All queues and repeatable jobs registered` (BullMQ + Redis), `[Socket.io] Redis adapter active`, server listening, no crashes. Firebase project `blubranch-2e582` (service-account + APNs key `UTP8S7DY39` in `~/.config/blubranch/`, APNs uploaded to Firebase dev+prod). Staging env vars set: `REDIS_URL` (already wired), `FIREBASE_PROJECT_ID=blubranch-2e582`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
  - **Deploy mechanics learned (gotchas):** (1) **GitHub→Railway auto-deploy did NOT fire** on push to `main` — had to trigger manually with `railway up`. (2) `railway.toml` `watchPatterns` was **silently skipping the build** ("no changes detected in watch paths") even on real changes — **removed watchPatterns** (restore the scoped list once auto-deploy is confirmed working; it's commented in the file). (3) Staging Postgres has **no public networking** (internal-only) so `railway run`/`railway connect` can't reach the DB from a laptop — registered a `railway ssh` key for in-container access; but the deploy's own `migrate deploy` is the reliable path. (4) The personal `daynearnett`/`a.daynearnett@gmail.com` accounts own the repo + Railway project; the Taist-org CLIs can push to the repo (TaistApp has write) but **Railway requires `railway login` as the personal account**.
  - **Four real bugs caught only in a real deploy (all fixed, on main):** `socket.ts` Redis-adapter crash on Redis outage (now falls back to in-memory); `server.ts` registered `onClose` hook AFTER `listen()` → `FST_ERR_INSTANCE_ALREADY_LISTENING` crash-loop (moved before listen); Railway `watchPatterns` build-skip; `eas.json` preview missing `autoIncrement` → duplicate `CFBundleVersion` TestFlight rejection.
  - **iOS build credential note:** the FIRST build needed ONE interactive `eas build` (Apple login/2FA) to **enable Push Notifications capability on the App ID** + regenerate the provisioning profile (the non-interactive build errored on the missing `aps-environment` entitlement). Apple's APNs-key limit was hit so we **reused** an existing key rather than generating new. After that one-time setup, builds + submits run **headlessly** via `EXPO_TOKEN` (`~/.config/blubranch/expo-token`, account `daynearnett`) + cached creds + the EAS-managed ASC submit key.
  - **Phase 4 roadmap notification gaps closed + deployed (2026-06-08, main `05684d6`):** the 3 deferred roadmap items are now built, verified (11/11 gap checks), and live on staging — (1) **job-match notifications** (BullMQ scan every 30 min: new open job → workers matching trade + city/state, open-to-work, opted-in, not-already-notified; works without PostGIS); (2) **profile-view notifications** (throttled 1/viewer/24h from the public profile routes); (3) **weekly profile-nudge** (workers with `profileCompleteness < 70`, 7-day cooldown). Added `profile_view`/`profile_nudge` notification types + `notifyProfileViews`/`notifyProfileNudges` prefs (migration `20260608000000`). These are backend triggers — they work with the existing TestFlight build `0.1.5 (2)` (no app rebuild needed). **Minor follow-up:** mobile Settings UI toggles for the 2 new prefs not yet added (default on).
  - **Twilio configured on staging (2026-06-08):** separate BluBranch Twilio account (login `a.daynearnett@gmail.com`, distinct from Taist's production Twilio which is a paid account under `dayne@taist.app`). On **trial** ($15-ish credit) with a Verify service named "BluBranch" (`TWILIO_VERIFY_SERVICE_SID` = `VA9f3aab…`). `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` set on the staging service; creds validated against the Verify API. The apply-gate now sends real SMS. **Trial caveat:** can only text *verified caller IDs* — add tester phones in Twilio Console → Phone Numbers → Verified Caller IDs; upgrade to paid before a real beta. **Security:** Auth Token was shown in a screenshot during setup — rotate it (Twilio → Account Info → regenerate) when convenient. On-device checklist: [docs/PHASE-4-TESTFLIGHT-CHECKLIST.md](./docs/PHASE-4-TESTFLIGHT-CHECKLIST.md).
  - **Resend wired on staging (2026-06-16):** `blubranch.com` domain **verified** in Resend (DKIM `resend._domainkey` + SPF/MX on `send` subdomain + `_dmarc`, all added at Network Solutions; region us-east-1). `RESEND_API_KEY` (`re_VhCP…`, sending-only restricted key) set on the staging service + redeployed. Signup email-verification now sends **real emails** from `noreply@blubranch.com` (`EMAIL_FROM` unset → code default `BluBranch <noreply@blubranch.com>`); `/auth/send-verification-email` no longer returns `devCode`. Verified end-to-end: live `{"sent":true}` (no devCode) → real email delivered. **Security:** the Resend key was exposed in chat history — rotate it (Resend dashboard → API Keys) when convenient. **Note:** first sends from a new domain may land in spam until reputation builds.
  - **Onboarding overhaul + dual-capability + token-refresh DEPLOYED to staging; build `0.1.5 (4)` building → TestFlight (2026-06-18):** From cofounder device-testing feedback. Branch `phase-4-messaging-notifications` (commit `f596683`) deployed to staging via `railway up` — **NOT merged to `main` yet** (staging now runs branch code ahead of main). Verified end-to-end against staging (worker registers → `currentStartDate` persists → `POST /companies` returns 201).
    - **Individual-first onboarding:** role picker, travel radius, years-of-experience, license/cert #, union, and the Top-skills / Show-your-craft / Privacy pages all **removed from onboarding**. New flow: Name → Account → Verify → Location → Trade + current job → Photo & bio (finish). Company + job title now **required**; **start/end date** captured (new `current_start_date`/`current_end_date` VARCHAR(7) columns, migration `20260618000000_worker_current_job_dates`, applied clean on staging). Headline defaults from job title; About has a **template-generated** "Generate" (real Claude call deferred until `ANTHROPIC_API_KEY` exists).
    - **Dual-capability employer:** `/companies` + `/jobs` create/edit/list gates relaxed from `requireRole('employer','admin')` to `requireAuth` (ownership still scoped by `employerId === user.id`) so a worker can also own a company + post jobs without losing worker features. Employer setup now entered from a "Looking to hire? Post a job" banner on the **+ tab** (role picker removed from signup).
    - **Bug fixes (from testing):** in-app **notifications inbox** + header **bell unread badge** (backend already created connection/message/etc. notifications; nothing surfaced them); post **Comment** screen wired (backend existed); **Share** via native OS sheet. Plus mobile **refresh-on-401 + retry** in the API client and **access-token TTL 15m→1h** (`jwt.ts`, stopgap — revisit toward 15m once the refresh-on-401 build is confirmed on TestFlight); login email validation + iOS autofill hints + readable (non-uppercased) error text.
    - **Follow-ups:** merge `phase-4-messaging-notifications` → `main`; wire Claude for the About bio; rebuild the onboarding-removed fields (skills, work history, license/cert, union, travel radius, experience level) in **account settings** — they're currently only removed from onboarding, not relocated.
  - **Device-testing round 2 — builds `0.1.5 (5)` + `(6)`, DEPLOYED to staging (2026-06-18→19):** Same branch, more cofounder feedback. Staging API redeployed via `railway up` (still ahead of `main`); all backend changes verified live.
    - **Build `(5)`:** MM/YYYY job-date order + inline validation (block future / end-before-start dates) with friendly messages; **server accepts MM/YYYY or YYYY-MM** dates (lenient, unblocked `(4)` signup without a rebuild); comments screen shows the **post preview** (new `GET /posts/:id`, feed shape) so the `blubranch://post/<id>` Share deep link lands meaningfully.
    - **Build `(6)`:** **photo posts** (composer camera → pick/upload up to 4, backend already took `photoUrls`); feed **refetch-on-focus** so like/comment counts update; **blue-collar search filters** (job type + min pay for Jobs, open-to-work + union for People) + a **Posts tab** (`searchQuerySchema` extended; `/search` handler filters + posts branch); **top comments** under feed posts (`/feed` returns latest-2 `topComments`); **rich OG link previews** — public `GET /share/post/:id` serves OpenGraph HTML (logo + author + excerpt, deep-links into app) + `GET /share/logo.png` (asset at `packages/api/assets/og-logo.png`); Share now sends the https `/share/post/:id` URL. Logo serve verified 200 in-container (API runs via `tsx src/server.ts`, so `import.meta.url`-relative asset path resolves).
    - **Deferred to weekend:** **video posts** (LinkedIn-style — upload/storage/playback/thumbnails). **Pre-beta must-do:** **explicit-content moderation** (auto image/text moderation + report flow + admin queue). Both in [docs/PHASE-ROADMAP.md](docs/PHASE-ROADMAP.md) "Feed & content backlog".
    - **Build `(7)`, DEPLOYED to staging (2026-06-19):** signup **"I'm seeking a blue-collar job"** toggle (hides company/title/dates, marks actively-looking; CTA renamed "Start branching out"); comments composer respects bottom safe-area; **logo** on onboarding screens + **branded splash** overlay ("Networking for the Blue Collar", ~1.8s). **Like/comment notifications** — `post_like`/`post_comment` types + `notifyPostLikes`/`notifyPostComments` prefs (migration `20260619000000`), triggers on like/comment (in-app + FCM push + **email** — email only for connection/like/comment, not DMs/views), Likes/Comments toggles in settings. **Post delete + archive** (`DELETE /posts/:id`, `PUT /posts/:id/archive`, owner-scoped; feed excludes archived; post-card ••• menu). Verified live: like→`post_like` notification, archive 200, delete 200. **Push-delivery caveat:** in-app + email fire server-side and are verified; FCM **banner** push still depends on the device having granted notification permission + a registered token — needs on-device confirmation (and a *second* account to act on your post; solo testing won't trigger like/comment notifs).
    - **S3 image storage CONFIGURED on staging (2026-06-19):** uploads now persist (were on the API container's ephemeral local disk → wiped on every `railway up`, causing the post-image gray-box). AWS S3 bucket **`blubranch-uploads`** in **`us-east-2`** (Ohio), public-read bucket policy (objects served at `https://blubranch-uploads.s3.us-east-2.amazonaws.com/uploads/<uuid>.<ext>`), IAM user `blubranch-uploader` with PutObject/GetObject/DeleteObject. Railway vars set on the `blubranch` service: `S3_BUCKET`, `S3_REGION=us-east-2`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (secret entered in Railway dashboard, not chat). `isS3Configured()` (s3.ts) needs all of bucket + access key + secret. **Server-side fix — works on any build, no rebuild.** Verified live: API upload → S3 URL → public fetch HTTP 200. Images uploaded before this (on ephemeral disk) are gone. **Note:** public bucket = anyone with the URL can view; fine for social/post photos. **Deferred builds `0.1.5 (8)`–`(12)` (2026-06-19):** CAT-Yellow palette + navy primary CTAs, app-icon logo (welcome/header), network-first welcome slides + hard hat, MM/YYYY + future-date guards, https email links + Universal Links (AASA + `ios.associatedDomains`), profile-photo upload (`PUT /users/me/photo` + Me-tab avatar tap), image crop control (allowsEditing + square display), composer reset after post, comments refetch-on-send, phone **E.164** normalization, **tagging** connections in posts/comments (`post_mention` type + `notifyMentions`, migration `20260619100000`, ConnectionPicker). Branch still `phase-4-messaging-notifications`, ahead of `main`.
    - **Branch MERGED → main + builds `0.1.5 (13)`–`(14)` (2026-06-23):** **`main` is now current** (fast-forwarded to branch HEAD `35815af`, pushed to GitHub) — branch no longer ahead. **Why forced (gotcha):** staging silently **rolled back** to stale `main` when the S3 env-var change triggered a Railway redeploy — **env-var/dashboard-triggered redeploys rebuild from the GitHub-connected branch (`main`), NOT from the last `railway up` artifact**. Since all work was on the unmerged branch, the redeploy wiped every `railway up`-only route (share pages, `/users/me/photo`, `/posts/:id/archive`, `/tag-suggestions`, mention triggers) → 404s. Fix: merge branch→main + push so GitHub auto-deploy serves the right code (future env-var redeploys now stay correct). **Also:** the Railway CLI had re-scoped to the **Taist** workspace (`contact@taist.app`); `blubranch-staging` is under the **personal** account, so `railway up`/`railway link` fail until `railway login` as `a.daynearnett@gmail.com` — pushing GitHub `main` sidesteps the CLI entirely. Build `(13)` removed the associatedDomains entitlement (Universal Links still deferred — needs one interactive `eas build` for Apple 2FA to enable the Associated Domains capability). Build `(14)` content: **tagging redesigned** — inline **@-mention** autocomplete (`MentionTextInput`) replaces the full-screen `ConnectionPicker` (deleted; its off-screen back button trapped users); new `GET /tag-suggestions` returns taggable users **within 3 connection degrees** (capped BFS over accepted connections, name-filtered); **feed post author tappable** → public profile; **"Add a profile photo" enrichment card** now opens the real picker; profile **"Connections" stat relabeled "Branches."** Backend verified live (`/tag-suggestions` 401); build `(14)` FINISHED + auto-submitted.

## Maintenance note

This file (`CLAUDE.md`) is the project's context-transfer doc. Keep it accurate: when a deployment state changes (new domain live, env var added, deferred TODO completed, dependency upgrade), update the "Current deployment state" section with the new date. Stale state in this file is worse than no state, because future Claude Code sessions will trust it.

## Reference architecture

This project is modeled on the [Taist monorepo](https://github.com/TaistApp/taist-mono) — a mobile marketplace (React Native + Expo) connecting customers with local personal chefs. We're adapting that proven architecture with two key changes:

1. **Backend:** Node.js (Express or Fastify) instead of PHP/Laravel
2. **Multi-form-factor:** Mobile + tablet + desktop (Taist is mobile-only)

Everything else mirrors Taist: Railway hosting, Expo EAS builds, Stripe Connect payments, Firebase push notifications, Twilio SMS, Resend email, and a React admin panel.

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Monorepo | Turborepo | Workspace management |
| Mobile/tablet/desktop | React Native + Expo (SDK 52+) | Single codebase, web export for desktop |
| Backend | Node.js (Express or Fastify) | REST API |
| Database | PostgreSQL + PostGIS | Geospatial job matching is critical |
| ORM | Prisma | Type-safe queries, migrations |
| Cache/queues | Redis + BullMQ | Sessions, job queues, caching |
| Real-time | Socket.io | In-app messaging |
| Push notifications | Firebase Cloud Messaging | |
| SMS | Twilio | Phone verification, alerts |
| Email | Resend | Transactional email |
| Payments | Stripe Connect | Employer pays, worker gets paid |
| Maps | Google Maps API | Job location, worker radius |
| Admin panel | React web app | Separate app in monorepo |
| Hosting | Railway | Backend + DB + Redis |
| Mobile builds | Expo EAS | TestFlight (iOS), APK/Play Console (Android) |
| Incorporation | Clerky (Delaware C-Corp) | In progress |

## Monorepo structure (target)

```
blubranch-mono/
├── apps/
│   ├── mobile/              # React Native + Expo app
│   └── admin/               # React web admin panel
├── packages/
│   ├── api/                 # Node.js backend
│   ├── shared/              # Shared types, constants, validation (Zod)
│   └── db/                  # Prisma schema + migrations
├── docs/
│   ├── TECH-STACK-OVERVIEW.md
│   ├── DATA-MODEL.md
│   ├── MOCKUP-ANALYSIS.md
│   └── PHASE-ROADMAP.md
├── turbo.json
├── package.json
├── .gitignore
├── .env.example
└── CLAUDE.md                # ← You are here
```

## Two-sided user model

BluBranch has two user types (analogous to Taist's customer/chef split):

- **Workers (tradespeople):** Free to use. Create profiles showcasing trade, skills, certifications, portfolio photos, work history. Browse and apply to jobs. Post to the social feed. Connect with peers.
- **Employers/contractors:** Pay to post jobs ($49 basic / $129 pro / $299/mo unlimited). Create company profiles. Review applicants. Message workers directly (on paid plans).

Single `users` table with a `role` enum (`worker | employer | admin`), with role-specific profile tables joined via foreign key.

## Key features from mockups

See `docs/MOCKUP-ANALYSIS.md` for the full screen-by-screen breakdown. Summary:

- **Auth:** Email/password + Apple + Google + Facebook sign-in. "Workers always free" messaging.
- **Signup:** 3-step wizard (account → trade selection → location/radius)
- **Profile creation:** 4-step wizard (photo & bio → skills & certs → work photos → privacy settings)
- **Home feed:** Social feed with posts (likes/comments/shares) + inline job cards ("Jobs near you")
- **Worker profile:** 3 tabs (About, Portfolio, Posts) with stats (connections, posts, rating, endorsements), badges (union, license verified, open to work)
- **Job board:** Filterable by trade, sortable by distance. Featured/boosted listings. Quick Apply flow.
- **Job detail:** Full listing with requirements, benefits tags, employer info, applicant count
- **Employer posting:** 6-step wizard (choose plan → company info → job details → perks & boosts → review → confirmation)
- **Navigation:** 5 bottom tabs — Feed, Finances, Post (+), Jobs, Profile

## Responsive layout strategy

Mobile (< 768px) → bottom tab navigator (standard mobile)
Tablet (768–1024px) → collapsible sidebar + content area
Desktop (> 1024px) → persistent sidebar + content + detail panel (three-column)

Use `useWindowDimensions()` hook + conditional navigator swap. Don't build separate screens — build screen layouts that rearrange the same components.

## Environments (matching Taist)

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | `api.blubranch.com` | Live users |
| Staging | `api-staging.blubranch.com` | Pre-release testing |
| Admin (prod) | `admin.blubranch.com` | Production management |
| Admin (staging) | `admin-staging.blubranch.com` | Test admin features |

## Build phases

See `docs/PHASE-ROADMAP.md` for the detailed week-by-week plan. High-level:

| Phase | What | Weeks |
|-------|------|-------|
| 0 | Monorepo scaffold, tooling, CI | 1–2 |
| 1 | Auth + user profiles | 3–5 |
| 2 | Responsive layout system | 4–6 (parallel) |
| 3 | Job marketplace core (PostGIS) | 6–10 |
| 4 | Messaging, notifications, real-time | 10–13 |
| 5 | Payments (Stripe Connect) | 13–15 |
| 6 | Admin panel | 14–16 (parallel) |
| 7 | Testing, hardening, launch prep | 16–20 |

**Highest-risk item:** Phase 3 geospatial matching (PostGIS). Prototype early.

## Design tokens (not final — will be swapped)

The mockups use a dark navy / orange / white palette. Colors are not finalized but the token structure should be set up for easy swapping:

```
--color-primary: #E8713A        (orange — CTAs, accents)
--color-primary-dark: #1B3A5C   (dark navy — headers, profile banner)
--color-cta-dark: #1E3D5C       (dark blue — secondary CTAs like "Take me to my feed")
--color-background: #FFFFFF
--color-text-primary: #1A1A1A
--color-text-secondary: #6B7280
--color-success: #22C55E        (verified badges)
--color-danger: #EF4444         (urgent badges)
```

## Current status

- [x] Domain secured
- [x] USPTO trademark search — no conflicts
- [x] Clerky incorporation in progress (Delaware C-Corp)
- [x] Mockups complete (20 screens, 7 user flows)
- [x] Tech stack decided
- [x] Architecture planned
- [x] **Phase 0 — monorepo scaffold complete** (verified 2026-04-28: build green, `/health` responding, Prisma schema valid)
- [x] **Phase 1 — auth & user profiles complete** (verified 2026-04-28: register/login/refresh/profile flows green against local Postgres 17 + PostGIS; mobile signup + profile-creation + profile-view screens scaffolded)
- [x] **Phase 2 — responsive layout system complete** (verified 2026-04-28: useLayout + ResponsiveTabBar, mobile bottom-tabs vs tablet/desktop sidebar; expo web export produces 14 static routes)
- [x] **Phase 3 — job marketplace core complete** (verified 2026-04-28: geocoding + PostGIS ST_DWithin radius search, full employer wizard 7A→7F, Quick Apply with applicant dashboard, mixed home feed, hourly expiration cron; web export now bundles 24 routes; onboarding flow verified on TestFlight 2026-05-01)
- [x] **Phase 3.5 — v2 build-guide parity complete** (merged to main 2026-05; commits `423564e`→`6371ab0`. Bridge between Phase 3 and Balint's v2 mockups/build-guide, all 8 chunks done: (1) schema + design-system foundations — `License`/`WorkPlace`/`BookmarkedJob`/`SearchLog` tables, Balint's hex tokens, Lucide icons, S3 uploads; (2) onboarding rebuild S1–S8 — 3-slide carousel, 5-step signup, email verification via Resend; (3) profile system S9–S14 — verifications hub, public `/u/{slug}`, license/workplace flows; (4) navigation & settings — Feed/Network/Post/Jobs/Me tabs, TopSearchBar, Settings S26; (5) network system S18–S20 — connections, PYMK, degree calc; (6) feed & post composer S15–S17; (7) jobs & search upgrades S21–S25 — match scoring, bookmarks, `tsvector` full-text search; (8) security hardening — HSTS/CSP, Upstash rate limits, HIBP, WCAG AA, EXIF strip. See `docs/PHASE-3.5-PLAN.md` for the full chunk-by-chunk record.)
- [x] **Admin panel scaffolded** (2026-06-01, commit `e68aa8e`: `apps/admin` brought to parity with Taist's admin stack — Vite 7 + React 19 + Tailwind v4 + shadcn/ui + TanStack Query/Table — branded with BluBranch palette (orange `#E85D20`, navy `#0F2D52`). Login/dashboard + 9 stub pages render and build green. **No `/admin/*` API routes exist yet** — admin auth + guard + `/admin/dashboard` + per-page list endpoints still need building before the panel is functional.)
- [x] **PostGIS migration collision fixed** (2026-06-01, commit `0d148b5`: the geography point column was renamed `location` → `geo` on `jobs` and `worker_profiles` so it no longer collides with Phase 3.5's human-readable `jobs.location VARCHAR(200)`. Was causing P3006 on PostGIS-present databases. Existing DBs that skipped the geography column see an identical end-state.)
- [x] **Phase 4 — messaging, notifications, real-time complete** (verified 2026-06-06: all 6 chunks built; 10/10 backend tests; TS clean. Deep local verification done: Phase 4 migration applies clean on a 3.5-state DB; real-time socket path exercised end-to-end with live clients (connect, message delivery, typing, read receipts, JWT-reject — 5/5); notification triggers (persist + per-type preference gating + no-device handling — 4/4). Four bugs caught during the real deploy were fixed (Redis-outage socket crash, `server.ts` addHook-after-listen crash-loop, Railway watchPatterns build-skip, eas preview autoIncrement). **DEPLOYED to staging + on TestFlight as `0.1.5 (2)` (2026-06-08, main `b220d2b`)** — staging startup verified clean (migration applied, workers + Socket.io Redis adapter up). On-device testing pending via the TestFlight checklist; Twilio creds still needed for the SMS apply-gate. See the "Current deployment state" section above and docs/PHASE-4-DEPLOY.md.)
  - [x] Chunk 1: Redis + BullMQ foundation — `ioredis` singleton, BullMQ queue factory + workers, migrated `expire-cron` from `setInterval` to repeatable BullMQ job, added nightly license-expiration job
  - [x] Chunk 2: Messaging REST API — `GET /conversations`, `GET /conversations/:id/messages` (cursor pagination), `POST /conversations/:id/messages`, `POST /messages` (start convo by recipientId), `PUT /conversations/:id/read`, `GET /messages/unread-count`; 50/day non-connection send limit via Redis (fail-open on Redis down); Zod schemas in `@blubranch/shared`
  - [x] Chunk 3: Socket.io real-time — JWT auth handshake, Redis adapter for horizontal scaling, `message:new` / `message:read` events, `typing:start` / `typing:stop` relay with 10s auto-clear, online presence via Redis sorted set + heartbeat; wired to Fastify's HTTP server
  - [x] Chunk 4: Mobile messaging UI — conversations list screen, chat thread screen (inverted FlatList, cursor pagination, typing indicator, composer), new-chat screen for first-message flow; `useSocket` hook (singleton, auto-reconnect, presence heartbeat); TopSearchBar messages icon wired; Network quick-message button wired; API client extended with `messages.*` and `notifications.*` namespaces
  - [x] Chunk 5: Push notifications (Direct FCM, matching Taist) — `firebase-admin` on API with lazy init + graceful degradation, FCM multicast dispatch with invalid-token cleanup, notification triggers on new message / connection request / connection accept / application status change; mobile uses `@react-native-firebase/messaging` `getToken()` for a real FCM token on both platforms (iOS does the APNs→FCM exchange on-device), `expo-notifications` for foreground display + Android channel, `onTokenRefresh` keeps the server synced; `usePushNotifications` hook; `Notification` + `DeviceToken` Prisma models, notification preferences on `UserSettings`, full REST endpoints. app.json wired with `@react-native-firebase/app` plugin, `useFrameworks: static` + `forceStaticLinking` for iOS, `googleServicesFile` refs. **Requires a dev/prod build (not Expo Go) and the Firebase config files dropped in (see manual setup).**
  - [x] Chunk 6: Twilio SMS verification gate — `phoneVerified` check before `POST /jobs/:id/apply` returns `PhoneVerificationRequired` error; existing `POST /auth/verify-phone` now sets `phoneVerified: true`; mobile verify-phone screen with phone input + 6-digit code flow; QuickApplyModal catches 403 and auto-navigates to verify-phone with `returnTo` job ID
- [~] **Phase 5 — payments (Stripe)** — BUILT + locally tested on branch `phase-5-payments` (not yet deployed). Scope = employer→platform payments only (Basic $49 / Pro $129 one-time PaymentIntents + Unlimited $299/mo Subscription); worker Connect payouts deferred post-beta. Backend: `services/stripe.ts` (lazy singleton + `getOrCreateCustomer`), `routes/payments.ts` (Payment Sheet intents, subscription create/status/cancel, `/confirm` backstops) + raw-body `/webhooks/stripe` plugin; `POST /jobs` is now payment-aware (Basic/Pro → `draft` until Stripe confirms; Unlimited → `open` only with active sub, else 402; admin/Stripe-unconfigured → immediate `open`, preserving dev behavior). Schema migration `20260627000000_phase5_payments` (`users.stripe_customer_id`, `payments`, `subscriptions`). Mobile: native Payment Sheet (`@stripe/stripe-react-native` + `StripeProvider`) in post-job/review, `payments.*` API client. 18/18 API tests green, all 5 packages typecheck clean. **NOT deployed:** needs a Stripe account (test mode), products/webhook, Railway env vars + the `pk_test` in eas.json, and an EAS rebuild (native module) — see [docs/PHASE-5-DEPLOY.md](docs/PHASE-5-DEPLOY.md). Branch not yet merged to `main`.

## Claude Code conventions

- When creating files, follow the monorepo structure above
- Use TypeScript everywhere (strict mode)
- Use Zod for runtime validation in `packages/shared`
- Use Prisma for all database operations
- Prefer Fastify over Express unless there's a specific reason
- Use `pnpm` as the package manager (Turborepo preference)
- All environment variables go in `.env.example` with placeholder values
- Write tests alongside implementation (Vitest for backend, Jest for mobile)
