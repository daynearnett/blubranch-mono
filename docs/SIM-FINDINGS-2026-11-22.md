# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Nov 16–20, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-11-22
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-11-16, 2026-11-18, 2026-11-20). Previous one-pager: `docs/SIM-FINDINGS-2026-11-15.md` (Nov 9–13 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Marketplace loop still never closes — Twilio/apply gate blocks every apply, now a richer 2-item gate.** All three workers hit `403 ProfileIncomplete` on every apply attempt this week. As of Wed Nov 18 the gate upgraded from the old phone-only message to a 2-item `missing:[phone,photo]` gate for all three ("Crews hire faces, not blank circles") — more honest, but still zero applications have ever completed in the sim's history. Unchanged, carryover, confirmed all three days. (Mon/Wed/Fri)

### 🟠 Should-fix
2. **New finding: staging has no `GOOGLE_MAPS_API_KEY`, so every job geocodes to a Chicago-area fallback point — this is now the single highest-leverage fix available.** Wednesday's direct repro proved the PostGIS/Haversine radius math itself is genuinely fixed (correctly differentiates 50/200/500mi with accurate `distanceMiles`) — but with no Google key configured, every job's `lat`/`lng` falls back to a hardcoded point near Chicago regardless of its real city. Net effect for a real user: location search still looks completely broken, for a different reason than before. Setting the key unlocks a fix that's otherwise already done. (Nov 18)
3. **New finding: both employer subscriptions (Blu, Blu Max) canceled in Stripe on the identical day, breaking a 35+ day clean-renewal streak.** Discovered Monday — recovered cleanly the same session via the documented headless Stripe re-subscribe path, and held clean through Wednesday's check (`currentPeriodEnd: 2026-12-16`). Root cause unconfirmed (missed/misrouted webhook around the Nov-15 renewal boundary, or something Stripe-test-mode-specific); the real test is whether it recurs at the Dec-16 boundary. (Nov 16, holding Nov 18)
4. **`/network/suggestions` junk filter still doesn't work — three straight confirmations this week, root cause now pinned exactly in code.** 65% (Mon) → 60% (Wed) → 65% (Fri) junk on Ray's top-20, same `"Bob The builder "` trailing-space duplicate every time. Code read confirms the filter is literally `email.endsWith('.invalid')` — the QA fixture accounts use realistic-looking emails, so it never matches them. Needs a different signal (a flag, a name heuristic, or just deleting the fixtures).
5. **Public profile `slug`/Trade Card share — reconfirmed broken after 4+ weeks untouched.** First retest since Oct 19 (Mon), reconfirmed again Wed: `slug:null` on `GET /users/me/trade-card`, both public share routes 404. Blocks the entire Trade Card public-share feature for any worker without a slug.
6. **Coauthor-invite notifications suppressed by the shared `notifyMentions` pref — 4th consecutive confirmation, unchanged.** A worker who mutes @-mention spam also loses real crew-post coauthor invites with zero fallback signal — no in-app row, no push, nothing. Reconfirmed Monday on a fresh fixture; not addressed.
7. **Read-receipt timing — reconfirmed with hard numbers this time, still an open disagreement.** `GET /conversations/:id/messages` leaves `unreadCount` unchanged (4→4); only the explicit `PUT .../read` clears it (4→2, correctly scoped per-thread). Same API contract as every prior check — the developer's "sim methodology gap" claim from two weeks ago is still not supported by the raw contract. (Nov 20)

### 🟢 Closed for good this week
8. **Notification lifecycle drift — definitively closed, not just "mixed."** Friday did the full `GET unread-count` → `PUT /notifications/read-all` → re-check round trip for **all six accounts** for the first time (previously only spot-checked one at a time). 6-for-6 cleared to exactly 0. The multi-week "new worst every check" trend was purely a function of nobody ever calling `read-all` — **there is no server bug.** Recommend retiring this watchlist item; trend counters reset as of Nov 20.

### ⚪ Not bugs — design/documentation clarifications
- **Cold DMs are intentionally unblocked** (only rate-limited to 50/day for non-connections) — a genuine, confirmed-in-code contrast with the correctly-gated cold-vouch rule. Worth stating plainly so it's never mistaken for a gap in the vouch fix. (Nov 20)
- **`pay_highest` featured-tiebreak** — downgraded from bug to working-as-designed. The `isFeatured` flag is present and correct in the API response and the tiebreak is explicit, documented behavior; any remaining user confusion is a mobile-rendering question, not a missing server field. (Nov 18)

---

## 2. Regression scorecard vs. the 2026-11-15 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **FIXED, further reconfirmed** — 2 more fresh stranger pairs Friday (Hank→Deb, Vic→Deb, both clean `403`), plus a same-session flip-test proving the gate unlocks instantly on connection-accept. 7-for-7 clean since the fix landed, across 4 distinct pairing shapes. |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN, unchanged** — confirmed all three days; now a richer 2-item `missing:[phone,photo]` gate rather than phone-only. |
| 3 | `/network/suggestions` QA/duplicate junk | **STILL-BROKEN, unchanged** — 65%/60%/65% across Mon/Wed/Fri, root cause pinned exactly in code (`email.endsWith('.invalid')` doesn't match realistic QA emails). |
| 4 | Crew Post `viewerCoauthorStatus` missing from `/feed` | **FIXED, reconfirmed** — fresh same-session fixture Monday, 3rd+ consecutive clean check. Not touched Wed/Fri (out of theme). |
| 5 | Public profile `slug`/Trade Card share dead | **STILL-BROKEN** — first retest in 4+ weeks (Mon), reconfirmed Wed. Not touched Friday. |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **SPLIT VERDICT — root cause fixed, masked by a new bug.** The Haversine radius math is genuinely correct now (first direct confirmation, Wed). But with no `GOOGLE_MAPS_API_KEY` on staging, every job geocodes to a Chicago-area fallback point instead of its real city, so location search still looks broken to any real user. See top finding #2. |
| 7 | Malformed job id → raw Prisma 500 | **FIXED, reconfirmed** — clean `400`s on `/jobs/:id` and `/companies/:id`, Mon + Wed. Not re-checked Friday. |
| 8 | Notification lifecycle drift | **CLOSED FOR GOOD** — full 6-account GET+PUT read-all round trip Friday, 6-for-6 clean to 0. Recommend retiring this item; see top finding #8. |
| 9 | Read-receipt timing (GET doesn't mark read) | **STILL-BROKEN, reconfirmed** — same API contract, now logged with controlled before/after numbers (Fri). |
| 10 | Stale vouch-confirmation / vouch-pending backlog, no decline path | **FIXED, reconfirmed** — fresh fixture Friday (Deb declines Hank's vouch), symmetric, clean. |
| 11 | `isFeatured` silent no-op | **FIXED — first reconfirmation in weeks** (Wed). Demonstrably drives sort order in both `sort=newest` and `sort=pay_highest`, including the documented featured-beats-higher-pay tiebreak. |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — same issue as #3, tracked together. |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED** this week. |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **DOWNGRADED — not a server bug.** Confirmed Wed the flag is present and correct in the API response; any gap is mobile-UI, not server-side. |
| 15 | `pay-insights` trade-slug param no-op | **FIXED, reconfirmed** — clean `400` instead of a silent NaN fallback (Wed). |
| 16 | No idempotency key on `POST /jobs`/`POST /messages` | **NOT-RE-TESTED** this week. |
| 17 | `plan` returns internal slug not branded name | **FIXED, reconfirmed** — `planLabel` present alongside the raw slug, Mon + Wed. |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **NOT-RE-TESTED** this week (assume still fixed per last confirm, Nov 13). |
| 19 | Inconsistent id-field naming across routes | **FIXED, reconfirmed** — `tradeId`/`state` on `/jobs` still clean `400`s (Wed). |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED** this week. |
| 21 | Zero job postings for plumber trade | **FIXED — durability now confirmed.** The Nov-11 listing stayed live and searchable for 7 straight days with no re-seed needed (Wed). Closing this watchlist item for good. |
| 22 | Stale persona-briefing doc / `sim-logs` lagging `main` (methodology) | **RESOLVED — adopted as practice.** All three runs this week explicitly fetched route shapes fresh from `origin/main` at session start instead of trusting the `sim-logs` copy; no drift issues reported. |
| NEW | Coauthor-invite notification suppressed by shared `notifyMentions` pref | **STILL-BROKEN, reconfirmed again** — 4th consecutive check (Mon), unchanged, not addressed. |
| NEW | Employer subscription same-day double-lapse | **NEW-THIS-WEEK, recovered, holding.** Both subscriptions canceled in Stripe on the identical day (Mon finding), recovered via headless re-subscribe, held clean through Wed. Real test is the Dec-16 renewal boundary. |
| NEW | No `GOOGLE_MAPS_API_KEY` on staging | **NEW-THIS-WEEK** — see top finding #2. |
| NEW | Cold-DM "gate" | **NEW-THIS-WEEK — not a bug.** Clarified as intentional non-gating (rate-limited only), a deliberate contrast with the gated vouch flow. |

**Tally: 6 fixed/reconfirmed** (cold-vouch gate, crew-post `/feed` field, malformed-id, vouch decline, `planLabel`, `tradeId`/`state` strict query, pay-insights NaN guard — several carried across multiple days) **, 2 newly fixed this week** (`isFeatured` no-op, plumber-trade postings durability — both watchlist items now closeable) **, 1 closed-for-good** (notification lifecycle) **, 1 downgraded to not-a-bug** (`pay_highest` tiebreak visibility) **, 1 new finding recovered** (subscription double-lapse) **, 1 new finding open** (missing Google Maps key) **, 1 new clarification** (cold-DM non-gate) **, 1 split verdict** (PostGIS math fixed, masked by the Maps-key bug) **, 5 still-broken-unchanged** (Twilio gate, `/network/suggestions` junk, Trade Card/slug, coauthor-invite suppression, read-receipt timing) **, 1 methodology item resolved** (sim-logs/main drift) **, 4 not-re-tested** (duplicate `profile_nudge`, idempotency keys, job seed hygiene, notification-settings strict mode).

---

## 3. What worked well

- **The cold-vouch gate is now airtight across 4 distinct pairing shapes**, including a same-session flip-test proving it correctly unlocks the instant two strangers become connected — the strongest evidence yet that the sim's former #1 launch-blocker is solidly fixed.
- **The notification-lifecycle question — bounced between "broken" and "methodology artifact" for 5+ weeks — is finally closed for real**, with a clean, decisive 6-for-6 full-account round trip instead of another partial spot check.
- **`isFeatured` demonstrably works end-to-end now**: set correctly at creation, gated by plan tier, and correctly drives sort order including the documented pay-tiebreak — a real fix, confirmed for the first time in weeks.
- **The underlying PostGIS/Haversine radius math is genuinely correct**, confirmed with a controlled 50/200/500mi repro — a real 7-day-old open question closed, even though a second bug currently masks it for real users.
- **Zero-plumber-postings is resolved and now durability-confirmed** (7 days live, no re-seed needed) — a watchlist item that can finally close.
- **Vouch decline + profile-view throttle both reconfirmed working exactly as designed**, with the clearest evidence yet (fresh-vs-repeat-target contrast on the profile-view throttle).
- **Payments stayed the most reliable surface** despite the subscription hiccup — two more full headless Stripe round trips (a Basic one-time post + a Blu subscription-covered post) went through with zero friction.
- **The team adopted the "fetch fresh from `main`" habit this week** — all three runs explicitly pulled route shapes from `origin/main` rather than trusting the stale `sim-logs` copy, resolving last week's branch-drift methodology flag with no new issues.

---

## 4. Experience contrasts

- **Worker vs. employer:** unchanged — still severed by the Twilio apply-gate, the sim's sole launch-blocker. Employers get a fully working toolset this week (featured boosts, correct tiebreak sorting, clean Stripe flows, job stats); workers browse, bookmark, and get blocked at apply every time. Zero applications have ever completed in this sim's history.
- **In-network vs. out-of-network:** the cold-vouch gate holds cleanly regardless of pairing shape (now 4 shapes tried, 7-for-7). A genuinely new contrast surfaced this week: **cold DMs are deliberately NOT gated** (rate-limited only) while cold vouches are — confirmed intentional in code, not an oversight, and worth the founders knowing explicitly so it isn't re-flagged as a bug later.
- **Basic vs. Blu vs. Blu Max — did renewal work:** mixed. Basic posting still requires the full one-time Stripe payment flow (worked cleanly twice this week). Subscription renewal had its **first crack in 5+ weeks**: both Blu and Blu Max canceled in Stripe on the identical day (Nov 15 boundary), recovered via headless re-subscribe, and held clean through Wednesday at the new `currentPeriodEnd: 2026-12-16`. Whether this was a one-off or will recur is unknown until that date.

---

## 5. Recommended pre-launch punch list, ordered

1. **Move Twilio to paid** — still the sim's one launch-blocker; nothing closes the marketplace loop until this ships.
2. **Set `GOOGLE_MAPS_API_KEY` on the staging Railway service** — now the single highest-leverage fix available, since the radius-search math it would unlock is already correct. Also consider a one-off backfill for pre-existing null-coordinate job listings.
3. **Root-cause the Nov-15 employer-subscription double-lapse** before the Dec-16 renewal boundary — check for a missed/misrouted Stripe webhook around the renewal window, or something specific to how Stripe test-mode subscriptions age.
4. **Fix `/network/suggestions`'s junk filter for real** — three straight weeks confirming the same 60–65% junk rate; the filter needs to match the actual QA-account pattern (or the fixtures should just be deleted) rather than the ineffective `@*.invalid` check.
5. **Fix the Trade Card/profile-slug share bug** — now confirmed broken on 2 of 3 runs this week after 4+ weeks stale; it blocks the entire public Trade Card feature for any worker without a slug.
6. **Split or redesign the coauthor-invite notification gate** off the shared `notifyMentions` toggle — 4 consecutive weekly confirmations, zero fallback signal for a real person being tagged onto a real post.
7. **Resolve the read-receipt disagreement for real** — either confirm the mobile client reliably calls the explicit mark-read endpoint on open and accept the REST-only gap as intentional, or add a server-side fallback. This has now been re-tested with hard numbers multiple times with the same result.
8. **Retire the "notification lifecycle drift" watchlist item** — closed for good this week; note for next week's doc that trend counters reset as of Nov 20 (don't compare against pre-Nov-20 history).
9. **Document the cold-DM-vs-cold-vouch design contrast** for the team so it's never mistaken for a gap in the vouch fix.
10. **Re-verify stale carryover items not touched in 2+ weeks**: duplicate `profile_nudge` notifications, idempotency keys on `POST /jobs`/`POST /messages`, job seed hygiene, `PUT /settings/notifications` strict mode, and the "Heavy Equipment Operator" 45-day zero-view listing flagged Nov 18.

*Next run: a jobs/payments day should spot-check the Google Maps key fix once set, re-pull both employer subscriptions ahead of the Dec-16 boundary, and continue the `/network/suggestions`/Trade Card watchlist items on their own themed days.*
