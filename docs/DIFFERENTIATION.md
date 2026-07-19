# BluBranch Differentiation Proposal

> **Status:** Proposal for Dayne + Balint review — no feature code written.
> **Date:** 2026-07-18
> **Scope decisions already made:** top-3 must fit **one sprint (~2–3 weeks)**; wage transparency may use a **contribute-to-see** model; Trade Card ships as a **public share page**; copy voice is **plain trade-talk first** (Branches kept where already established, no forced tree metaphors).
>
> Everything below is scored against the *actual* schema (`packages/db/prisma/schema.prisma`) and routes as of `main` today, not against a whiteboard. File references are included so implementation can start from this doc.

---

## TL;DR — recommendation

**Top-3 for the sprint:**

1. **Trade Card + license-expiry reminders** — highest differentiation per unit of work. The share/OG infra, public-profile query, and nightly license job all exist; the card is mostly assembly. The expiry-reminder half is nearly free and is our first *recurring reason to open the app*.
2. **"Worked together" vouches** — replaces (not augments) LinkedIn-style endorsements, which conveniently have **no create route today** — we're not migrating anything, we're building the write path we never built, with a better mechanic. Gated by mutual workplace confirmation, so it can't be gamed by strangers.
3. **The language pass** — cheapest per point of differentiation. ~60 strings, no migrations, done in days. It changes what the app *feels like* on every screen, which is the actual moat against "LinkedIn but blue."

**Stretch (small, if the sprint has room):** side-work availability badge — one enum value + one badge + one search filter.

**Next after the sprint (not top-3, but the biggest long-term bet):** wage transparency, phased — job-posting aggregates first (data already exists), contribute-to-see second.

**Explicitly deferred:** full Crew mechanics (XL, greenfield — no group structures exist anywhere in the schema), Apple Wallet passes, video anything.

---

## Scoring framework

- **Differentiation (1–5):** How ownable is this? 5 = LinkedIn/Indeed structurally *can't* copy it well (their model fights it); 3 = distinctive but copyable; 1 = table stakes.
- **Build cost:** sized against the current codebase. **S** ≤ 2 days · **M** ≤ 1 week · **L** 2–3 weeks · **XL** > one sprint.
- Every idea lists **what already exists** (with file paths) and **what's actually missing**, because the gap between those is the real cost.

---

## Part A — The six directions, scored

### 1. Trade Card — verified credential wallet + share page

**Differentiation 5 · Cost M · → TOP-3 ✅**

A wallet-style card: name, photo, trade, experience level, verified licenses (state + number + expiry), certs, union local — shareable as a public link a foreman can text to a GC. License-expiration reminders surface on the card and as push/email.

**What already exists:**
- `License` model with `number`, `issuingState`, `expiresAt`, `status` (pending/verified/rejected/expired), admin verify queue (`packages/api/src/routes/admin.ts:250`).
- Nightly license job (`packages/api/src/jobs/license-expiration.ts`, 3 AM UTC) — **but it only flips `verified → expired`; it never notifies anyone.** The retention feature is one query-window and one notification away.
- Public profile `GET /u/:slug` (`packages/api/src/routes/users.ts:343`) already aggregates verified licenses, certs, trades, union (settings-gated).
- OG share-page pattern `GET /share/post/:id` + AASA already registered for `/share/*` (`packages/api/src/routes/share.ts`) — a card page is a near-clone.
- `Certification` model (name, number, `isVerified`) as the lighter credential type.

**What's missing:** the card aggregate endpoint, the share/OG page, the mobile card screen, the reminder notification type, and (optionally) a `documentUrl` on License for photo-of-card uploads.

**Why it's ownable:** LinkedIn verification is employer/email-based; Indeed has nothing. A *state-license-verified* card is only valuable in trades, so incumbents won't prioritize it. And expiry reminders make BluBranch useful **between job searches** — that's the retention story ("BluBranch reminded me before my journeyman card lapsed" is word-of-mouth gold).

**Challenge / expansion:**
- Verification throughput is the real bottleneck: every license is manually admin-verified today (`verificationMethod: state_api` exists in the enum but no state-API integration is built). Fine at beta scale; plan state-registry lookups (many states have public license-lookup pages) as a fast-follow.
- Don't gate the card on having a license — a card with "License pending verification" still shares fine and *drives* license submission.
- Apple Wallet pass (PassKit) deferred: signing/cert plumbing isn't worth it until the web card proves people share it.

---

### 2. "Worked together" vouches

