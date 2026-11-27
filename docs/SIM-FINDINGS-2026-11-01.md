# BluBranch pre-launch tester-agent simulation — weekly findings

**For:** Dayne + Balint · **Sim window:** Oct 26–30, 2026 (3 monitor runs: Mon/Wed/Fri) · **Compiled:** 2026-11-01
**Coverage:** 3 of 3 scheduled monitor runs, all present on `sim-logs` with no recovery needed (2026-10-26, 2026-10-28, 2026-10-30). Previous one-pager: `docs/SIM-FINDINGS-2026-10-25.md` (Oct 19–23 window).

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Cold vouch gate still wide open — reconfirmed on a verified-clean stranger pair, and the "we're out of strangers" excuse is retired.** *Repro: Tommy (w2) → Vic (e3), zero connection confirmed via `GET /connections` on both sides first → `POST /users/:id/vouch` with a fabricated company → `201`, instant `vouch_received` push, verbatim claim.* Five+ sim runs, 7+ pairing types, zero gates, ever. (Oct 30)
2. **Marketplace loop still never closes — Twilio gate blocks every apply, all three workers.** Carryover, unchanged. Gate shape (`403 ProfileIncomplete, missing:[phone,photo]`) reconfirmed stable/correct on all three workers, sitting on top of a verified-working 6-item readiness check. (Oct 28)

### 🟠 Should-fix
3. **Malformed-id → raw Prisma 500 is confirmed systemic, not a `/jobs/:id` quirk.** Found by accident guessing a `GET /companies/mine` convenience route — it path-matched into `GET /companies/:id` with zero UUID validation, same verbatim unauthenticated `P2023` leak as the long-standing jobs finding. Code read confirms the identical unguarded-`findUnique` pattern on both routes — any raw `:id` route is presumptively vulnerable. (Oct 28)
4. **Notification lifecycle hit a new high-water mark on every single day this week, under completely ordinary usage.** Nina (w3): 24→29→**31 unread**, oldest now **20 days** stale. Hank (e1): stale Oct-10 `connection_request` unread for **20 days, 9th consecutive sim-day check (Oct 10 through Oct 30) with zero change.** Vic (e3): his oldest unread message is now **~72 days** old, climbing in lockstep with elapsed time — mathematically proven to never auto-resolve. Two fabricated vouch notifications sit unconfirmed with **no decline path**, now 18 and 7 days. (Mon/Wed/Fri, every run)
5. **Read-receipt timing now precisely pinned down, not just suspected.** Same-session before/after repro: `GET /conversations/:id/messages` (simulating opening a thread) leaves `unreadCount` unchanged; only the explicit `PUT /conversations/:id/read` call — or sending a reply — clears it. A real client that doesn't fire that explicit call on thread-open will show messages as "read" in the UI while the API counts them unread forever. (Oct 30)
6. **Crew Post `viewerCoauthorStatus` missing from `/feed` — reconfirmed on a third independent fixture (Oct 12 → 19 → 26), still unfixed.** Same-session proof: `GET /posts/:id` for the coauthor correctly shows `viewerCoauthorStatus:"accepted"`; `GET /feed` for the identical post, seconds later, omits the key entirely while `coauthors` itself is present and correct — isolates it to one missing field in the feed serializer. (Oct 26)
7. **`isFeatured` confirmed as a hard field-name bug, not a flaky toggle.** Code read: `routes/jobs.ts` derives `isFeatured` solely from `data.boostFeaturedPlacement`, ignoring a client-sent `isFeatured` key entirely. Cleanest single-variable repro yet (Vic, e3). (Oct 28)
8. **`pay-insights` trade-slug param confirmed as a silent type-coercion bug.** Code-level cause: `Number("electrician")` → `NaN` → falsy → falls back to the caller's own trade with no error. (Oct 28)
9. **Location-blind `/jobs` confirmed as an infra decision, not a code bug.** Code read: the geo filter only runs when `isPostGisEnabled()` is true, and that flag is false on Railway's stock Postgres. Real Cleveland coordinates + 25-mile radius still return Columbus-only results with `distanceMiles:null` — working as coded, just never activated on staging. Reframes the punch-list ask from "find the bug" to "turn on PostGIS or officially drop the feature for launch." (Oct 28)
10. **Plumber trade remains a compounding two-feature dead end** — `GET /jobs?trade=plumber` → 0, `pay-insights` for plumber → `insufficient:true, n:0`. Unchanged for three straight weeks. (Oct 28)
11. **`/network/suggestions` junk holding at its worst-recorded ceiling** — Nina 90% (18/20), Ray 75% (15/20), including a new oddity: a duplicate-name entry with a literal trailing space in the name (`"Bob The builder "`). Not worsening this week, but not improving either. (Mon/Wed/Fri)
12. **`plan` still returns the internal tier slug** (`"pro"`/`"unlimited"`) instead of a branded Blu/Blu Max name. Reconfirmed again. (Oct 28)

