# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Nov 9–13, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-11-15
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-11-09, 2026-11-11, 2026-11-13). Previous one-pager: `docs/SIM-FINDINGS-2026-11-08.md` (Nov 2–6 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Marketplace loop still never closes — Twilio gate blocks every apply.** The sim's one remaining launch-blocker now that cold-vouch is fixed (see below). All three workers get the identical, correctly-worded `403 ProfileIncomplete` (missing phone+photo) on a verified-correct 6-item readiness check. Unchanged, carryover. (Nov 11)

### 🟠 Should-fix
2. **`/network/suggestions` junk filter shipped but doesn't actually work — new, sharper finding.** The merged fix (PR #12, Nov 11) claims to exclude `@*.invalid` QA accounts and collapse duplicate names. Live check two days later: still **60% junk (12/20)** on Ray's list, same `"Bob The builder "` trailing-space duplicate present, unchanged from the pre-fix 65–90% band. Root cause suspected: QA accounts use real-looking emails, not literally `@*.invalid`, so the filter's condition doesn't catch them. Needs to go back to the author. (Nov 13)
3. **Location-blind `/jobs` (PostGIS) reconfirmed broken with a concrete repro — and a fix may have landed since, untested.** Nina's 50mi vs 200mi radius search from Cleveland returned identical results (both show Columbus jobs ~140mi away, zero filtering effect). This was confirmed **before** PR #13 ("Fix location-blind GET /jobs radius search on non-PostGIS environments") merged to `main` later the same day (Nov 11, 18:04 UTC), plus a follow-up self-heal commit Nov 13 evening. Neither has been exercised live by the sim yet — Friday was a network/messaging day and didn't touch jobs. **Needs a direct retest next jobs-day run.** (Nov 11, flagged open Nov 15)
4. **Notification lifecycle drift — still the most reliably-reproducing issue, but the picture got genuinely mixed this week.** Nina kept setting new sim-wide worsts every single check (43→48→**54** unread, oldest now **34 days** stale). Ray and Tommy also climbed (29→32→35, 28→31→35). Against that: **Hank's 32-day-stale, 14-run-unchanged backlog inexplicably cleared to 0** sometime around Nov 11 (bulk `readAt` on every notification, cause unconfirmed — not explained by any shipped fix), and Vic's dropped by exactly one as a side effect of the new vouch-expiry job hard-deleting an orphaned notification. Net: still broken as a trend for 3 of 6 accounts, with one real mystery worth watching. (Mon/Wed/Fri, every run)
5. **Read-receipt timing directly re-tested against the developer's own rebuttal — still broken at the API-contract level.** PR #12's commit message claimed this was a sim-methodology gap (the real mobile client allegedly mark-reads on screen-open). Today's test re-ran the exact repro right after reading that claim: opening a thread via `GET /conversations/:id/messages` still leaves `unreadCount` unchanged; only the explicit `PUT .../read` clears it. Whatever the mobile client does on top, the public REST contract is unchanged. (Nov 13)
6. **New finding (Nov 9), reconfirmed unchanged (Nov 13): crew-post coauthor invites are invisible to anyone with `notifyMentions` off.** `coauthor_invite` shares the generic @-mention preference gate — when it's off (as on Tommy's account), the invited coauthor gets zero in-app notification, badge, or push for a real person tagging them onto a real post, with no fallback signal. Not addressed by PR #12. Tommy only noticed by chance both times.
7. **Zero plumber-trade job postings — resolved for one day, status uncertain going forward.** First non-zero plumber listing in 5 straight weekly checks (Nov 11, `total:1`), but its timestamp predates that session's first API call by ~95 minutes — unclear whether an earlier unlogged run, a real user, or something else created it. Not retested Nov 13 (out of theme). Needs confirmation it's a durable fix, not a one-off fixture.
8. **Public profile `slug`/Trade Card dead-share bug — now 4+ weeks stale with zero re-test**, last confirmed Oct 19.

### 🟡 Polish / not re-tested this week (carryover, assume still open unless noted)
- `isFeatured` no-op, duplicate `profile_nudge` notifications, `pay_highest` featured-tiebreak, no idempotency key on `POST /jobs`/`POST /messages`, job trade/title seed hygiene — none touched this week.
- Assumed still-fixed (confirmed Nov 11, not retested Nov 13 since out of theme): `pay-insights` trade-slug NaN fallback, `tradeId`/`state` strict-query rejection on `/jobs`, `plan`/`planLabel` branding.

### ⚙️ Methodology
9. **`sim-logs` branch lags `main` by days — cost real time this week.** The Nov-11 day log credited PR #12 with 6 fixes; re-reading code on `sim-logs` on Nov 13 still showed the old (broken) code, because the branch was never synced after the PR merged. A live check caught the discrepancy and the Nov-13 run ended up crediting 3 *more* fixes from the same PR that Nov-11 missed (`/feed` `viewerCoauthorStatus`, notification-settings strict mode, `/network/suggestions` filter — the last one shipped but ineffective, see #2). **Action needed: sync `sim-logs` with `main` (or at least `git fetch origin main` for code-reading) at the start of every run**, not just rely on the branch's own history.
10. **`docs/SIM-TESTER-AGENTS.md`'s persona table was fixed on `main` (Nov 11) but the `sim-logs` copy is still stale.** Same root cause as #9. This week's runs correctly fell back to live `GET /connections` per their briefing regardless, so no bad data resulted — but the doc itself needs the same sync.

