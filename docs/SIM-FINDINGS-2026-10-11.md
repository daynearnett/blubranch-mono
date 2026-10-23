# BluBranch pre-launch tester-agent simulation v3 — findings

**For:** Dayne + Balint · **Sim window:** Oct 5–10, 2026 (6 days, returning-user week) · **Compiled:** 2026-10-11
**Coverage:** 6 of 6 themed days — all ran, all logs live on `sim-logs` (push access confirmed working this run, nothing had to be recovered from session transcripts). A Day-0 warmup (Oct 4) also ran a day early and is folded in where relevant.

---

## 1. Top findings this week, ranked by severity

### 🔴 Launch-blocker
1. **Vouches have no gate at all — a total stranger can fabricate a "worked together" credential.** `POST /users/:id/vouch` succeeds even with zero connection, zero shared work history, and a made-up company name. Confirmed twice on two different clean targets (Oct 8, Oct 10) to rule out stale data. *Repro: w3 (Nina) → random worker she's never met → `201`, pending vouch created with `companyName: "Totally Made Up Co"`.* This is the core of the "peer credibility" pitch and it's wide open.
2. **The marketplace loop still produces zero applications end-to-end (carryover, unresolved).** Every worker still hits `403 PhoneVerificationRequired` on apply — Twilio is still on trial. Not re-flagged as new because it's expected/documented, but it means the two-sided loop never closed once, all week. *Fix: move Twilio to paid before any external beta.*

### 🟠 Should-fix
3. **Test/QA account leakage is worse than Aug, and now hits two surfaces, not one.** `/network/suggestions` junk rate climbed from 11/20 (Oct 4) to 14/20 (Oct 5) to 12/20 (Oct 10), plus a duplicate "Anthony Arnett" under two different ids. New this week: the same junk now pollutes the main social **feed** fallback for sparse-network accounts (14 of 17 posts were QA/founder content for e2/e3) — that's the literal first screen a new beta user sees.
4. **Crew Post doesn't reach a coauthor's own network.** The feed filter checks only the primary author against your connections, never `coauthors` — so tagging a buddy on a joint job doesn't get it in front of *his* connections. Compounding bug: `GET /feed` also drops `viewerCoauthorStatus` entirely (present on the single-post view), so the accept/decline banner may never render if mobile reads off the feed payload. (Oct 6)
5. **Public profile sharing is dead — `slug` is `null` on every account we checked**, including fully-built profiles active since August. Both `/u/:slug` and the Trade Card's `/share/card/:slug` can't resolve. Unconfirmed whether this is a sim-account artifact or hits real signups too — if real signups also come back slug-less, **escalate to launch-blocker** (the Trade Card share feature, called out in CLAUDE.md as shipped, would be silently non-functional for everyone). (Oct 8)
6. **The default `/jobs` feed is location-blind, and we now know exactly why.** PostGIS is disabled on staging, so `useGeo` silently no-ops with zero signal to the client (`distanceMiles: null`, radius param accepted but ignored). Separately, w3's own worker profile was **never geocoded** (`lat/lng: null`) — so even a working radius filter would have nothing to search from. Two stacked bugs, one visible symptom. **If prod also lacks PostGIS, every "near you" promise in the mockups is cosmetic — verify before launch messaging leans on it.** (Oct 7, root-caused Oct 10)
7. **A malformed job id returns a raw Prisma 500 with internal error text, unauthenticated.** `GET /jobs/not-a-real-id` → full `P2023` stack-flavored error leaked to the client. No UUID-shape guard before hitting Prisma. Reproduces on any stale deep link or client typo. (Oct 9, reconfirmed Oct 10)
8. **Notifications routinely drift out of sync with reality**, in three separate ways: (a) a 51-day-old pending connection request sat unactioned with zero re-nudge (Oct 8); (b) a `connection_request` notification stayed unread/stale for an already-*accepted* connection — tapping it two months later would hit a dead end (Oct 8); (c) `daily_task`/`profile_nudge` noise is piling up undeduped and un-expiring — w1 hit 20 unread, w3 hit 19, more than half pure nudge spam, burying the one `new_message`/`job_match` that actually mattered (Oct 5, worse by Oct 9–10).
9. **Replying in a thread doesn't mark the other person's earlier message read** — only a dedicated `PUT /conversations/:id/read` call does that, and nothing calls it on reply or on fetch. Unread badges can stay lit indefinitely for threads you've actually engaged with. Needs a mobile-client check: does it fire the read call on thread-open? (Oct 9)
10. **`isFeatured` on job creation is a confirmed, repeatable silent no-op** (seen Oct 4 and Oct 5, both employer accounts) — the real field is `boostFeaturedPlacement`; the output's own field name isn't accepted on input, and nothing errors.
11. **Silent duplicate accounts under the real persona names**, not just obviously-fake QA names: two "Ray Delgado" and two "Nina Kowalski" show up in people-search, one real + one blank each. A real user can't tell which result is them. (Oct 7)
12. **Duplicate, undeduped `profile_nudge` notifications** — w3 carried 5 identical unread copies all week with no cleanup. (Oct 5, unchanged through Oct 6)

