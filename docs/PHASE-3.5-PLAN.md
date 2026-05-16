# Phase 3.5 Plan

Bridge between current Phase 3 output and Balint's v2 build guide expectations.
Everything here is NEW work not covered by Phases 4–7.

---

## Build order (max 8 chunks, in dependency order)

### 1. ✅ Schema & design-system foundations (423564e)
Add `License`, `WorkPlace`, `BookmarkedJob`, `SearchLog` tables to Prisma. Add `location`/`lat`/`lng` columns to `Job` and `WorkPlace` (fixes the "wp.location does not exist" bug from Part 7). Add `slug` to `User`, `profileCompleteness` to `WorkerProfile`, `audience`/`locationTag`/`tradeTag` to `Post`, `termsAcceptedAt`/`termsVersion` to `User`. Make `Skill.tradeId` required for trade-aware filtering. Expand trade seed from 12 → ~40 (BLS-sourced); onboarding autocomplete shows top 12 with "View More" to reveal the rest. Swap theme tokens in `theme.ts` to Balint's exact hex values (`--bb-navy: #0F2D52`, `--bb-orange: #E85D20`, etc.), update typography to system-font stack with his size scale, update spacing/radius constants. Build reusable `VerifiedBadge` (3 sizes), `TopSearchBar`, `SectionDivider`, `FilterPill`, `SearchPill`, `ConnectButton`, `ProgressBar` components. Replace emoji tab icons with Lucide SVG icons. Wire up AWS S3 for photo uploads (matching Taist's approach), replacing local filesystem storage.

### 2. ✅ Onboarding rebuild (S1–S8) (95244f2)
Replace current `welcome.tsx` with 3-slide swipeable carousel (S1–S3) with auto-advance, Skip, and Login links. Restructure signup from 3-step (account/trade/location) to 5-step matching mockups: name only (S4) → email + password + terms checkbox + email-duplicate check (S5) → 6-digit email verification with auto-advance boxes (S6) → location with `expo-location` permission prompt + city autocomplete fallback (S7) → trade autocomplete + company free-text + job-title autocomplete (S8). Remove phone-at-signup (phone moves to apply-flow gate). Add back-nav arrows on every step after S4. Add progress bar at fixed waypoints (15/30/45/60/85/100). Add `X` dismiss with confirm dialog. Persist signup state in AsyncStorage. API: new `POST /auth/send-verification-email` and `POST /auth/verify-email-code` endpoints via Resend, bcrypt cost bumped to 12, terms acceptance recorded with timestamp+version.

### 3. ✅ Profile system (S9–S14) (9080f68)
Build empty-state profile (S9) with dashed avatar tap-to-upload, verify-now card (dismissible with 7/30-day reappearance), "Open to work" button + audience modal, "Enhance profile" CTA. Build suggested enrichment cards (S10) ranked by completeness impact (photo > skills > license > experience), independently dismissible with 14-day reappearance, 3-strike permanent hide. Build verifications hub (S11) with license-verification flow (type + number + state → real state board API integration for IL/CA/NY/TX, manual queue for other states) and workplace-verification flow (company email + magic link). Build enriched profile About tab (S12) with auto-headline (`{title} · {yrs} yrs · {union}`), per-section edit pencils, "see more" expand, Licenses section with verified badge, trade-aware Skills tags. Build Portfolio tab (S13) with 3-col photo grid + captions + endorsements. Build Posts tab (S14) reusing post-card component. Add public profile route `/u/{slug}` with limited unauthenticated view. API: `POST /licenses`, `POST /workplaces/verify`, `GET /skills?trade=`, license expiration nightly cron.

### 4. ✅ Navigation & settings (S9 bottom nav, S15 top bar, S26) (f18dc0f)
Swap bottom nav tabs from Feed/Finances/Post/Jobs/Profile → Feed/Network/Post/Jobs/Me per every v2 mockup. Build sticky `TopSearchBar` component (avatar left → search pill center → messages icon right) deployed on all primary tab screens. Build Settings screen (S26) with Account section (profile & visibility, sign in & security, phone number), Preferences (notifications, language), Support (help center, send feedback), Sign out (red, centered), account deletion flow with 7-day cooling period, app version from package.json. Move sign-out from profile tab to settings. Wire gear icon on profile to settings.

### 5. Network system (S18–S20)
Build Network tab landing (S18) with Grow/Connections sub-tabs. Grow tab: pending invitations with inline accept/dismiss, connection + invite count cards, union hook banner ("N tradespeople from {union} are already on BluBranch"), PYMK preview with "See all". Build full PYMK screen (S19) with filter pills (All, union, city, trade, past coworkers), suggestion algorithm (mutual_connections×3 + same_trade×2 + same_local×2 + same_city×1), dismiss with 90-day cooldown, connect with optional note modal. Build Connections list (S20) with search, sort pills (Recent/First name/Last name/Trade), quick-message button, remove/block via long-press menu. API: `GET /connections`, `POST /connections/request`, `PUT /connections/:id/accept`, `DELETE /connections/:id`, `GET /network/suggestions`, invitation rate limits (10/day, 50/week). Connection degree calculation (1st/2nd).

