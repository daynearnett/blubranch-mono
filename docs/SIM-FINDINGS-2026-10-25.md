# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Oct 19–23, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-10-25
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-10-19, 2026-10-21, 2026-10-23). Previous one-pager: `docs/SIM-FINDINGS-2026-10-18.md` (Oct 12–16 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Cold vouch gate still completely absent — now proven on a 6th relationship type, including employer↔employer with zero relationship of any kind.** *Repro: Hank Morrow (e1) → Vic Tran (e3), `vouch-context` showed `given:null, received:null` both directions → `POST /users/:id/vouch` with a company name admitting it's fake → `201`, instant push to Vic. Four sim runs, six pairing types, zero gates.* (Oct 23)
2. **Marketplace loop still never closes — Twilio gate blocks every apply, all three workers.** Carryover, unchanged. The gate's current shape (`403 ProfileIncomplete, missing:[phone,photo]`) is now confirmed stable/correct across all three workers — this is the documented behavior, not a new regression. *Repro: any worker, any job, `POST /jobs/:id/apply` → 403.* (Oct 21)
3. **Trade Card / public-profile `slug` is confirmed dead for a real, fully-active account — not just "unconfirmed."** Flagged as overdue for 3 straight weeks; now resolved as broken. *Repro: Ray Delgado (w1), BluBranch's most socially active sim worker (posts, connections, vouches, trade all populated) → `GET /users/me/trade-card` → `"slug": null`.* If this holds for real signups, the entire Trade Card share feature is unreachable end-to-end, for everyone. (Oct 19)

### 🟠 Should-fix
4. **Notification lifecycle hit a new high-water mark for backlog.** Nina (w3): **19 unread**, spanning 13 days, including an 11-day-unread legitimate vouch request with no decline path. Hank's (e1) stale Oct-10 `connection_request` is now unread for **13 days, 6 consecutive sim-day checks (Oct 10/12/14/16/19/23) with zero change.** A fourth notification type (`daily_task`) was newly shown to pile up the same way — workers accumulate one per day forever with no way to tell "today's" from a week of backlog. *Repro: Nina (w3), `GET /notifications` → 19 unread.* (Oct 19, 23)
5. **QA/duplicate-account junk in `/network/suggestions` hit a new high: 90% on one account.** Trend: 60% (Oct 12/14) → 80% (Oct 16) → **90% (18 of 20, Oct 23)** for Nina (w3); w1 held at 70-75%. Climbing every week, no sign of stabilizing. *Repro: Nina (w3), `/network/suggestions` → 2 real accounts out of 20.* (Oct 23)
6. **The plumber trade is a compounding dead end, not a cosmetic seed gap.** A real plumber persona (Tommy, w2) hits **two independent dead features in sequence**: `GET /jobs?trade=plumber` → `total:0`, then `GET /jobs/pay-insights` (his own trade) → `insufficient:true, n:0`. First-open experience for anyone in that trade, not an edge case. (Oct 21)
7. **Location-blind `/jobs` reconfirmed with a stronger repro.** Explicit real coordinates + 25-mile radius (Nina/w3's actual Cleveland lat/lng) still returns `distanceMiles:null` and the same ~140-mile-away Columbus jobs — confirms the gap is in the geo pipeline itself, not just missing default coords. (Oct 21)
8. **`isFeatured` no-op reconfirmed with the cleanest single-variable repro yet.** Vic (e3) posted a job with only `isFeatured:true` set (no `boostFeaturedPlacement` field anywhere in the payload) → response shows both false. Nothing else in the payload could explain the result. (Oct 21)
9. **Malformed job id still returns a raw Prisma 500**, unauthenticated, leaking internals verbatim. Reconfirmed. (Oct 21)
10. **`pay-insights` trade-slug param still a no-op** — a string trade slug silently falls back to the caller's own default trade with no error. Reconfirmed. (Oct 21)
11. **`plan` still returns the internal tier slug, not a branded name** (`"pro"`/`"unlimited"` instead of Blu/Blu Max). Reconfirmed twice. (Oct 19, 21)
12. **Methodology risk, now fully realized: there is no "stranger" left in the 6-persona roster.** Every pair among the six personas has had at least one cross-network action run against it. The "can an outsider do X" scenario can no longer be tested at all without a deliberate fixture reset (decline/remove a connection, or add a 7th persona). (Oct 23)

### 🟡 Polish
- Duplicate `POST /jobs` listings from Oct 14 (the two "Sheet Metal Journeyman" postings) are still sitting undeduped a week later — residual evidence, not actively retested with a fresh double-submit this week.
- Duplicate `profile_nudge` notification spam **still not reproduced** (consistent with last week's "improved" reading — no code change observed, logged as not-currently-reproducible).
- `pay_highest` featured-tiebreak — attempted, inconclusive (no same-pay/different-featured fixture available this run); needs a day with the right pay spread.
- Not re-tested this week: read-receipt timing (#9 on last week's list, confirmed broken Oct 16, no fresh thread-reply check this week), silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene.

---

## 2. Regression scorecard vs. the 2026-10-18 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **STILL-BROKEN** — reconfirmed on a 6th pairing type (employer↔employer, zero relationship); now 4 runs, 6 pairing types, 0 gates |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN** — carryover; gate shape (`ProfileIncomplete`) confirmed stable/correct across all 3 workers |
| 3 | QA/duplicate account leakage (`/network/suggestions` + feed) | **STILL-BROKEN, worse** — new high-water mark of 90% junk (one account), up from 80% |
| 4 | Crew Post coauthor feed fan-out / missing `viewerCoauthorStatus` | **STILL-BROKEN** — reconfirmed on a brand-new fixture (Ray+Tommy crew post, Oct 19); not retested Oct 21/23 |
| 5 | Public profile `slug`/Trade Card share dead | **CONFIRMED** — escalated from "not-re-tested 3 weeks" to proven broken on a real, fully-active account |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **STILL-BROKEN, stronger repro** — explicit real coords + radius still ignored, not just missing defaults |
| 7 | Malformed job id → raw Prisma 500 | **STILL-BROKEN** — reconfirmed verbatim |
| 8 | Notification lifecycle drift (stale connection/vouch notifications) | **STILL-BROKEN, worse** — new high-water mark (19 unread on one account, 13-day-old stale item); extended to a 4th notification type (`daily_task`) |
| 9 | Read-receipt timing (reply/fetch doesn't mark read) | **NOT-RE-TESTED** — confirmed broken Oct 16, no fresh thread-reply check this week; assume still open |
| 10 | Stale vouch-confirmation notification | **NOT SEPARATELY RE-TESTED** — folded into the general lifecycle finding (#8); the specific "confirming doesn't resolve it" mechanism wasn't re-isolated this week |
| 11 | `isFeatured` silent no-op | **STILL-BROKEN** — cleanest single-variable repro yet |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — part of the #3 worsening trend (`Anthony Arnett` still duplicated) |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED / IMPROVED** — not reproduced again this week |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **NOT-RE-TESTED** — attempted, inconclusive (no forcing fixture this run) |
| 15 | `pay-insights` trade-slug param no-op | **STILL-BROKEN** — reconfirmed |
| 16 | No idempotency key on `POST /messages`/`POST /jobs` | **STILL-BROKEN (residual evidence)** — the Oct-14 duplicate job postings remain undeduped a week later; no fresh double-submit attempted |
| 17 | `plan` returns internal slug not branded name | **STILL-BROKEN** — reconfirmed twice this week |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **NOT-RE-TESTED** |
| 19 | Inconsistent id-field naming across routes | **NOT-RE-TESTED** |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED** |
| 21 | Zero job postings for plumber trade (new last week) | **STILL-BROKEN, worse** — escalated to a compounding two-feature dead end (jobs search AND pay-insights) |
| 22 | Out-of-network/"stranger" fixture collapse (methodology, flagged 3 weeks) | **NEW-THIS-WEEK (fully realized)** — every pair in the 6-persona roster now has a relationship; the scenario can no longer be tested without a deliberate reset |

**Tally: 0 fixed, 1 newly confirmed (slug/Trade Card, escalated from unconfirmed to proven broken), 14 still broken (4 trending worse: junk rate, notification backlog, plumber dead-end, geo repro strength), 1 improved/not-reproduced, 5 not re-tested, 1 methodology item fully realized.**

---

## 3. What worked well

- **Payments and subscriptions remain the most solid surface in the app.** Basic $19 one-time payment, full headless Stripe round trip, zero friction (Oct 21). Subscription renewal — now ~18 consecutive clean sim days since the Oct-5 webhook fix for both Blu (e2) and Blu Max (e3), both rolled to `currentPeriodEnd: 2026-11-15` with no manual re-pull.
- **Job-stats analytics are genuinely real-time, not batch-delayed.** A view on Vic's featured job incremented his `GET /jobs/:id/stats` time series within minutes, same calendar day (Oct 21).
- **Apply-readiness gate is consistent and clearly worded across every worker** — identical `ProfileIncomplete` shape, same two missing items (phone, photo), no drift (Oct 21).
- **Bookmarks remain mechanically solid**, including correctly retaining already-expired saved jobs rather than silently dropping them (Oct 21).
- **Crew post + coauthor accept flow is solid end-to-end** apart from the one known `viewerCoauthorStatus`/feed gap (Oct 19).
- **Cross-role engagement on the social feed is clean** — employers liking/commenting on worker posts, correct notification fan-out, no moderation false positives (Oct 19).
- **Toolbox Talk is correctly shared across every role** (including employers), consistent streak tracking (Oct 19).
- **Notification delivery mechanics (not lifecycle) remain completely solid** — `profile_view`, `connection_accepted`, `new_message`, `vouch_received` all fire instantly, correctly shaped, no missing fields, no duplicate side effects, every time, all week.
- **A week-old pending connection request, finally actioned, worked perfectly end-to-end** — Deb (e2) accepted Nina's 7-day-old request, correct status change, correct `connection_accepted` push within half a second (Oct 23). Realistic "busy user" delay, not a bug.
- **Cold DMs and cold connection requests continue to work exactly as designed** (intentionally ungated) — no friction, correct behavior, all week.

---

## 4. Experience contrasts

- **Worker vs. employer:** still severed by the Twilio apply-gate. Employers pay, post, see clean real-time dashboards/stats; workers browse, bookmark, and get blocked at apply with a consistent, well-worded 403 (phone + photo) — zero applications have ever completed in this sim. Employers' own surfaces (job posting, payments, stats) are the most reliable part of the whole product; workers' core loop (apply) is the most broken.
- **In-network (w1/w2) vs. out-of-network (w3):** moot as of this week — the fixture is **fully spent**. Every pair among all six personas now has some relationship. The one gate that should exist (cold vouch) remains open regardless, proven this week on the starkest possible pairing (two employers, zero relationship). Recommend a deliberate fixture reset before the next network-day run, or the "can a stranger break in" question can't be asked again.
- **Basic vs. Blu vs. Blu Max — did renewal work:** yes, again — both tiers renewed cleanly with zero manual intervention, now an 18-day clean streak. Tier gating (pay-per-post vs. publish-on-active-sub) continues to work exactly as designed. The tiers still look nearly identical in every feature exercised except the still-broken `isFeatured`/boost field and the still-unbranded `plan` string (`"pro"`/`"unlimited"` instead of Blu/Blu Max) — worth confirming a real buyer sees the $79→$139 value difference somewhere that isn't a bug report.

---

## 5. Recommended pre-launch punch list, ordered

1. **Gate vouches on an existing connection** — launch-blocker, now proven on 6 pairing types across 4 runs, including the starkest possible case (two strangers, no relationship of any kind).
2. **Move Twilio to paid** — launch-blocker, carryover; nothing closes the marketplace loop until this ships.
3. **Fix the notification lifecycle at the root**, not per-type — now spans 4 notification types (vouch, connection, message, daily_task) and hit a new backlog high-water mark (19 unread, 13 days stale) this week.
4. **Purge/filter QA and duplicate-name accounts** from `/network/suggestions` and the feed — now at a 90% junk high-water mark on one account; this is actively worsening, not stabilizing.
5. **Fix the `slug`/Trade Card dead-share bug** — newly confirmed broken on a real, fully-active account; blocks the entire Trade Card feature end-to-end. This just moved from "unconfirmed risk" to "confirmed and shipping broken."
6. **Fix Crew Post feed fan-out** (coauthors' own connections should see the post) + add `viewerCoauthorStatus` to the feed payload — reconfirmed on a fresh fixture this week.
7. **Decide the PostGIS story for prod** and fix worker-profile geocoding — this week's repro used real coordinates + radius, ruling out "just missing defaults" as the cause.
8. **Fix `isFeatured` as a silent no-op** — alias it to `boostFeaturedPlacement` or reject the wrong field name; this week's repro isolates it to a single field.
9. **Guard `GET /jobs/:id` against non-UUID input** — 400/404 instead of a raw Prisma 500.
10. **Seed job postings for missing trades** — plumber is now a confirmed two-feature dead end (jobs search + pay-insights), not just an empty tab. Also dedupe the week-old duplicate "Sheet Metal Journeyman" listing.
11. **Fix `pay-insights` trade-slug param no-op.**
12. **Rename `plan` to a branded tier string** (Blu/Blu Max) instead of the internal slug — reconfirmed twice this week, low effort, visible to every paying customer.
13. **Add duplicate-submit protection to `POST /jobs`/`POST /messages`** — the Oct-14 duplicate posting is still sitting undeduped a week later.
14. **Process fix, not code:** reset the sim's network fixture before the next network-day run (decline/remove a connection, or add a 7th persona) — the "stranger" scenario is now fully exhausted and cannot produce new findings without this.
15. **Re-verify `pay_highest` featured-tiebreak** with a deliberately engineered same-pay/different-featured pair — last two attempts were inconclusive for lack of the right fixture.
16. **Update `docs/SIM-TESTER-AGENTS.md`** — the apply-gate "known constraint" note is stale (confirmed again this week); document `ProfileIncomplete` as the current expected shape.
17. Polish sweep carryover (not re-tested, assume still open): read-receipt server-side fix, silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene.

*Next run: prioritize a deliberate network-fixture reset (item 14) before anything else in network territory — without it, every future cold-vouch/stranger test just reconfirms what's already proven six ways. Also worth a direct re-check of read-receipt timing (#9/10 above), which hasn't had a fresh look since Oct 16.*