### 🟡 Polish
- Duplicate "Sheet Metal Journeyman" postings from Oct 14 still sitting undeduped, now 2+ weeks old — residual evidence only, no fresh double-submit attempted this week.
- Vouch-pending backlog confirmed tracked independently of notification read-state (Deb/e2 has a clean 0-unread inbox but her `/vouches/pending` still shows a 14-day-old fabrication) — a second surface with the same underlying lifecycle gap.
- Not re-tested this week: Trade Card/`slug` dead-share bug (confirmed Oct 19, no reason to recheck this theme week), duplicate `profile_nudge` notifications, `pay_highest` featured-tiebreak, `PUT /settings/notifications` silent key-stripping, inconsistent id-field naming, job trade/title content hygiene.

---

## 2. Regression scorecard vs. the 2026-10-25 findings-doc watchlist

| # | Issue | This week's verdict |
|---|-------|----------------------|
| 1 | Cold vouch allowed (no connection required) | **STILL-BROKEN** — reconfirmed on a methodologically verified-clean stranger pair (Tommy→Vic); 5+ runs, 7+ pairing types, 0 gates |
| 2 | Marketplace loop never closes (Twilio gate) | **STILL-BROKEN** — carryover, reconfirmed stable on all 3 workers |
| 3 | QA/duplicate account leakage (`/network/suggestions` + feed) | **STILL-BROKEN** — holding at the worst-recorded ceiling (90% Nina / 75% Ray), not worsening further this week |
| 4 | Crew Post coauthor feed fan-out / missing `viewerCoauthorStatus` | **STILL-BROKEN** — reconfirmed on a 3rd independent fixture, cleanest same-session before/after repro yet |
| 5 | Public profile `slug`/Trade Card share dead | **NOT-RE-TESTED** — confirmed broken Oct 19, no reason to recheck this week's content/jobs/network themes; assume still open |
| 6 | Default `/jobs` feed location-blind (PostGIS) | **STILL-BROKEN — root cause now nailed in code.** Confirmed infra flag (`isPostGisEnabled()` false on staging), not a query bug |
| 7 | Malformed job id → raw Prisma 500 | **STILL-BROKEN, confirmed systemic** — identical bug found on `/companies/:id`; any raw `:id` route is now presumptively affected |
| 8 | Notification lifecycle drift (stale connection/vouch notifications) | **STILL-BROKEN, new high-water mark every single day this week** — 31 unread/20 days (Nina), 9th consecutive unchanged check (Hank), ~72-day message (Vic) |
| 9 | Read-receipt timing (reply/fetch doesn't mark read) | **STILL-BROKEN, now precisely isolated** — same-session proof that `GET` fetch never marks read, only the explicit `PUT .../read` does |
| 10 | Stale vouch-confirmation notification | **STILL-BROKEN, separately reconfirmed** — vouch-pending backlog shown to be tracked independently of notification read-state (Deb's case) |
| 11 | `isFeatured` silent no-op | **STILL-BROKEN, root cause confirmed in code** — hard field-name mismatch (`boostFeaturedPlacement` only), not flaky |
| 12 | Duplicate real-named accounts in search | **STILL-BROKEN** — part of #3, same accounts, same ceiling |
| 13 | Duplicate `profile_nudge` notifications | **NOT-RE-TESTED** |
| 14 | `pay_highest` featured-tiebreak, no visible flag | **NOT-RE-TESTED** |
| 15 | `pay-insights` trade-slug param no-op | **STILL-BROKEN, root cause confirmed in code** — `Number()` cast on a trade slug silently produces `NaN` |
| 16 | No idempotency key on `POST /messages`/`POST /jobs` | **NOT-RE-TESTED** — residual evidence only (Oct-14 duplicate posting still undeduped, 2+ weeks); no fresh double-submit attempted |
| 17 | `plan` returns internal slug not branded name | **STILL-BROKEN** — reconfirmed again |
| 18 | `PUT /settings/notifications` silently strips unknown keys | **NOT-RE-TESTED** |
| 19 | Inconsistent id-field naming across routes | **NOT-RE-TESTED** |
| 20 | Job trade/title mismatch (seed data) | **NOT-RE-TESTED** |
| 21 | Zero job postings for plumber trade | **STILL-BROKEN, unchanged** — same two-feature dead end, 3rd straight week |
| 22 | Out-of-network/"stranger" fixture collapse (methodology) | **RETRACTED — was never true.** Friday's run proved the Oct-23/25 "fixture exhausted" conclusion rested on misreading `vouch-context` (`null`/`null` only means "no vouch attempted," not "no connection exists"). A real `GET /connections` pull shows 9 of 15 pairs have never been connected, and Vic (e3) has zero connections to anyone — a genuine, unspent stranger against all five others. No fixture reset needed; future network-day runs should cross-check `GET /connections`, not `vouch-context` alone. |

**Tally: 0 fixed, 5 root-caused-in-code this week (malformed-id scope, PostGIS flag, `isFeatured` field mismatch, pay-insights `Number()` cast, read-receipt `GET`-vs-`PUT` isolation), 14 still broken (several worsening or hitting new highs: notification backlog, malformed-id route scope), 1 methodology item retracted as a false alarm, 6 not re-tested.**

---

## 3. What worked well

- **Payments and subscriptions remain the most solid surface in the app, fourth week running.** Basic $19 one-time payment via a full headless Stripe round trip, zero friction (Oct 28). Subscription renewal — 23 consecutive clean sim days as of Wednesday for both Blu (Deb) and Blu Max (Vic), both rolled to `currentPeriodEnd: 2026-11-15` with no manual re-pull (not re-checked Friday — outside that day's theme).
- **Apply-readiness gate is consistent and now verified to sit on a genuinely working 6-item check** — all three workers independently confirmed `satisfied:[headline,trade,location,experience]`, same two real gaps (phone, photo) every time (Oct 28).
- **Bookmarks remain mechanically solid**, correctly retaining already-expired saved jobs rather than dropping them (Oct 28).
- **Job-stats analytics pipeline is genuinely real-time** — a view on a featured listing showed up same-day in the time series (Oct 28).
- **Crew post + coauthor accept flow is solid end-to-end** apart from the one known feed-serializer gap (Oct 26).
- **Cross-role engagement on the social feed and Toolbox Talk remain clean and fully shared across every role**, including employers, with correct notification fan-out and no moderation false positives (Oct 26).
- **Legitimate in-network messaging is rock-solid, real-time, end to end** — a reply landed within the same second with correct notification shape and accurate unread count; the explicit read-marking endpoint works exactly as documented (Oct 30).
- **Cold DMs and cold connection requests continue to work exactly as designed** (intentionally ungated) — no friction, correct behavior, every week (Oct 30).
- **The connections API correctly rejects a duplicate connection request** with a clean `409 "Already connected"` rather than a silent no-op or duplicate row — caught incidentally during this week's methodology check (Oct 30).

---

## 4. Experience contrasts

- **Worker vs. employer:** unchanged — still severed by the Twilio apply-gate. Employers pay, post, and see clean real-time dashboards/stats; workers browse, bookmark, and get blocked at apply with a consistent, well-worded 403 — zero applications have ever completed in this sim, across every week recorded.
- **In-network (w1/w2) vs. out-of-network (w3) — correction from last week:** the "fixture exhausted" conclusion carried in the last two findings docs was wrong. There are real, verified strangers left (9 of 15 pairs, and Vic/e3 specifically has zero connections to anyone). The cold-vouch gate remains open regardless of which stranger pair is used — this week's repro used a methodologically bulletproof pair (verified via `GET /connections`, not just `vouch-context`).
- **Basic vs. Blu vs. Blu Max — did renewal work:** last confirmed Wednesday — yes, both tiers clean, 23-day streak, no manual intervention (not independently re-checked Friday). Tier gating (pay-per-post vs. publish-on-active-sub) continues to work as designed. The tiers are still functionally indistinguishable in every feature exercised beyond price, apart from the still-broken `isFeatured` boost field and the still-unbranded `plan` string.

---

## 5. Recommended pre-launch punch list, ordered

1. **Gate vouches on an existing connection** — launch-blocker, now reconfirmed on a methodologically bulletproof stranger pair; the single highest-confidence finding in the whole sim.
2. **Move Twilio to paid** — launch-blocker, carryover; nothing closes the marketplace loop until this ships.
3. **Guard every raw `:id` route against malformed input**, not just `/jobs/:id` — now confirmed systemic (`/companies/:id` has the identical unauthenticated Prisma-internals leak); audit all `:id`-param routes as one pass, not a one-off patch.
4. **Fix the notification lifecycle at the root** — now hit a new high-water mark on every single day this week under ordinary usage, spans notifications and the separately-tracked vouch-pending queue; this is the most reliably-reproducing issue in the sim.
5. **Fix the read-receipt mechanism** — now precisely isolated: have the client call the explicit read endpoint on thread-open (or have the server mark-read on fetch), since the current behavior silently under-counts "read" messages forever.
6. **Fix Crew Post feed fan-out** (add `viewerCoauthorStatus` to the `/feed` payload) — reconfirmed on a third independent fixture; isolated to a single missing serializer field, should be a small fix.
7. **Fix `isFeatured` as a field-name mismatch** — accept `isFeatured` or alias it to `boostFeaturedPlacement`; root cause is now a known one-line read in `routes/jobs.ts`.
8. **Fix `pay-insights` trade-slug param** — reject or properly parse a slug instead of silently `NaN`-ing into the caller's own trade.
9. **Decide the PostGIS story for prod** — now confirmed as an infra/config flag (`isPostGisEnabled()`), not a bug hunt: either provision PostGIS for launch or explicitly scope geo-search out of v1.
10. **Rename `plan` to a branded tier string** (Blu/Blu Max) — low effort, visible to every paying customer, reconfirmed every week.
11. **Purge/filter QA and duplicate-name accounts** from `/network/suggestions` and feed — holding at a 75–90% junk ceiling; not worsening but needs an actual cleanup pass, including the newly-spotted trailing-space duplicate.
12. **Seed job postings for missing trades** (plumber confirmed dead for 3 straight weeks) and dedupe the 2+-week-old duplicate "Sheet Metal Journeyman" listing.
13. **Add duplicate-submit protection to `POST /jobs`/`POST /messages`** — not retested this week; the Oct-14 duplicate is still sitting there as residual evidence.
14. **Update `docs/SIM-TESTER-AGENTS.md` / sim methodology:** retire the "out-of-network fixture exhausted" guidance — it was based on misreading `vouch-context`. Document that `GET /connections` is the correct check for "is this pair a stranger," not `vouch-context` nulls.
15. **Re-verify `pay_highest` featured-tiebreak** and duplicate `profile_nudge` notifications — neither retested in several weeks; schedule a dedicated pass.
16. Polish sweep carryover (not re-tested, assume still open): silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene, the `slug`/Trade Card dead-share bug (last confirmed Oct 19 — worth one direct re-check since it's been two weeks).

*Next run: with the "fixture exhausted" false alarm retired, Friday's network-day run has 9 untested stranger pairs available (w1-e2, w1-e3, w2-e1, w2-e2, w3-e3, e1-e2, e2-e3, plus re-confirmable Nina/w3-Hank/e1 if ever disconnected) — worth using one to re-verify the cold-vouch gate stays broken under yet another pairing shape, and one to probe whether a genuinely-zero-connection account (Vic/e3) behaves differently as the *target* of other inbound actions (connection requests, DMs) than as the actor.*