### 🟡 Polish
13. `sort=pay_highest` isn't actually a logic bug — root cause pinned Oct 10: the ORDER BY correctly applies `is_featured DESC, pay_max DESC` (same tiebreak as "nearest"/"newest"), but the payload gives the client zero visual cue (no obvious "Featured" flag) for why a lower number sits on top. Recommend exempting pay-sort from the featured bump, or surfacing the badge clearly.
14. `plan` field returns the internal slug (`pro`/`unlimited`), not the branded tier name (Blu/Blu Max) — a billing screen that renders it raw would show the wrong name. (Oct 9)
15. `PUT /settings/notifications` silently strips unrecognized keys — a typo'd preference key (`notifyMesages`) returns `200` with nothing changed, no error. (Oct 9)
16. No idempotency key on `POST /messages` — found a byte-for-byte duplicate message 18 seconds apart in one thread, consistent with an unprotected client retry. (Oct 10)
17. Inconsistent target-field naming across routes (`receiverId` vs `voucheeId` vs the natural guess `recipientId`) — not user-facing, but a recurring mobile-client gotcha. (Oct 10)
18. Job trade/title mismatch on a live posting ("Concrete Finisher" tagged `Welder`) — looks like seed-data mislabeling, not a wizard bug. (Oct 7)
19. `pay-insights` silently ignores a `trade` slug param and returns the caller's own trade's numbers instead — only `tradeId` (numeric) works. (Oct 7)

---

## 2. Regression scorecard vs the 7 Aug issues

| # | Aug issue | This week's verdict | Notes |
|---|-----------|---------------------|-------|
| 1 | Empty-JSON-body 400 on no-body mutations | **FIXED** | Closed out Oct 8 — all three originally-named routes (`posts/:id/like`, `connections/:id/accept`, `payments/jobs/:id/intent`) clean, plus it extends to `conversations/:id/read` (Oct 9). Held through Oct 10's full regression pass. |
| 2 | `sort=pay_highest` wrong order | **STILL BROKEN (as experienced)** — downgraded from logic bug to UX gap | Root cause found Oct 10: the sort math is correct, it's a `is_featured DESC` tiebreak with no visible "Featured" flag in the payload. Worker still sees a lower number on top with no explanation. |
| 3 | `pay-insights` always `insufficient` | **FIXED** | Staging now has enough seeded postings per trade to clear the `n≥3` floor; the floor logic itself was always correct — confirmed it still correctly returns `insufficient:true` for a genuinely sparse trade (n=1). |
| 4 | Test/QA accounts leak into `/network/suggestions` | **STILL BROKEN — worse** | Junk rate climbed across the week (11/20 → 14/20 → 12/20 with new duplicate accounts appearing); now also confirmed leaking into the main feed fallback, a second, more visible surface. |
| 5 | Out-of-network cold vouch allowed | **STILL BROKEN — confirmed LAUNCH-BLOCKER, worse than originally scoped** | Aug's framing was "no shared workplace required." This week proved it's worse: no connection of any kind is required either. Reconfirmed on two separate clean targets (Oct 8, Oct 10). |
| 6 | Stale "confirm your vouch" notification after confirmation | **NOT RE-TESTED (no reproducible pair)** | None of the six personas held a genuinely pending vouch to probe this week. A close cousin bug was found instead — stale, unread `connection_request` notifications for already-accepted connections (Oct 8) — same pattern, different object. Needs a fresh fixture next run. |
| 7 | Default `/jobs` feed not location-aware | **STILL BROKEN — root cause now pinned** | Two stacked causes: PostGIS disabled on staging (silent no-op, zero client signal) **and** w3's worker profile was never geocoded (`lat/lng: null`). Fixing one without the other won't fully resolve it for her. |

**Tally: 2 of 7 fixed, 1 downgraded to UX gap (not fixed), 3 still fully broken (one now confirmed worse), 1 untestable this week.**

---

## 3. What worked well