**Differentiation 5 · Cost M · → TOP-3 ✅**

One-tap "I worked with them. I'd work with them again." — only unlockable when the two of you actually overlapped on a job. Displayed above (and eventually instead of) endorsements; weighted in PYMK and search.

**What already exists:**
- `WorkPlace` rows carry `companyName`, `startDate`, `endDate`, `current`, `status` (with an admin confirm queue) — overlap is *derivable*: same company + intersecting date ranges.
- `Endorsement` model + display on `/u/:slug` (`users.ts:354`) — but **no create route exists anywhere** (API or mobile). Endorsements are read-only dead weight today. That's a gift: we can ship vouches as *the* peer-credibility mechanic with zero migration of user data.
- Notification pipeline (`packages/api/src/services/push.ts`) makes adding a `vouch_received` type mechanical.

**The honest problem:** `companyName` is free text with no canonical employer entity — "Turner", "Turner Construction", and "turner const." don't join. Pure data-derived overlap will miss most real pairs.

**V1 answer — mutual attestation instead of perfect data:** a vouch is a *claim + confirmation*, not a database join:
1. Voucher taps "Worked with them" on a profile, picks which of *their own* workplaces the overlap happened at (or types the job/site).
2. Vouchee gets a notification: "Mike says you worked together at Turner Construction, 2023–2024. Right?" One tap confirms.
3. Confirmed vouches display with the shared context: *"Worked together at Turner Construction · vouched Jul 2026."*

Normalized-`companyName` + date-overlap match (lowercase/trim, ≥30-day intersection) is used to **pre-fill and fast-track** ("You and Mike both list Turner Construction — vouch him?") rather than to gate. This sidesteps the free-text problem entirely and is *more* trustworthy than a join: both humans attested.

**Why it's ownable:** LinkedIn endorsements are a running joke precisely because strangers can hand them out. A vouch that requires confirmed shared job history is credible in an industry that runs on "he's a good hand, I've worked with him." It also creates a virtuous loop: vouching pressures both parties to fill in work history → which feeds Trade Card and future crew features.

**Challenge:** don't add a decline-shame path — an unconfirmed vouch just silently never displays. And cap vouches per pair at one (unique constraint), no counts-farming.

---

### 3. Crew mechanics

**Differentiation 4 · Cost XL (full) / M (lite) · → DEFER full; consider lite post-sprint**

**What exists:** nothing. The `Connection` graph is strictly pairwise; `Company` has no worker membership; there is no group/team/org structure anywhere in the schema. Full crews (create crew, invite, crew profile, crew-applies-together, employer sees crew) is a genuinely new subsystem — models, routes, permission logic, N screens. Not a sprint item, and I'd challenge the premise of building it now at all: **group features need graph density we won't have at launch.** A crew feature in an app where your crew isn't on the app yet is an empty room.

**The lite version that actually fits our stage — "Bring a buddy" referral on job posts (M):** a Refer button on job detail generates a share link tagged with the referrer; when the buddy applies through it, the application is flagged to the employer ("Referred by Dayne Arnett — applying together"). One `referredById` column on `JobApplication`, one share-link variant of the existing `/share/*` pattern, one badge on the applicant dashboard. It gives employers the "hire the crew" signal, gives workers a reason to *pull their crew onto the app* (solving the density problem the full feature would suffer from), and it's the on-ramp: once referral chains exist in the data, we'll know whether formal Crews are worth XL.

**Verdict:** defer full Crews; queue "Bring a buddy" as the first post-sprint feature. It's also our only organic-growth mechanic on this list.

---

### 4. Wage transparency — anonymous pay by trade + region

**Differentiation 5 · Cost L (phased: S + M) · → NOT top-3, but the biggest post-sprint bet**

**What already exists:** every job carries required `payMin`/`payMax` + trade + city/state (+ PostGIS geo where enabled); `WorkerProfile.hourlyRate` exists (sparse, privacy-gated by `showHourlyRate`); `SearchLog` records demand-side interest. **What's missing:** any aggregate table, any pay-period modeling (hourly vs salary is *not modeled* — payMin/Max are naked decimals), and any worker-contribution flow.

