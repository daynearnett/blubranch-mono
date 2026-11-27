# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Oct 12–16, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-10-18
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-10-12, 2026-10-14, 2026-10-16). Previous one-pager: `docs/SIM-FINDINGS-2026-10-11.md` (Oct 5–10 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Cold vouch gate still completely absent — now proven across 4 distinct pairing types in 3 straight sim runs.** `POST /users/:id/vouch` succeeds with zero connection and a company name that says outright it's fabricated. This week added worker→employer against **both** e3 (Oct 12, "Never Worked Here Inc") and e2 (Oct 16, "...Sim fabrication, never worked here)") — on top of the worker→worker case from last week. *Repro: w3 (Nina) → Deb Castillo (e2), no connection → `201`, pending vouch + instant push notification to the victim.*
2. **Marketplace loop still never closes — Twilio gate blocks every apply, all three workers, all week.** Carryover, unchanged. New wrinkle (not a new blocker, but worth knowing): the gate now also reports missing profile photos (`403 ProfileIncomplete, missing:[phone,photo]`) rather than the documented phone-only `PhoneVerificationRequired` — the richer gate is working as designed, but it means **the sim protocol doc's "known constraint" note is now stale** and should be corrected before it's mistaken for a regression.

### 🟠 Should-fix
3. **Notification lifecycle confirmed structurally broken — "nothing resolves a notification except the one action that created it, ever."** Three independent proofs this week: (a) the stale post-vouch-confirmation notification, previously untestable, was reproduced **twice on demand** (Oct 12: Ray→Nina; Oct 16: Hank→Tommy — first time on a worker↔employer vouch direction); (b) the e1↔Nina stale `connection_request` is now **unresolved for 4 consecutive sim days** (Oct 10/12/14/16, same notification id); (c) new this week — a `new_message` notification on Deb's (e2) account dated **2026-08-19**, still unread **~58 days** later. Same root cause across 3 notification types.
4. **QA/duplicate account leakage in `/network/suggestions` is trending worse, not better.** 60% junk (Oct 12/14) → **80% junk (16 of 20) by Oct 16**, plus `Anthony Arnett` now triplicated. Climbing week over week.
5. **Crew Post feed fan-out bug reconfirmed verbatim twice** (Oct 12, Oct 16) — `viewerCoauthorStatus` present on `GET /posts/:id` but absent from `GET /feed`. The "coauthor's own disjoint network" half of this bug remains **untestable** for the second run running — the sim's worker trio is now fully interconnected with no fixture left to prove it.
6. **Read-receipt gap upgraded from "needs a client check" to a confirmed server-side defect.** Directly tested Oct 16: replying in a thread, and separately fetching its messages, both leave `unreadCount` and `readAt` untouched. Only the explicit `PUT /conversations/:id/read` clears it — the API gives the client no other path. If mobile doesn't fire that exact call on thread-open, unread badges persist forever.
7. **Location-blind `/jobs` reconfirmed on 3 independent accounts** (Oct 14) — `distanceMiles:null` regardless of params, unchanged root cause (PostGIS disabled + ungeocoded profiles).
8. **New: `POST /jobs` has the same double-submit gap as the known `POST /messages` issue.** Two identical "Sheet Metal Journeyman" postings (same employer, same pay, 9 seconds apart) found Oct 14 — no idempotency protection on job creation either.
9. **`isFeatured` no-op reconfirmed with a clean side-by-side contrast** (Oct 14): same employer, one job posted with `isFeatured:true` (silently ignored) and one with the correct `boostFeaturedPlacement:true` (worked) — pins this squarely as a field-name mismatch, not a general bug.
10. **Malformed job id still returns a raw Prisma 500** leaking internals, unauthenticated — reconfirmed Oct 14.
11. **`pay_highest` featured-tiebreak reconfirmed with live dollar figures** (Oct 14): a $38/hr featured job outranks $44/hr and $42/hr non-featured jobs with zero "Featured" flag on the payload to explain why.
12. **`pay-insights` trade-slug param still a no-op** — reconfirmed Oct 14 (only numeric `tradeId` works).
13. **New: an entire trade (plumber) has zero job postings on staging.** Tommy's `GET /jobs?trade=plumber` → `total:0`. Not a code bug — a seed-data gap that would show a real plumber a permanently empty Jobs tab.
14. **Methodology risk: the sim's "out-of-network stranger" fixture has collapsed.** w3 is now mutually connected to all three other workers *and* Hank (e1); only e2/e3 remain untouched. Flagged last week too — it's worse this week, not resolved. Threatens the validity of every future "can an outsider do X" test.

### 🟡 Polish
- Duplicate real-named accounts (`Anthony Arnett` x3) unchanged — incidentally reconfirmed via the #4 junk-rate checks.
- `profile_nudge` duplicate-notification spam **not reproduced this week** (down from 19–20 unread Oct 5–10 to single digits) — a positive signal, but no code change observed, so logged as "not currently reproducible," not "fixed."
- Not re-tested this week (outside the three day-themes): public-profile `slug`/Trade Card share dead (#5 from last week — **3 weeks running with no fresh check**, recommend prioritizing next run), `plan` internal-slug vs branded name, silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene.

---

## 2. Regression scorecard vs. the 2026-10-11 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **STILL-BROKEN** — reconfirmed 2 more times (worker→e2, worker→e3), now 4 pairing types across 3 runs total |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN** — carryover; gate shape evolved (ProfileIncomplete), doc now stale, not a new blocker |
| 3 | QA/duplicate account leakage (`/network/suggestions` + feed) | **STILL-BROKEN, worse** — 60% (Oct 12/14) → 80% (Oct 16) |
| 4 | Crew Post coauthor feed fan-out / missing `viewerCoauthorStatus` | **STILL-BROKEN** — reconfirmed verbatim twice; one half untestable (fixture gap) |
| 5 | Public profile `slug`/Trade Card share dead | **NOT-RE-TESTED** — only incidentally touched (confirmed exact field location, not resolution) |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **STILL-BROKEN** — reconfirmed on 3 accounts, unchanged root cause |
| 7 | Malformed job id → raw Prisma 500 | **STILL-BROKEN** — reconfirmed verbatim |
| 8 | Notification lifecycle drift (stale connection/vouch notifications) | **STILL-BROKEN, worse** — e1↔Nina notification now 4 consecutive days unresolved; new `new_message` instance at ~58 days old |
| 9 | Read-receipt timing (reply/fetch doesn't mark read) | **CONFIRMED** — escalated from "needs mobile check" to a proven server-side gap |
| 10 | Stale vouch-confirmation notification | **CONFIRMED (newly reproducible)** — untestable last week, reproduced twice this week on fresh fixtures |
| 11 | `isFeatured` silent no-op | **STILL-BROKEN** — reconfirmed with a clean isolating contrast test |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — unchanged (`Anthony Arnett` x3) |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED / IMPROVED** — not reproduced this week, no confirmed cause |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **STILL-BROKEN** — reconfirmed with live $-figures |
| 15 | `pay-insights` trade-slug param no-op | **STILL-BROKEN** — reconfirmed |
| 16 | No idempotency key on `POST /messages` | **NOT-RE-TESTED** — but a sibling gap confirmed on `POST /jobs` (see new findings) |
| 17 | `plan` returns internal slug not branded name | **NOT-RE-TESTED** |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **NOT-RE-TESTED** |
| 19 | Inconsistent id-field naming across routes | **NOT-RE-TESTED** |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED** |

**New this week:** duplicate job posting / no `POST /jobs` idempotency protection; zero job postings for the plumber trade; sim "out-of-network" fixture has fully collapsed (methodology risk, not a product bug).

**Tally: 0 fixed, 2 newly confirmed (were untestable/unconfirmed last week, now proven broken), 10 still broken (3 trending worse), 1 improved/not-reproduced, 6 not re-tested.**

---

## 3. What worked well

- **Subscription renewal confirmed working for the first time.** Blu and Blu Max both rolled `currentPeriodEnd` forward automatically from 2026-10-15 to **2026-11-15** with zero manual `/confirm` — the first real renewal cycle this sim has caught, not just "still active." 11 straight clean sim days on the 2026-10-05 webhook fix.
- **Basic $19 one-time payment** — full, unassisted real Stripe test-mode round trip, zero friction (Oct 14).
- **Vouch mechanics, minus the missing gate, are mechanically solid**: create → notify → pending → confirm → correct public-profile display, both directions, every time.
- **Cold DMs and cold connection requests work exactly as designed** (intentionally ungated) — no friction, correct behavior.
- **Social/content surface is clean across roles**: posting, crew posts, likes, comments, Toolbox Talk all worked with no new bugs, including cross-role engagement (employers liking/commenting on worker posts).
- **Apply-readiness gate behaves exactly as designed**, correctly escalating from the legacy phone-only error to the richer `ProfileIncomplete` shape.
- **Notifications fire instantly and correctly-shaped** for every live action tested (profile view, connection request, message, vouch) — the gap is only in how they're ever resolved afterward, never in delivery.

---

## 4. Experience contrasts

- **Worker vs. employer:** still severed by the same gate. Employers pay, post, and see clean dashboards/stats; workers browse, bookmark, and get blocked at apply — now for two stacked reasons (phone + photo) instead of one, but the practical effect (zero applications ever complete) is unchanged.
- **In-network (w1/w2) vs. out-of-network (w3):** the fixture has **fully collapsed** this week — w3 is mutually connected to all three workers and now e1 too, leaving only e2/e3 as genuinely untouched targets. The one gate that should exist (cold vouch) is still open regardless of who's tested against; recommend deliberately resetting the connection graph before the next network-day run.
- **Basic vs. Blu vs. Blu Max — did renewal work:** yes, confirmed for the first time this week (see §3). Functional tier gating (pay-per-post vs. publish-on-active-sub) continues to work exactly as designed. The tiers still look nearly identical in every feature exercised except the broken `isFeatured`/boost field — still worth confirming the $79→$139 jump is visible to a real buyer in something other than a bug.

---

## 5. Recommended pre-launch punch list, ordered

1. **Gate vouches on an existing connection** — launch-blocker, now proven on 4 pairing types across 3 runs.
2. **Move Twilio to paid** — launch-blocker, carryover; nothing closes the marketplace loop until this ships.
3. **Fix the notification lifecycle at the root**, not per-type — proven this week to span vouches, connections, and messages (one object with no resolution/expiry beyond its own creation).
4. **Purge/filter QA and duplicate-name accounts** from `/network/suggestions` and the feed — trend is actively worsening (60%→80% in one week).
5. **Fix Crew Post feed fan-out** (coauthors' own connections should see the post) + add `viewerCoauthorStatus` to the feed payload.
6. **Fix read-receipts server-side** (or confirm the mobile client reliably calls `PUT /conversations/:id/read` on thread-open) — now a confirmed gap, not a guess.
7. **Decide the PostGIS story for prod** and fix worker-profile geocoding.
8. **Add duplicate-submit protection to `POST /jobs`** (new finding) and **`POST /messages`** (carryover) — same root cause class.
9. **Fix `isFeatured` as a silent no-op** — alias it to `boostFeaturedPlacement` or reject the wrong field name.
10. **Guard `GET /jobs/:id` against non-UUID input** — 400/404 instead of a raw Prisma 500.
11. **Re-check whether real signups get a `slug`** — unconfirmed for 3 weeks running; this blocks the Trade Card/public-profile share feature entirely if it's universal. Prioritize next run.
12. **Exempt `pay_highest` from the featured-pin tiebreak, or surface a visible "Featured" badge.**
13. **Fix `pay-insights` trade-slug param no-op.**
14. **Seed job postings for missing trades** (plumber = 0 postings) and **dedupe the duplicate Sheet Metal Journeyman listing.**
15. **Process fix, not code:** reset the sim's out-of-network fixture (hold one worker back, stop e1/e2/e3 auto-accepting) so the "stranger breaks in" scenario stays testable.
16. **Update `docs/SIM-TESTER-AGENTS.md`** — the apply-gate "known constraint" note is stale; document `ProfileIncomplete` as the current expected shape.
17. Polish sweep carryover (not re-tested, assume still open): `plan`-slug vs. branded-tier name, silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene.

*Next run: use the next network-day to deliberately re-seed a disconnected "stranger" fixture, and spend one check specifically re-confirming the `slug`/Trade Card status — it hasn't had a direct look in 3 weeks.*