- **Payments, full week, zero regressions.** Basic $19 one-time flow ran clean end-to-end twice (Oct 5, Oct 10) on real Stripe test-mode rails. Blu/Blu Max subscriptions stayed `active` with the correct `currentPeriodEnd` (Oct 15) for **six straight days** with zero manual `/confirm` needed — the Stripe webhook fix shipped right before this week (2026-10-05, per CLAUDE.md) is holding. No employer ever needed to actually re-subscribe; the "lapsed" subscriptions from the brief were never really lapsed, just a stale cache the webhook fix now prevents.
- **Real-time messaging + notification delivery is solid.** Every message sent (in both directions, connected and cold) produced an immediate, correctly-shaped `new_message` notification — no missing fields, no delay, across both in-network and cross-network sends.
- **Crew Post mechanics (minus the feed fan-out bug above) work correctly**: create with coauthors, invite, accept, likes/comments, dual-author display.
- **Bookmarking, Toolbox Talk, and the SMS apply-gate all behave consistently and cleanly** — the apply-gate in particular never creates a ghost application on its 403, and the error shape is clean every time it's hit.
- **The empty-body 400 fix (issue #1) is the first confirmed fix to ship against the known-issues list since the Aug run** — a genuine, verified regression-list win.

---

## 4. Experience contrasts

- **Worker vs. employer:** still severed by the same Twilio gate — employers can pay, post, and see dashboards; workers can browse, bookmark, and get blocked at apply. Fixing Twilio is the one change that reconnects the two halves.
- **In-network (w1/w2) vs. out-of-network (w3):** the network stayed more permeable than it should be. w3 started the week with one lingering pending connection and ended it mutually connected to both other workers — not from a bug, just normal accept flow, but it means "out-of-network" as a label drifted over the week. The one hard gate that should exist (no-connection vouching) still doesn't. Cold DMs and cold connection requests work by design; cold vouches should not work and do.
- **Basic vs. Blu vs. Blu Max, and did re-subscribe work:** no employer actually needed to re-subscribe this week — both Blu and Blu Max stayed `active` the whole time, correct renewal date, thanks to the pre-week webhook fix. Functionally the three tiers behaved exactly as gated (Basic = pay-per-post with Stripe PaymentIntent, Blu/Blu Max = publish-on-active-sub, no charge). Blu vs. Blu Max still look functionally identical in everything exercised this week except the `isFeatured`/boost field (which doesn't even work reliably right now — see finding #10) — still worth confirming the $79 vs. $139 gap earns its price in a feature a worker/employer can actually see.

---

## 5. Recommended pre-launch punch list, ordered

1. **Gate vouches on an existing connection** (or equivalent real signal) before `POST /users/:id/vouch` succeeds. *(launch-blocker)*
2. **Move Twilio to paid** so applications can flow at all. *(launch-blocker, carryover)*
3. **Confirm whether real signups get a `slug`** (Trade Card/public profile share is dead on every sim account); fix slug generation if it's broken for everyone, not just these test accounts. *(should-fix, escalate if confirmed universal)*
4. **Decide the PostGIS story for prod** and fix worker-profile geocoding — "near you" is currently cosmetic on staging for any ungeocoded profile. *(should-fix, launch-relevant messaging risk)*
5. **Purge/filter test & QA accounts** from both `/network/suggestions` and the feed fallback — it's getting worse week over week, not better. *(should-fix)*
6. **Fix Crew Post feed fan-out** (coauthors' own connections should see the post) and add `viewerCoauthorStatus` to the feed payload. *(should-fix)*
7. **Guard `GET /jobs/:id` against non-UUID input** — return 404/400 instead of a raw Prisma 500 leaking internals. *(should-fix)*
8. **Fix the notification lifecycle**: dedupe `profile_nudge`, auto-expire or visually separate `daily_task`/`profile_nudge` noise, and make stale connection/vouch notifications reflect resolved state. *(should-fix)*
9. **Verify the mobile client's read-receipt timing** for messages (mark-read on thread-open, not just on reply). *(should-fix)*
10. **Fix `isFeatured` as a silent no-op** on job creation — accept it as an alias for `boostFeaturedPlacement` or 400 on it. *(should-fix)*
11. **Clean up duplicate accounts under real persona names** (not just obvious QA names) polluting people-search. *(should-fix)*
12. **Exempt `pay_highest` from the featured-pin tiebreak, or surface a visible "Featured" badge** so the override reads as intentional. *(polish, but visible)*
13. Polish sweep: `plan`-slug vs. branded-tier mismatch, message send idempotency, silent unknown-settings-key acceptance, inconsistent id-field naming, job trade/title content hygiene, `pay-insights` trade-slug no-op.

*Next run: seed a fresh pending vouch early in the week so issue #6 can actually be re-tested — it was untestable this time because no persona held one.*