---

## 2. Regression scorecard vs. the 2026-11-08 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **FIXED** — first-ever gate hold Nov 11 (Hank→Vic, e↔e), reconfirmed on 2 more fresh pairs Nov 13 (Tommy→Deb w→e, Hank→Tommy e→w). 4-for-4 clean since the fix landed, zero misses across 3 pairing shapes. |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN** — unchanged, confirmed Nov 11 (not touched Nov 13, out of theme). Now the sim's sole remaining launch-blocker. |
| 3 | `/network/suggestions` QA/duplicate junk | **STILL-BROKEN despite a shipped fix** — fix landed in PR #12 but doesn't reduce the junk rate (65–90% pre-fix band → 60% post-fix, no measurable improvement); same trailing-space dup still present. New, sharper finding. |
| 4 | Crew Post `viewerCoauthorStatus` missing from `/feed` | **FIXED** — confirmed live for the first time ever Nov 13, after 7+ consecutive weekly checks broken since October. |
| 5 | Public profile `slug`/Trade Card share dead | **NOT-RE-TESTED** — now 4+ weeks stale, last confirmed Oct 19. |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **STILL-BROKEN as of its last live check (Nov 11)**, with a concrete repro (50mi vs 200mi from Cleveland, identical results). A fix (PR #13) merged hours later the same day, plus a follow-up self-heal commit Nov 13 — **neither verified live yet**. Flag for direct retest next jobs-day run. |
| 7 | Malformed job id → raw Prisma 500 | **FIXED** — confirmed on both `/jobs/:id` and `/companies/:id` Nov 11, reconfirmed stable Nov 13. |
| 8 | Notification lifecycle drift | **MIXED, trend still broken for 3/6 accounts.** Nina/Ray/Tommy hit new worsts every check; Hank's 32-day/14-run streak inexplicably cleared (cause unconfirmed); Vic's dropped by one as an expiry-job side effect. |
| 9 | Read-receipt timing (reply/fetch doesn't mark read) | **STILL-BROKEN** — directly re-tested Nov 13 against the developer's own commit-message claim that it's sim-methodology-only; the raw API contract is unchanged. |
| 10 | Stale vouch-confirmation / vouch-pending backlog, no decline path | **FIXED, fully verified both ways** — `PUT /vouches/:id/decline` now exists and works symmetrically (Nov 13); the 30-day shelf-life job performs a real hard delete (confirmed via notification-count side effect, not just a list filter, correcting both the Nov-01 and Nov-08 docs' earlier guesses). |
| 11 | `isFeatured` silent no-op | **NOT-RE-TESTED** this week. |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — same as #3. |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED**. |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **NOT-RE-TESTED**. |
| 15 | `pay-insights` trade-slug param no-op | **FIXED** — confirmed Nov 11 (`400` instead of silent `NaN` fallback), not retested Nov 13. |
| 16 | No idempotency key on `POST /jobs`/`POST /messages` | **NOT-RE-TESTED**. |
| 17 | `plan` returns internal slug not branded name | **FIXED** — `planLabel` ("Blu"/"Blu Max") added alongside the raw slug, confirmed Nov 11, not retested Nov 13. |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **FIXED** — confirmed live Nov 13 (now `.strict()`, rejects misspelled keys with a clear 400). |
| 19 | Inconsistent id-field naming across routes | **FIXED** — `tradeId`/`state` on `/jobs` now `400`s instead of silently stripping, confirmed Nov 11. |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED**. |
| 21 | Zero job postings for plumber trade | **RESOLVED FOR ONE DAY (Nov 11, `total:1`)** — methodology flag on the pre-existing timestamp; not retested Nov 13; durability unconfirmed. |
| 22 | Stale persona-briefing doc (methodology) | **Corrected on `main` (Nov 11), but the `sim-logs` copy is still stale** — see methodology item #10 above. |
| NEW | Coauthor-invite notification suppressed by shared `notifyMentions` pref | **NEW-THIS-WEEK, STILL-BROKEN on reconfirm.** First caught Nov 9, reconfirmed unchanged Nov 13, not addressed by PR #12. |
| NEW | `sim-logs` branch lagging `main`'s shipped fixes | **NEW-THIS-WEEK, methodology.** Cost real time Nov 13; needs a branch-sync habit going forward. |

**Tally: 8 fixed this week** (cold-vouch gate, malformed-id ×2 routes, `/jobs` strict-query, pay-insights NaN, `plan` branding, Crew Post `/feed` field, notification-settings strict mode, vouch decline+hard-delete) **, 1 fix shipped-but-ineffective** (`/network/suggestions` junk filter) **, 1 fix landed on `main` but not yet verified live** (PostGIS location-blind `/jobs`, PR #13 + follow-up) **, 1 resolved-for-a-day with durability unconfirmed** (plumber jobs) **, 1 mixed/uncertain** (notification lifecycle) **, 2 still-broken-unchanged** (Twilio gate, read-receipt timing) **, 1 new-this-week product bug** (coauthor-invite/`notifyMentions` suppression) **, 1 new-this-week methodology issue** (`sim-logs` lagging `main`) **, 8 not-re-tested** (carryover, assume still open).

This is by far the sim's best week for shipped fixes — nearly the entire Nov-08 should-fix list closed in one PR (#12), including the single highest-confidence launch-blocker (cold-vouch).

---

## 3. What worked well

- **Cold-vouch gate: 4-for-4 clean since the fix landed**, across three distinct pairing shapes (employer↔employer, worker→employer, employer→worker). The sim's single highest-confidence launch-blocker, open for 5+ weeks and 8+ prior pairing attempts, is closed.
- **Vouch lifecycle is now fully closed-loop**: confirm, decline, and 30-day hard-delete expiry all verified working symmetrically, leaving no orphaned state on either side.
- **Crew-post mechanics are now fully correct everywhere**, including `/feed` — the one isolated serializer gap that survived 7+ straight weekly checks since October is closed.
- **Connection-request → accept → message flow worked perfectly end-to-end, live, same session** (Ray→Deb), with correct real-time notification delivery on both sides.
- **Profile-view throttle and duplicate-vouch protection both held again** on brand-new pairs/fixtures.
- **Payments remain the most solid surface in the app, 5th+ week running** — a brand-new Basic $19 one-time post went through the full headless Stripe round trip with zero friction; both subscriptions (Blu, Blu Max) hit a **35-day clean renewal streak**, now with branded `planLabel` on top.
- **Job-stats analytics are genuinely real-time** and **apply-readiness continues to behave exactly as documented** (correctly-differentiated 403, same two real gaps every time).
- **Toolbox Talk, likes/comments, and feed updates remain real-time and consistent** across every persona and role, no moderation false positives.

---

## 4. Experience contrasts

- **Worker vs. employer:** unchanged — still severed by the Twilio apply-gate, now the sim's only standing launch-blocker. Employers pay, post, and get clean real-time dashboards/stats; workers browse, bookmark, and get blocked at apply every time. Zero applications have ever completed in this sim.
- **In-network vs. out-of-network:** the old framing is obsolete — the connection graph is now dense (Nina is the hub, connected to all 5 others), so the real test axis this week was "untested pair," not a fixed role. The cold-vouch gate now holds correctly regardless of pairing shape, confirmed on all three shapes tried this week.
- **Basic vs. Blu vs. Blu Max — did renewal work:** yes, confirmed again Nov 11 (35-day streak, `currentPeriodEnd: 2026-11-15`, no manual re-pull). Tiers are now visibly differentiated beyond price via the new `planLabel` field, but otherwise remain functionally similar in every feature the sim touches.

---

## 5. Recommended pre-launch punch list, ordered

1. **Move Twilio to paid** — the sim's one remaining launch-blocker; nothing closes the marketplace loop until this ships.
2. **Fix `/network/suggestions`'s junk filter for real** — the shipped fix doesn't reduce the junk rate (60% unchanged); likely needs to match on the actual QA-account pattern (real-looking emails, not just `@*.invalid`), not just the stated condition.
3. **Verify PR #13 + the Nov-13 self-heal commit live** — the PostGIS location-blind `/jobs` fix merged to `main` but has not been exercised by any sim run yet; schedule a direct retest on the next jobs-day (Wednesday) run.
4. **Investigate the notification-lifecycle trend at the root** — still the most reliably-reproducing issue for 3 of 6 accounts (new worst nearly every check); separately, find out why Hank's 32-day backlog cleared unprompted around Nov 11 and whether it resumes climbing.
5. **Decide the read-receipt question for real** — either confirm the mobile client reliably calls the explicit mark-read endpoint on open (and accept the REST-only gap as intentional), or add a server-side mark-read-on-fetch fallback; don't leave it as an unresolved disagreement between the commit message and the sim's repeated findings.
6. **Split or redesign the coauthor-invite notification gate** — it currently shares the generic `notifyMentions` toggle, so a worker who muted @-mention spam also loses real crew-post invites with zero fallback signal.
7. **Sync `sim-logs` with `main` at the start of every run** (and update the `sim-logs` copy of `docs/SIM-TESTER-AGENTS.md`) — the branch drift cost real time this week and nearly under-credited a shipped fix.
8. **Confirm the plumber-job fix is durable**, not a one-off fixture — recheck `GET /jobs?trade=plumber` on the next Wednesday run.
9. **Re-verify stale carryover items not touched in 3+ weeks**: Trade Card/profile-slug share bug (4+ weeks stale), `isFeatured` no-op, duplicate `profile_nudge`, `pay_highest` tiebreak, idempotency keys on `POST /jobs`/`POST /messages`, job seed hygiene.

*Next run: a jobs/payments day should re-cover the items intentionally left out of this week's network/messaging-themed Friday run (PostGIS fix verification, pay-insights, `/jobs` strict query, plumber jobs, plan branding) — all assumed-still-fixed or open based on Nov 11 only.*