### 6. Feed & post composer (S15–S17)
Upgrade home feed (S15) to show connection-degree badges (1st/2nd), verified badges on post bylines, compose stub card at top linking to full composer, "see more" truncation at 4 lines, pull-to-refresh, empty-state CTA to PYMK for 0-connection users. Build post composer (S16) as modal with audience selector pill (Anyone/Connections only), photo attachments (up to 4), location tag pre-filled from profile city, trade tag pre-filled from user's trade, 3000-char limit with counter at 2500+, draft auto-save to AsyncStorage. Build feed enrichment cards (S17) for new users: profile build-out nudges (license, photos, crew) + trade news section with RSS scraper (cron job pulling from ~5–10 curated sources per trade, manual approval queue for founders). API: update `POST /posts` to accept audience/location/trade fields, add `GET /feed` filtering by connection degree + audience rules.

### 7. Jobs & search upgrades (S21–S25)
Add strong-match scoring to job cards (trade match + distance ≤10mi + pay ≥ user's min = "Strong match"; trade match only = "Good match"). Add sticky filter pills (Trade match, Pay, Distance, Union, Type) remembered across sessions. Add pay normalization ($/hr ↔ $/yr via ×2080). Add bookmark/save job toggle with `BookmarkedJob` table + `GET /users/me/saved-jobs`. Add spam auto-flag (no trade, pay outside $5–500/hr, no description). Upgrade apply flow: phone-verification gate (S23) — skip if already verified, profile review checklist, apply-once-per-job enforcement. Build search landing (S24) with recent searches (last 10, server-stored), trade-personalized suggestions, trending pills. Build search results (S25) with tabs (People/Jobs/Companies/Posts), filter pills per tab (degree, verified, city, union), `tsvector` full-text index on users (name+trade+skills) and jobs (title+description+company). API: `GET /search?q=&tab=`, `GET /search/recent`, `DELETE /search/recent/:id`, `POST /search/log`.

### 8. Security hardening & cross-cutting polish
HSTS + CSP + X-Frame-Options headers on Fastify. DOMPurify on all user-generated content rendered in app (post bodies, bios, endorsements). Bcrypt cost 12 (if not already done in chunk 2). Upstash Redis rate limits on auth (5/min/IP), apply (3/hr/user), message-send (50/day to non-connections), verification-code-send (3/hr/email). HIBP breach-password check on signup (warn but allow). PostHog event capture stubs for: `signup_complete`, `verify_complete`, `job_apply`, `job_post`, `message_send`, `connection_accept`, `profile_view`, `search_query`. WCAG 2.1 AA pass: focus-visible on all interactive elements, aria-labels on icon-only buttons, form labels (not placeholder-only), color contrast audit on all Balint token combos. EXIF stripping on photo uploads (sharp). Terms/Privacy stub pages at `/legal/terms` and `/legal/privacy`.

---

## Open questions for founder — ALL RESOLVED (2026-05-16)

- ~~**Trade list expansion:**~~ **DECIDED:** Expand to ~40 BLS-sourced trades. Onboarding autocomplete shows top 12 most popular, "View More" button reveals the rest.
- ~~**Email provider:**~~ **DECIDED:** Resend. Need `RESEND_API_KEY` env var before chunk 2.
- ~~**Photo storage:**~~ **DECIDED:** AWS S3 (matches Taist's `AWS_BUCKET` approach). Need `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` env vars before chunk 1.
- ~~**License auto-verification:**~~ **DECIDED:** Integrate real state board APIs for IL/CA/NY/TX now. Manual queue for other states.
- ~~**Trade news scraper:**~~ **DECIDED:** Build the RSS scraper now with manual approval queue. Ships in chunk 6.

---

## Stack translations (max 10 bullets)

- **Next.js App Router** → Expo Router (file-based routing already in place, `app/` directory)
- **NextAuth.js sessions** → JWT access/refresh tokens via Fastify (already implemented; keep as-is)
- **Tailwind CSS** → React Native `StyleSheet` + `theme.ts` tokens (swap hex values to Balint's palette)
- **shadcn/ui primitives** → Custom RN components in `apps/mobile/src/components/` (build VerifiedBadge, FilterPill, etc. natively)
- **React Server Components** → N/A in React Native; all client-rendered (no translation needed)
- **Next.js API routes** → Fastify route handlers in `packages/api/src/routes/` (already in place)
- **Vercel hosting** → Railway hosting (already deployed; no change)
- **BroadcastChannel API for cross-tab sign-out** → React Native has no tabs; sign-out clears AsyncStorage + navigates to welcome (simpler)
- **CSS `:focus-visible`** → React Native `Pressable` with `onFocus`/`onBlur` + accessible focus ring styles
- **DOMPurify for HTML sanitization** → `sanitize-html` or equivalent for any rendered user content in RN `Text` components (no raw HTML in RN, but sanitize before API storage)
