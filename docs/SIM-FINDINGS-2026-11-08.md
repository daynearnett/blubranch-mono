# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Nov 2–6, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-11-08
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-11-02, 2026-11-04, 2026-11-06). Previous one-pager: `docs/SIM-FINDINGS-2026-11-01.md` (Oct 26–30 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Cold vouch gate still wide open — now reconfirmed on its first-ever employer-to-employer pairing.** *Repro: Deb (e2) → Vic (e3), zero connection verified via `GET /connections` on both sides first → `POST /users/:id/vouch` with a fabricated company → `201`, instant push, no gate.* 5+ sim runs, 8+ pairing types (worker→worker, worker→employer, employer→employer), zero gates, ever. (Nov 6)
2. **Marketplace loop still never closes — Twilio gate blocks every apply.** Carryover, unchanged. All three workers independently confirmed the identical, well-worded `403 ProfileIncomplete` (missing phone+photo), sitting on top of a verified-correct 6-item readiness check. (Nov 4)

### 🟠 Should-fix
3. **Malformed-id → raw Prisma 500 reconfirmed again, still unguarded.** `GET /jobs/not-a-real-uuid` still returns a verbatim `500` with full security headers but no JSON error body. Confirmed systemic last week (`/companies/:id` has the identical pattern); no fix yet on either route. (Nov 4)
4. **Notification lifecycle hit a new high-water mark on every single day this week, under completely ordinary usage — the most reliably-reproducing issue in the sim.** Nina (w3): 36→40→**43 unread**, oldest now **27 days** stale (a new sim-wide worst each run). Hank (e1): stale Oct-10 `connection_request` unread for **27 days — 12th consecutive sim-day check (Oct 10 through Nov 6) with zero change.** Vic (e3): oldest unread message now **~79 days** old. Three accounts' unread counts were observed ticking up *live, same-session*, from nothing more than ordinary cold outreach — this isn't just neglect, it grows from normal daily activity. (Mon/Wed/Fri, every run)
5. **Read-receipt timing precisely reconfirmed again.** Same-session before/after: `GET /conversations/:id/messages` (opening a thread) leaves `unreadCount` unchanged; only the explicit `PUT .../read` call clears it, correctly scoped to just that conversation. (Nov 6)
6. **Crew Post `viewerCoauthorStatus` missing from `/feed` — reconfirmed on a 4th independent fixture (Oct 12 → 19 → 26 → Nov 2), still unfixed.** Same isolated repro every time: present on `GET /posts/:id`, absent on `/feed` for the identical post. (Nov 2)
7. **Inconsistent id-field naming across routes — promoted from "not re-tested" to a concrete, reproducible bug with real UX teeth.** `GET /jobs?tradeId=1&state=OH` (the field names `pay-insights`/`POST /jobs` use) silently returns the full unfiltered 13-job catalog with **zero error** — Zod strips unrecognized query keys instead of rejecting them. A client using the wrong-but-plausible param name would show a worker every trade's jobs with no signal anything went wrong. First concrete repro after several weeks on the backlog. (Nov 4)
8. **`pay-insights` trade-slug param confirmed again, now on a persona where the bug actually bites.** Tommy (plumber) passing `?tradeId=electrician` gets back his own plumber figures unchanged — `Number("electrician")` → `NaN` → silent fallback to caller's own trade. (Nov 4)
9. **Vouch-pending backlog / no-decline-path, still climbing toward its first real test.** Vic's (e3) oldest fabricated pending vouch (Nina, Oct 12) is now 25 of the 30-day `PENDING_SHELF_LIFE_DAYS` window. **Correction from last run's speculation:** there is no expiry *job* — re-reading `routes/vouches.ts` found no `jobs/vouch-expiry.ts` and no `prisma.vouch.delete` anywhere in the codebase. The 30-day number is only a filter on the `GET /vouches/pending` *query* — crossing it just makes the vouch stop appearing in that one list; the row, the pending status, and the original notification all persist forever. Watch **~Nov 11** to confirm the list quietly drops it (not a real resolution). (Nov 2, corrected Nov 6)
10. **Zero job postings for plumber trade, 4th straight week.** `total:0` for both `trade=plumber` and a fallback `trade=general-labor`; Tommy's only option remains bookmarking a job outside his trade. (Nov 4)
11. **`/network/suggestions` junk holding in the same 70–90% range**, including the persistent `"Bob The builder "` trailing-space duplicate. Ray's reading bounced between 70% (Nov 6) and 85% (Nov 2) — noise, not a trend. (Mon/Fri)
12. **`plan` still returns the internal tier slug** (`"pro"`/`"unlimited"`), not a branded Blu/Blu Max name. Reconfirmed twice more. (Nov 2, Nov 4)

### 🟡 Polish / not re-tested this week (carryover, assume still open)
- `isFeatured` field-name no-op, location-blind `/jobs` (PostGIS flag) — both already root-caused in code (Oct 28), no fresh repro attempted this week.
- Public profile `slug`/Trade Card dead-share bug — last confirmed Oct 19, three weeks stale, worth one direct re-check.
- Duplicate `profile_nudge` notifications, `pay_highest` featured-tiebreak, `PUT /settings/notifications` silent key-stripping, no idempotency key on `POST /jobs`/`POST /messages`, job trade/title seed hygiene — none retested this week.

### ⚙️ Methodology (not a product bug, but needs a doc fix)
13. **The sim's own persona briefing is stale and was steering runs on wrong assumptions.** `docs/SIM-TESTER-AGENTS.md` / the scheduled task's persona text still says "w1↔w2 only connection, w3 out of network." Live `GET /connections` on Nov 6 showed Nina (w3) is actually the *best-connected* worker in the sim (4 connections), and the only genuinely zero-connection account left was Vic (e3) — who then got connected mid-run when he accepted Nina's request, closing the sim's last "always-available stranger" fixture. **Action needed:** update the persona doc to reflect real connection state and tell future network-day runs to pick untested *pairs* via `GET /connections`, not rely on a single always-stranger account. (Nov 6)
14. **A Nov-2 side-note claiming a nightly vouch-expiry job exists was wrong and has been retracted** (see #9) — re-reading the actual code on Nov 6 found no such job. No action needed beyond the correction already made in the day log.

---

## 2. Regression scorecard vs. the 2026-11-01 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **STILL-BROKEN** — reconfirmed on a brand-new pairing shape, first-ever employer→employer (Deb→Vic); 8+ pairing types now, 0 gates ever |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN** — reconfirmed on all 3 workers Nov 4, identical 403 shape |
| 3 | `/network/suggestions` QA/duplicate junk | **STILL-BROKEN** — same 70–90% ceiling, trailing-space dup still present, no trend either way |
| 4 | Crew Post `viewerCoauthorStatus` missing from `/feed` | **STILL-BROKEN** — reconfirmed on a 4th independent fixture, zero change |
| 5 | Public profile `slug`/Trade Card share dead | **NOT-RE-TESTED** — last confirmed Oct 19, three weeks stale now |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **NOT-RE-TESTED** — root-caused in code Oct 28, no fresh repro this week |
| 7 | Malformed job id → raw Prisma 500 | **STILL-BROKEN** — reconfirmed again on `/jobs/:id`, unchanged |
| 8 | Notification lifecycle drift | **STILL-BROKEN, new high-water mark every single run this week** (Nina 36→40→43 unread; Hank's 12th unchanged consecutive check; Vic's ~79-day message) |
| 9 | Read-receipt timing (reply/fetch doesn't mark read) | **STILL-BROKEN** — cleanly reconfirmed again on a brand-new message pair |
| 10 | Stale vouch-confirmation / vouch-pending backlog, no decline path | **STILL-BROKEN** — tracked every run; oldest fabrication now 25/30 days, boundary watch set for ~Nov 11; **correction issued** — the "30-day" mechanism is a list filter, not a deletion job (see finding #9 above) |
| 11 | `isFeatured` silent no-op | **NOT-RE-TESTED** this week (root-caused in code Oct 28) |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — same as #3, same accounts |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED** |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **NOT-RE-TESTED** |
| 15 | `pay-insights` trade-slug param no-op | **STILL-BROKEN** — reconfirmed on a persona where it actually matters (Tommy/plumber) |
| 16 | No idempotency key on `POST /jobs`/`POST /messages` | **NOT-RE-TESTED** — no fresh double-submit attempted, Oct-14 duplicate still residual evidence |
| 17 | `plan` returns internal slug not branded name | **STILL-BROKEN** — reconfirmed twice more (Nov 2, Nov 4) |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **NOT-RE-TESTED** |
| 19 | Inconsistent id-field naming across routes | **STILL-BROKEN — now with its first concrete repro** (was NOT-RE-TESTED for weeks; `tradeId`/`state` on `/jobs` silently no-ops with zero error) |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED** |
| 21 | Zero job postings for plumber trade | **STILL-BROKEN** — 4th straight Wednesday, unchanged |
| 22 | Out-of-network/"stranger" fixture methodology (retracted last week) | **NEW-THIS-WEEK methodology issue, different from last week's.** Last week's retraction stands (fixture wasn't actually exhausted). This week found the persona *briefing itself* is stale (real connections have grown well past the documented w1↔w2-only / w3-isolated setup), and the sim spent its last always-available zero-connection account (Vic) mid-run. Needs a doc update, not a retest. |

**Tally: 0 fixed this week, 1 newly confirmed-with-concrete-repro (id-field naming, item 19, promoted off NOT-RE-TESTED), 1 correction issued to a prior week's own speculation (item 10's "expiry job" claim), 1 new methodology issue surfaced (stale persona briefing), 11 still broken with no change, 8 not re-tested (carryover, assume still open).**

---

## 3. What worked well

- **Payments remain the most solid surface in the app, 4th+ week running.** A brand-new Basic $19 one-time job post went through the full headless Stripe round trip — draft → intent → real Stripe confirm → BluBranch confirm → `open` — with zero friction and zero ambiguous states. (Nov 4)
- **Both paid subscriptions keep renewing clean, now a 30-day streak** for Blu (Deb) and Blu Max (Vic), both rolled to `currentPeriodEnd: 2026-11-15` with no manual re-pull needed. (Nov 2, Nov 4)
- **Profile-view notifications got the most conclusive, two-sided verification of any feature in weeks.** Both halves proven same-session: the per-type preference gate correctly suppressed the notification when `notifyProfileViews:false` (Vic), and the 24-hour per-viewer throttle correctly held on an immediate second view from the same viewer on an account with the pref on (Ray/Hank). (Nov 6)
- **Job-stats analytics are genuinely real-time** — a view on a featured listing showed up in the owner's stats within the same session. (Nov 4)
- **Apply-readiness gate continues to behave exactly as documented** — all three workers show the identical, correctly-differentiated `403 ProfileIncomplete` with the same two real gaps (phone, photo), never the legacy phone-only code when two fields are missing. (Nov 4)
- **Legitimate in-network vouching and messaging remain airtight** — Ray/Tommy's mutual confirmed vouch holds from a prior run, and a brand-new Ray→Tommy message + reply + explicit read-mark all worked exactly as documented, correctly scoped to just the one conversation touched. (Nov 6)
- **The duplicate-vouch unique constraint correctly blocks a repeat cold vouch** on the same pair (`409 Conflict`) — same clean behavior as the duplicate-connection-request check confirmed previously. (Nov 6)
- **Crew post + coauthor accept mechanics remain solid** apart from the one known `/feed` serializer gap — invite, accept, and correct status/coauthors list all work on every surface except `/feed`. (Nov 2)
- **Toolbox Talk stays fully shared across every role**, workers and employers alike, with no moderation false positives. (Nov 2)

---

## 4. Experience contrasts

- **Worker vs. employer:** unchanged — still severed by the Twilio apply-gate. Employers pay, post, and get clean real-time dashboards/stats (job-stats, subscription status); workers browse, bookmark, and get blocked at apply every time with a consistent, correctly-worded 403. Zero applications have ever completed in this sim.
- **In-network (w1/w2) vs. out-of-network (w3):** the "out of network" label for Nina (w3) is now **factually wrong** — she has 4 live connections, more than any other persona, and is missing only a link to Vic. The real in-network/out-of-network split has shifted to "has anyone tried this pair before," not a fixed role. The cold-vouch gate stays open regardless of pairing — this week's repro used the sim's first employer-to-employer pair and it fell exactly the same way.
- **Basic vs. Blu vs. Blu Max — did renewal work:** yes, both confirmed twice this week (Nov 2, Nov 4), both tiers clean, 30-day streak, no manual intervention either time. Tiers remain functionally indistinguishable beyond price in every feature touched this week, apart from the still-unbranded `plan` string.

---

## 5. Recommended pre-launch punch list, ordered

1. **Gate vouches on an existing connection** — launch-blocker, now reconfirmed on an 8th pairing type including employer-to-employer; the single highest-confidence finding in the sim.
2. **Move Twilio to paid** — launch-blocker, carryover; nothing closes the marketplace loop until this ships.
3. **Fix the notification lifecycle at the root** — the most reliably-reproducing issue in the sim, hitting a new high-water mark on literally every run this week, and now observed growing live from ordinary same-day activity, not just neglect.
4. **Guard every raw `:id` route against malformed input** — still unfixed on `/jobs/:id`, confirmed systemic last week on `/companies/:id` too; audit all `:id`-param routes in one pass.
5. **Fix the read-receipt mechanism** — precisely isolated: client needs to call the explicit read endpoint on thread-open, or the server should mark-read on fetch.
6. **Fix Crew Post feed fan-out** (add `viewerCoauthorStatus` to the `/feed` payload) — reconfirmed a 4th time, isolated to one serializer field, should be a small fix.
7. **Fix the `tradeId`/`state` vs. `trade` param inconsistency on `/jobs`** — now has a concrete, real-world repro (silently shows every trade's jobs with zero error); reject unknown query keys instead of silently stripping them, at least as a stopgap across the API.
8. **Fix `pay-insights` trade-slug handling** — reject or properly parse a slug instead of silently `NaN`-ing into the caller's own trade.
9. **Decide the no-decline-path problem for vouches** — independent of the notification fix; check the Nov-11 boundary on Vic's oldest fabrication to confirm it only drops off the `/vouches/pending` list (not an actual resolution) before relying on it for anything.
10. **Seed job postings for the plumber trade** — 4 straight weeks at zero, a real two-feature dead end for that trade (jobs + pay-insights).
11. **Purge/filter QA and duplicate-name accounts** from `/network/suggestions` — holding at a 70–90% junk ceiling for weeks, including the known trailing-space duplicate.
12. **Rename `plan` to a branded tier string** (Blu/Blu Max) — low effort, visible to every paying customer, reconfirmed again this week.
13. **Update `docs/SIM-TESTER-AGENTS.md`'s persona section** — the "w1↔w2 only / w3 out-of-network" text is now actively wrong and misleads every future network-day run; replace with "check `GET /connections` live each run" guidance.
14. **Re-verify `isFeatured`, the PostGIS location-blind `/jobs` decision, and the Trade Card share-link bug** — all root-caused in code weeks ago but not retested this week or last; schedule a direct pass.
15. Polish sweep carryover (not re-tested in several weeks, assume still open): duplicate `profile_nudge` notifications, `pay_highest` featured-tiebreak, `PUT /settings/notifications` silent key-stripping, no idempotency key on `POST /jobs`/`POST /messages`, job trade/title seed hygiene.

*Next run: with Vic (e3) now connected to Nina, every account in the sim has at least one connection — future network-day runs should pick a never-tried **pair** (several still exist, e.g. w1–e2, w1–e3, w2–e1, w2–e2, e1–e2) rather than assume a single always-stranger account. Also worth a direct check around Nov 11 on whether Vic's oldest fabricated pending vouch quietly drops off `/vouches/pending` as the query-filter correction predicts.*