**Phased plan (per your contribute-to-see approval):**
- **Phase 0 (S, could ride along this sprint if room):** "What's it paying?" — aggregate posted-job pay by trade + state/metro (`avg/median payMin–payMax`, job count, min-sample n≥5 before display). Pure read over existing data; one endpoint + one screen/section on the Jobs tab.
- **Phase 1 (M):** contribute-to-see — one-time anonymous submission (trade, years, rate, union y/n, city/state) unlocks the detailed view. Store contributions in a dedicated table **with no FK to users** (a one-way `contributed` flag on the user side is enough to unlock); never show a cell under n≥5. Also: add an optional **desired-rate field to Quick Apply** — one column on `JobApplication`, seeds worker-side data continuously and is genuinely useful to employers.
- **Prerequisite worth doing regardless:** add `payPeriod` (hourly/daily/salary) to Job — today an $80k salary and an $80/hr rate are indistinguishable in the columns, which would poison any aggregate.

**Why not top-3:** the contribute-to-see flywheel needs users to spin; at beta scale it's an empty dashboard with a gate in front of it. Phase 0 avoids that (job postings are our data, not users'), which is why it's the ride-along candidate — but the headline version belongs to the post-launch quarter.

**Why it's ownable long-term:** pay opacity is *the* grievance in the trades, union locals publish scale but non-union workers fly blind, and Glassdoor's data is white-collar. This is the feature people screenshot.

---

### 5. "On the road" mode + side-work availability badges

**Differentiation 3 · Cost S–M · → STRETCH item (the side-work half)**

**What already exists:** `travelRadiusMiles` (required column, still writable, just orphaned from onboarding), `jobAvailability` enum (open/actively_looking/not_looking), the `Open to Work` badge, people-search filters (`jobs.ts:545`). Also note: `UserSettings.openToWork` is a **dead flag** — defined, never read server-side; kill or wire it during this work.

**Side-work badge (S):** "Takes side work" — one boolean (or enum extension) on WorkerProfile, badge on profile/search cards, filter on people search. Speaks to how tradespeople actually earn (nights-and-weekends work is universal) and no incumbent models it. *This* half is the stretch item.

**On the road (M):** willing-to-travel/per-diem flag + surfacing `travelRadiusMiles` prominently + a jobs-side `travelJob`/per-diem flag so traveling workers and traveling jobs can find each other. Real differentiation for industrial/pipeline/lineman trades — but it's only valuable paired with job-side data employers must supply, so it matures with employer volume. Defer the full mode; the badge alone is cheap if we want it.

---

### 6. Language/voice pass

**Differentiation 4 · Cost S · → TOP-3 ✅**

Cheapest item on the list and it touches every session of every user. The harvest (Part D) found the app currently speaks LinkedIn in ~40 places — "Build your professional network," "endorsements," "Open to opportunities," "People you may know," "milestone" — while the brand voice ("Branches," "My Branch," the hammer emoji in email subjects) pokes through inconsistently. Zero migrations; strings only, plus a handful of API notification/email templates. Full before→after table in **Part D**.

One real decision inside it: **Branches vs Connections** is currently inconsistent (profile stat says Branches, network tab says Connections, API notifications say "connection request"). Recommendation per the plain-talk directive: **Branches is the noun** (your people), **Connect stays the verb** (the action) — "Branches (48)", "wants to connect", "No branches yet." Don't invent "branching" as a verb.

---

## Part B — New ideas found in the codebase / space

Ranked by score; the first two are folded into the top-3 sketches.

| # | Idea | Diff | Cost | Notes |
|---|------|:---:|:---:|-------|
| B1 | **License-expiry reminders** | 5 | **S** | Folded into Trade Card (Part C1). The nightly job exists and already finds these rows; it just never tells the user. Recurring, non-social reason to keep the app installed — rare and precious. |
| B2 | **"Bring a buddy" job referrals** | 4 | M | The Crew-lite from A3. Our only organic-growth loop; first post-sprint feature. |
| B3 | **Ticket wallet — certs with expiry** | 4 | S–M | OSHA 10/30, forklift, welding certs, first aid — "tickets" expire just like licenses but `Certification` has **no `expiresAt` and no admin queue**. Add both and the Trade Card + reminder engine covers a worker's whole ticket book, not just state licenses. Natural Trade Card fast-follow. |
| B4 | **Real profile strength** | 3 | S | `profileCompleteness` is a dead column — **never computed or written anywhere**; the nudge job reads it (always 0) and the UI shows a % from... nothing. Compute it server-side on profile writes with trade-weighted scoring (verified license worth more than a bio). Fixes a latent bug *and* powers honest "get found more" nudges. |
| B5 | **Pay-expectation field on Quick Apply** | 3 | S | One optional `desiredRate` column on `JobApplication`. Seeds wage data (A4) from day one, useful to employers, zero-friction. |
| B6 | **Trade demand signals** | 3 | M | `SearchLog` + `JobView` + job counts already capture demand by trade/region. "Electricians are the most-searched trade in Columbus this month" — feeds feed content, employer pitch decks, and eventually the wage dashboard. Post-sprint. |
| B7 | **Union local as first-class data** | 3 | S | `unionName` is a free-text VarChar. A structured trade+local picker (IBEW Local 683) enables local-mates discovery, scale-wage context for A4, and credible union badges on the Trade Card. Cheap; do it when Trade Card v2 touches union display. |
| B8 | **Employer reliability signal** | 4 | L | The inverse review: did the job start when promised, did pay match the post? Workers' biggest fear on new outfits. Already in the post-launch backlog as reviews; flagging that the *worker-rates-employer* direction is the differentiating half. |

