# BluBranch — Phase roadmap

> ~20-week phased build plan. Modeled on Taist architecture, adapted for BluBranch.

---

## Phase 0 — Monorepo scaffold & tooling (Weeks 1–2) ✅ COMPLETE

**Goal:** Empty but runnable monorepo with all tooling configured.

**Deliverables:**
- [x] Turborepo workspace with `apps/mobile`, `apps/admin`, `packages/api`, `packages/shared`, `packages/db`
- [x] pnpm workspace configuration
- [x] TypeScript config (strict) across all packages with path aliases
- [x] ESLint + Prettier shared config
- [x] Expo app bootstrapped (SDK 52+, new architecture)
- [x] Node.js API bootstrapped (Fastify preferred) with health check endpoint
- [x] Prisma initialized with PostgreSQL connection string
- [x] `.env.example` with all required vars
- [x] `.gitignore` comprehensive for Node/Expo/Prisma
- [x] `turbo.json` with build/dev/lint/test pipelines
- [x] README.md with setup instructions
- [x] Docker Compose for local PostgreSQL + Redis (dev convenience)

**Acceptance criteria:** `pnpm dev` starts both the Expo dev server and the API server. API responds to `GET /health`. Prisma connects to local PostgreSQL.

**Verification (2026-04-28):**
- `pnpm install` — 1015 packages across 6 workspace projects
- `pnpm build` — all 5 packages build successfully
- `curl http://localhost:4000/health` → `{"status":"ok"}`
- `prisma generate` — schema valid, client generated to `packages/db/src/generated/client`

---

## Phase 1 — Authentication & user profiles (Weeks 3–5) ✅ COMPLETE

**Goal:** Users can sign up, log in, and create profiles matching mockup screens 1–3D.

**Deliverables:**
- [x] Prisma schema: users, worker_profiles, trades, user_trades, skills, user_skills, certifications, portfolio_photos, work_history, user_settings, companies _(also: jobs, job_applications, job_benefits, posts, connections, endorsements, conversations, messages)_
- [x] Seed data for trades (12), skills (102 across all trades), benefits (9)
- [x] Auth endpoints: POST /auth/register, POST /auth/login, POST /auth/social, POST /auth/refresh, POST /auth/verify-phone (send + check)
- [x] JWT access (15min) + refresh (7d) token flow
- [x] Twilio SMS phone verification _(Verify API when configured; dev fallback logs codes)_
- [x] Social auth stub _(POST /auth/social wires the user-creation path; full provider id_token verification lands later)_
- [x] Signup wizard screens (2A account, 2B trade, 2C location)
- [x] Profile creation wizard screens (3A photo & bio, 3B skills & certs, 3C work photos, 3D privacy)
- [x] Profile photo upload _(local filesystem POST /upload/image; swap for S3/R2 in a later phase)_
- [x] Worker profile view screens (5A about, 5B portfolio, 5C posts)
- [x] API middleware: extractUser, requireAuth, requireRole(...)

**Verification (2026-04-28):** Postgres 17 + PostGIS 3.6 running locally, all 24 tables created, 102 skills seeded. End-to-end flow exercised via curl: register → login → GET /users/me → PUT worker-profile → POST trades → POST skills → POST certifications → send/verify phone code → refresh token. 401, 409 (duplicate email), and 400 (Zod validation) edge cases verified.

---

## Phase 2 — Responsive layout system (Weeks 4–6, parallel with Phase 1) ✅ COMPLETE

**Goal:** Single codebase adapts to mobile, tablet, and desktop.

