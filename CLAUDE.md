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
- [docs/CHANGE-REQUESTS.md](./docs/CHANGE-REQUESTS.md) — append-only log of CRs (Bug, Extension, Enhancement) from cofounder testing. Markdown is source of truth; mirror in Google Sheet via `pnpm sync-crs`.
- [docs/CR-HANDLING.md](./docs/CR-HANDLING.md) — procedure to follow when filing or editing CRs. **Read this** before filing a new ticket or modifying an existing one. Trigger phrases: "CR:", "file this as a CR", "ticket this", or pasted Slack content with a screenshot.
- [docs/CR-LESSONS.md](./docs/CR-LESSONS.md) — gotchas from setting up the CR sync system (grep anchoring, `\K` portability, OAuth consent screen red herring). Read this if `pnpm sync-crs` or `CR-HANDLING.md` behaves unexpectedly.
- [docs/CR-SETUP.md](./docs/CR-SETUP.md) — one-time setup for the Google Sheet sync (service account, env vars). Already completed 2026-05-14; only relevant if re-provisioning on a new machine or for a new contributor.

## Current deployment state (last updated 2026-06-01)

- **API:** live at both `https://blubranch-production.up.railway.app` (auto-generated) and `https://api-staging.blubranch.com` (custom domain). Custom domain TLS provisioned via Let's Encrypt; CNAME at Network Solutions points at `baccg4xv.up.railway.app`.
- **Database:** Postgres on Railway (`blubranch-staging` project). Seeded with 12 trades, 102 skills, 9 benefits. Public Networking is **disabled** intentionally — `DATABASE_PUBLIC_URL` was exposed in chat history; closing the public endpoint invalidated the URL. Internal access via `postgres.railway.internal` still works for the API service.
- **Mobile app:** version 0.1.5, `eas.json` preview profile points at `api-staging.blubranch.com`. Onboarding flow tested end-to-end on TestFlight. Now reflects the full Phase 3.5 v2 rebuild (5-step signup, Network tab, profile/verification system, upgraded feed + search).
- **Admin panel:** `apps/admin` scaffolded (Vite + React 19 + shadcn/ui, BluBranch palette) and builds green, but is **not yet wired** — no `/admin/*` API routes exist. Not deployed.
- **CR system:** fully operational as of 2026-05-14. Google Sheet (`20260508_BluBranch_CRTracker_MasterList_v01`) mirrors `docs/CHANGE-REQUESTS.md` via `pnpm sync-crs`. Service account credentials at `~/.config/blubranch/cr-sync-service-account.json`; env vars in `~/.zshrc`. End-to-end round-trip verified with a test ticket. ~15 unprocessed CRs from cofounder still in Slack channels (`#admin-panel`, `#android-builds`, `#automation`, `#ios-builds`, `#payments`, `#performance`, `#styling`) — not yet transcribed into the system.
- **Deferred TODO:** full Postgres password rotation. Public Networking is off (closed ~80–90% of risk), but the actual DB password is still the one that was visible in chat. Multi-step procedure (`ALTER USER` + Edit `POSTGRES_PASSWORD` + verify API reconnects) — do when nothing else is in flight; budget ~15–20 min.
- **Deferred TODO:** custom domain for production (`api.blubranch.com`). Eas.json `production` profile already references it; just needs DNS + Railway custom-domain setup mirroring what was done for staging.

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
- [ ] **Phase 4 — messaging, notifications, real-time** ← YOU ARE HERE _(Socket.io, FCM push, BullMQ scheduled work; `Conversation`/`Message` models already in schema, no messaging/notif routes or socket/bullmq/firebase-admin deps yet)_

## Claude Code conventions

- When creating files, follow the monorepo structure above
- Use TypeScript everywhere (strict mode)
- Use Zod for runtime validation in `packages/shared`
- Use Prisma for all database operations
- Prefer Fastify over Express unless there's a specific reason
- Use `pnpm` as the package manager (Turborepo preference)
- All environment variables go in `.env.example` with placeholder values
- Write tests alongside implementation (Vitest for backend, Jest for mobile)