Also logged while exploring (housekeeping, not differentiation): `tradeYears` has no write path; `UserSettings.openToWork` is never read; `WorkPlace.verificationEmail` is captured but no verification email is ever sent. Worth a cleanup ticket.

---

## Part C — Top-3 implementation sketches

> Sketch-level: enough to estimate and divide, not final specs. All migrations additive; nothing breaks existing builds (server-side pieces work with build 0.1.5 (30); card/vouch screens need the next iOS build).

### C1. Trade Card + license-expiry reminders (~1 week)

**Schema (one migration):**
- `NotificationType` += `license_expiry`; `UserSettings` += `notifyLicenseExpiry Boolean @default(true)`.
- `License` += `documentUrl String?` (photo of the physical card; S3 upload path already exists) and `remindedAt DateTime?` (dedup for reminder windows).
- Optional: `Certification` += `expiresAt DateTime?` now if we want B3's door open — the reminder query can cover both tables from day one.

**API:**
- `GET /users/me/trade-card` — card aggregate: name/photo/slug, primary trade + `experienceLevel`, verified licenses (type, state, masked number, expiry, status), certs, `unionName` (respecting `showUnion`), vouch count (once C2 lands).
- `GET /share/card/:slug` — public OG page mirroring `share.ts`'s post handler: renders the card server-side (name, trade, "3 verified licenses", BluBranch badge) with og-tags, deep-links `blubranch://u/:slug`. AASA already covers `/share/*` — no entitlement work.
- Extend `license-expiration.ts`: alongside the existing expire pass, two reminder windows (30-day, 7-day) → `sendNotification(type: license_expiry)` (+ add to `EMAIL_TYPES` — this one *should* email), deduped via `remindedAt`.
- Card respects license privacy: full numbers only to the owner; share page shows type + state + "Verified" + expiry month.

**Mobile:**
- `trade-card.tsx` — the wallet-style card (denim/steel-blue, existing brand gradient), entry point card on My Branch tab. Expiry chips on each license row ("Expires Sep 2026" → amber < 60 days, red < 14). Share button → native sheet with the `https://…/share/card/:slug` URL (rich preview free via the OG page).
- Reminder notifications deep-link to the card; `notification-settings.tsx` gets a "License reminders" row.

**Tests:** reminder-window query (30/7-day boundaries, dedup, pref-off), card aggregate gating (union/number masking), share-page OG render for verified vs no-license users.

### C2. "Worked together" vouches (~1 week)