**Deliverables:**
- [x] `useLayout()` hook with breakpoints (mobile < 768, tablet 768–1024, desktop > 1024); reactive via `useWindowDimensions`
- [x] Bottom tab navigator (mobile) — 5 tabs (Feed, Finances, Post, Jobs, Profile) with raised orange Post FAB
- [x] Collapsible sidebar navigator (tablet) — 72px-wide left rail, icons only
- [x] Persistent sidebar (desktop) — 240px-wide left rail, icons + labels, active highlight _(right detail panel deferred to Phase 3 when there's actual detail content to show)_
- [x] Conditional navigator swap — single `Tabs` navigator with `tabBarPosition` driven by `useLayout`, custom `ResponsiveTabBar` owns the appearance per breakpoint
- [x] Responsive component primitives: `ResponsiveContainer`, `ResponsiveGrid`, `ResponsiveCard`, `AdaptiveHeader`, `Placeholder`
- [x] Expo web export configured and tested — `pnpm exec expo export -p web` produces 14 static HTML routes; theme tokens in inlined CSS

**Verification (2026-04-28):** `pnpm typecheck` green across all 5 packages; `pnpm exec expo export --platform web` bundles cleanly producing static HTML for `/feed`, `/finances`, `/post`, `/jobs`, `/profile`, `/welcome`, `/login`, all signup/wizard routes. Phase 1 auth + profile screens still mount unchanged inside the new `(tabs)` group. Visual verification at 375 / 800 / 1440 px requires running `pnpm --filter @blubranch/mobile dev --web` and opening Chrome — not automated in this session because Chrome MCP needed user-side localhost permission.

---

## Phase 3 — Job marketplace core (Weeks 6–10) ✅ COMPLETE

**Goal:** Employers post jobs, workers find and apply. PostGIS geospatial matching.

**Deliverables:**
- [x] PostGIS extension enabled, geography columns indexed _(Phase 0)_
- [x] Geocoding service — Google Maps Geocoding API when `GOOGLE_MAPS_API_KEY` is set; deterministic Chicago-anchored dev fallback otherwise
- [x] Job CRUD endpoints with geospatial queries (ST_DWithin for radius search, distance via ST_Distance, sort by featured-then-distance/newest/pay)
- [x] Employer posting wizard (7A plan / 7B company / 7C details / 7D perks & boosts / 7E review & publish / 7F live confirmation)
- [x] Job board screen (6A) with trade filter pills, sort row, featured + standard sections
- [x] Job detail screen (6B) with sticky Quick Apply, applicant count, benefits chips, employer card
- [x] Quick Apply flow — POST /jobs/:id/apply, idempotent (409 on duplicate), surfaces application status on the detail screen
- [x] Job application tracking endpoints + employer applicant dashboard with inline status setter (applied → reviewed → shortlisted → hired/rejected)
- [x] Featured/boosted logic — Pro/Unlimited plans gate featured placement, urgent badge, and push blast; Basic gets a greyed-out boost row
- [x] Hourly expiration tick — `setInterval` inside the API process flips `status='open'` rows past `expires_at` to `expired`
- [x] Bonus: home feed (Mockup screen 4) — mixed timeline of posts + nearby jobs with `JOBS NEAR YOU` headers, plus posts/likes/comments endpoints
- [x] Bonus: desktop right-pane detail panel — tapping a job in the board shows the detail inline at ≥1024px instead of pushing a new screen

**Verification (2026-04-28):** Postgres + PostGIS local. End-to-end curl flow exercised: register employer + worker → POST /companies → POST /jobs (Pro tier, Chicago) → geography column populated via raw `ST_SetSRID(ST_MakePoint, 4326)::geography` write → GET /jobs?lat&lng&radius returns distance-sorted results with featured job pinned to top → POST /jobs/:id/apply succeeds, second attempt returns 409 → GET /users/me/applications surfaces status → employer PUT /jobs/:id/applications/:id flips status to shortlisted → GET /feed interleaves posts + nearby jobs.

---

## Phase 4 — Messaging, notifications, real-time (Weeks 10–13)

**Goal:** Workers and employers can message. Push notifications for key events.

**Deliverables:**
- [ ] Conversations & messages tables
- [ ] Socket.io server on API
- [ ] Socket.io client in mobile app
- [ ] Message screens (not yet mocked — design needed)
- [ ] Firebase Cloud Messaging setup (iOS + Android)
- [ ] Push notification triggers: new job match, application status change, new message, profile views
- [ ] BullMQ job queue for scheduled tasks:
  - Expire stale listings (hourly)
  - Match notifications (every 30 min)
  - Payment reminders (daily)
  - Profile nudges (weekly)
- [ ] Notification preferences (respect user_settings toggles)

---

## Phase 5 — Payments (Weeks 13–15)

**Goal:** Employers pay to post jobs. Stripe Connect for future worker payouts.

**Deliverables:**
- [ ] Stripe integration: Payment Intents for one-time posts ($49/$129)
- [ ] Stripe Subscriptions for Unlimited plan ($299/mo)
- [ ] Stripe Connect Express accounts for workers (future payouts)
- [ ] Payment flow in employer posting wizard (between review and confirmation)
- [ ] Webhook handlers: payment_intent.succeeded, subscription.created/canceled/updated
- [ ] Receipt emails via Resend
- [ ] Refund logic (admin-initiated only, per mockup: "No refunds after job goes live")

---

## Phase 6 — Admin panel (Weeks 14–16, parallel with Phase 5)

**Goal:** Internal tool for platform operations.

**Deliverables:**
- [ ] React web app (Vite) in `apps/admin`
- [ ] Admin auth (separate from user auth, or admin role check)
- [ ] User management: list, search, approve, ban, verify certifications
- [ ] Job moderation: review flagged listings, remove
- [ ] Payment/subscription overview
- [ ] Analytics dashboard: signups, jobs posted, match rate, revenue
- [ ] Dispute resolution queue
- [ ] Deploy to Railway at subdomain

---

## Phase 7 — Testing, hardening, launch prep (Weeks 16–20)

**Goal:** Production-ready. App store submissions.

**Deliverables:**
- [ ] E2E tests for critical flows (signup, post job, apply, message)
- [ ] Load testing PostGIS queries at scale
- [ ] Stripe Connect end-to-end testing with test accounts
- [ ] Push notification testing on both platforms
- [ ] Responsive layout QA: iPhone SE, iPad, 1440px desktop
- [ ] **Replace emoji icons with vector icons** (`lucide-react-native` or `@expo/vector-icons`) — emoji rendering varies across iOS versions and Android OEM skins, looks unprofessional at scale. Touchpoints: `apps/mobile/src/components/responsive-tab-bar.tsx` (5 tab icons), `apps/mobile/app/(app)/(tabs)/*.tsx` placeholder hero icons, `apps/mobile/src/components/adaptive-header.tsx` (notification + message icons), `apps/mobile/app/(app)/profile-create-photo.tsx` (camera dot)
- [ ] Security audit: auth flows, data access, rate limiting
- [ ] Privacy Policy and Terms of Service
- [ ] App Store screenshots for each form factor
- [ ] iOS: EAS Build → TestFlight → App Store Connect submission
- [ ] Android: EAS Build → Google Play Console submission
- [ ] Web: Expo web export → deploy
- [ ] Staging environment fully operational
- [ ] Production deployment on Railway
- [ ] DNS: api.blubranch.com, admin.blubranch.com
- [ ] Monitoring: error tracking (Sentry), uptime monitoring

---

## Post-launch priorities (not scoped yet)

- Finances tab (financial wellness content, earnings tracking for workers)
- Company profile pages (for Unlimited plan employers)
- Advanced search and filtering
- AI-powered job matching / profile suggestions
- Background check integration (equivalent to Taist's SafeScreener)
- Review/rating system for employers and workers
- Referral program