**Schema (one migration):**
```prisma
model Vouch {
  id          String      @id @default(uuid())
  voucherId   String
  voucheeId   String
  companyName String?     @db.VarChar(200)   // shared-context claim
  startYear   String?     @db.VarChar(7)     // display only, "2023"
  endYear     String?     @db.VarChar(7)
  status      VouchStatus @default(pending)  // pending | confirmed
  confirmedAt DateTime?
  @@unique([voucherId, voucheeId])
}
```
(Reuses `WorkPlace` rows to *suggest* context; stores a denormalized snapshot so later workplace edits don't orphan the vouch.)

**API:**
- `GET /users/:id/vouch-context` — normalized-companyName + ≥30-day date-overlap check between my workplaces and theirs → returns suggested shared workplaces (pre-fill) or empty (manual entry).
- `POST /users/:id/vouch` — create pending (self-vouch guard, unique-pair, rate-limit mirroring the connections 10/day pattern); notifies vouchee (`vouch_received` type + `notifyVouches` pref — fold into C1's migration).
- `PUT /vouches/:id/confirm` — vouchee-only; flips to confirmed, notifies voucher. No decline endpoint — unconfirmed vouches simply never display and expire from the pending list after 30 days.
- `/u/:slug` and profile stats: confirmed vouches displayed **above** endorsements with shared context line; add `vouches` count to the stats block. (Leave the Endorsement model alone — it's read-only dead code; deprecate later.)
- PYMK weighting (`connections.ts:316`): confirmed vouch → strong mutual-affinity boost, and vouch-context matches ("you both list Turner") become a PYMK reason string.

**Mobile:**
- Profile action: "Worked together?" button (visible on others' worker profiles) → small sheet: pick suggested shared workplace or enter company + years → one-tap send.
- Vouchee confirm flow from the notification → confirm sheet.
- Profile section "Vouched by" with context lines; stat label `Vouches`.

**Tests:** overlap normalization (case/whitespace, date-range edges), unique-pair, confirm authorization, display-only-confirmed, PYMK boost.

### C3. Language pass (~2–3 days)

Apply Part D. Mechanics: pure string edits across `apps/mobile` + notification/email templates in `packages/api` (`push.ts`, `connections.ts`, `applications.ts`, `job-match.ts`, `profile-nudge.ts`, `email.ts`) + availability labels in `packages/shared/src/reference.ts`. No migrations (enum *values* unchanged — only display labels move). Ship API-side template changes immediately (server strings reach the current TestFlight build); mobile strings ride the next build with C1/C2 screens.

**Sprint shape:** C1 and C2 are independent (parallelizable); C3 anytime; single combined migration if sequenced together. Stretch: side-work badge (A5) if the week allows.

---

## Part D — The copy pass: before → after

Real strings harvested from the code (exact quotes, with locations). Voice rules applied: plain jobsite talk; **Branches = noun, Connect = verb**; "vouch" replaces "endorsement" everywhere (pairs with C2); no forced metaphors; keep what already works (plenty does — flagged "keep" rows are listed only where the register decision matters).

### Onboarding & welcome

| Where | Before | After |
|---|---|---|
| `welcome.tsx` slide 1 | Build your professional network | **Your trade. Your people. Your next job.** |
| `welcome.tsx` slide 1 sub | Connect with verified tradespeople, get endorsements, and grow your reputation. | **Link up with verified tradespeople, get vouched for by people you've actually worked with, and build a name that travels.** |
| `welcome.tsx` slide 3 sub | License verification, workplace confirmation, and a community built on trust. | **Verified licenses. Confirmed work history. No padded résumés.** |
| `signup-name.tsx` | This is how you'll appear on BluBranch. | **This is the name people will see.** |
| `signup-location.tsx` field | Job availability | **Work status** |
| `signup-trade.tsx` alert | Something went wrong creating your profile. Please try again. | **Couldn't save your profile. Give it another shot.** |
| `reference.ts` availability | Open to opportunities | **Open to work** *(matches the existing badge — fixes a register clash)* |

### Empty states

| Where | Before | After |
|---|---|---|
| `network.tsx` | No connections yet. Start growing your network! | **No branches yet. Start with people you've worked with.** |
| `network.tsx` PYMK empty | Complete your profile to get personalized suggestions. | **Add your trade and work history and we'll find people you've crossed paths with.** |
| `profile.tsx` endorsements | No endorsements yet — connect with peers to receive them. | **No vouches yet. They come from people who've been on jobs with you.** |
| `profile.tsx` portfolio | Show off your best work to attract employers and build credibility. | **Show off your best work. Contractors look at photos first.** |
| `profile.tsx` posts | Share photos of your work and updates to start building your network. | **Post your work. That's how people around here get known.** |
| `messages.tsx` | Start a conversation from someone's profile or your connections list. | **Start one from someone's profile or your branches list.** |
| `jobs.tsx` | No matching jobs yet. Try widening your trade filter or check back soon. | *keep* — already plain |
| `applications/[jobId].tsx` | No applicants yet. They'll show up here as soon as the first worker hits Quick Apply. | *keep* |

### Profile

| Where | Before | After |
|---|---|---|
| `profile-header.tsx` fallback | Tradesperson | **In the trades** *(or the user's primary trade name when set — better fix than any string)* |
| `profile-header.tsx` stat | Endorsements | **Vouches** |
| `profile.tsx` card | Profile strength | **Get found more** |
| `profile.tsx` card sub | Complete your profile to appear in more searches | **The more you fill in, the more contractors find you** |
| `profile.tsx` section | Enhance your profile | **Round out your profile** |
| `profile.tsx` card | Add your skills / Help employers find you by your expertise | **Add your skills / So the right outfits can find you** |
| `profile.tsx` card | Verify a license / Stand out with a verified badge | *keep* — already right |
| `profile.tsx` section | Experience | **Work history** |

### Network

| Where | Before | After |
|---|---|---|
| `network.tsx` sub-tab | Connections ({total}) | **Branches ({total})** |
| `network.tsx` | Pending invitations ({n}) | **Waiting on you ({n})** |
| `network.tsx` | People you may know | **People you've probably crossed paths with** |
| `network.tsx` sub-tab | Grow | *keep* |
| `connect-button.tsx` | Connect / Pending | *keep* — Connect is the verb |

### Feed & composer

| Where | Before | After |
|---|---|---|
| `feed.tsx` compose stub | Share your work or a milestone... | **Show off today's work…** |
| `post.tsx` composer | Share your work, ask a question, or tag a connection with @… | **Post a job-site photo, ask the trades, or tag someone with @…** |
| `post.tsx` audience | Connections only | **Branches only** |
| `feed.tsx` welcome | Your feed will fill in as you connect with peers and jobs land in your area. | **Your feed fills in as you branch out and jobs land in your area.** |

### Jobs & applications

| Where | Before | After |
|---|---|---|
| `job-detail-body.tsx` | About the role | **The work** |
| `quick-apply-modal.tsx` | Add a message (optional) / Anything the employer should know up front? | *keep* — placeholder is already good; label → **Anything to add? (optional)** |
| STATUS_LABEL | Reviewed by employer | **Employer's seen it** |
| STATUS_LABEL | Not selected | **They went another way** |
| STATUS_LABEL | Hired | **Hired** *(keep)* |

### Notifications & email (API templates — server-side, reach the current build)

| Where | Before | After |
|---|---|---|
| `push.ts` profile_view | Someone viewed your profile / {name} viewed your profile | **Someone checked out your profile / {name} checked out your profile** |
| `connections.ts` | New connection request / {name} wants to connect | **{name} wants to link up / Accept and they're in your branches** |
| `connections.ts` | Connection accepted / {name} accepted your connection request | **You're connected / {name} is in your branches now** |
| `applications.ts` hire | Your application resulted in a hire! Congratulations | **You're hired. Nice work.** |
| `applications.ts` rejected | Your application was not selected | **This one went another way. The next one's out there.** |
| `profile-nudge.ts` | Complete your BluBranch profile / Add your skills, photos, and experience so employers near you can find you. | **Your profile's missing a few things / Add your skills, photos, and licenses so outfits near you can find you.** |
| `email.ts` footer tagline | Networking for the Blue Collar. | *keep* — it's the brand tagline; flag for Balint only if the brand line itself changes |
| *(new, from C1)* | — | **Your {license type} expires in {n} days / Renew it, then update your Trade Card so it stays current.** |
| *(new, from C2)* | — | **{name} vouched for you / "Worked together at {company}. Would again." Confirm it to show it on your profile.** |
| `notification-settings.tsx` row | Connections / Requests and acceptances | **Branches / Requests and acceptances** |
| `notification-settings.tsx` row | Profile views / When someone views your profile | **Profile views / When someone checks you out** |

### Settings & misc

| Where | Before | After |
|---|---|---|
| `settings.tsx` coming-soon | We're building this — it'll be available in an upcoming update. | **Still on the workbench — coming in an update.** |
| `verify-phone.tsx` | To apply for jobs, we need to verify your phone number. This helps employers reach you and prevents spam applications. | **We verify every worker's phone so employers know you're real — and so they can actually reach you.** |

**Register note for Balint:** "outfit" (for a company), "hand" (good hand), "link up," "ticket" (for a cert) are the load-bearing trade words above. They're common across US construction/industrial trades without being regional or hokey. What I deliberately avoided: fake grit ("git 'er done" energy), tree-metaphor verbs, and anything that talks down. The app should sound like a competent foreman, not a country song.

---

## Appendix — dead/orphaned things noticed during exploration

Cleanup candidates, separate from this proposal: `WorkerProfile.tradeYears` (no write path), `UserSettings.openToWork` (never read server-side — `jobAvailability` is the real flag), `WorkPlace.verificationEmail` (captured, but no verification email is ever sent), `profileCompleteness` (never computed — see B4), `Certification` (no expiry, no admin queue — see B3), and the `state_api` license-verification enum value (no integration behind it).
