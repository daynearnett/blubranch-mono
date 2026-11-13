# BluBranch pre-launch tester-agent simulation v2 — findings

**For:** Dayne + Balint · **Sim window:** Aug 15–20, 2026 (6 days) · **Compiled:** 2026-10-04
**Coverage:** 6 of 6 days — all ran; full per-day logs in [`sim-logs/`](../sim-logs/).

> **Provenance:** all six daily runs fired on schedule and tested staging, but every `git push`
> 403'd because the Claude GitHub App was never installed on the `daynearnett` account (fixed
> 2026-10-04). The day logs on this branch were recovered from the six run transcripts after the
> fix; the verbatim originals also live on each run page (linked in the day-log headers). This
> one-pager replaces the Aug-21 summarizer's draft, which wrongly concluded the data was
> unrecoverable — it wasn't; the summarizer just couldn't enumerate trigger-fired sessions.

All six `+sim2-*` accounts (3 workers, 3 employers) were stable all week — no login failures.

---

## Top findings by severity

### 🔴 Launch-blocker
1. **The marketplace loop produces zero applications end-to-end.** Every worker hits
   403 `PhoneVerificationRequired` on apply, so every employer dashboard (all three tiers) shows
   **0 applicants** all week. Cause is the known **Twilio trial** (SMS only to verified numbers) —
   but the effect is that the core two-sided loop never closes. *Repro:* any worker →
   `POST /jobs/:id/apply` → 403. **Fix: move Twilio to paid before any external beta.**

### 🟠 Should-fix
2. **Empty-JSON-body endpoints 400 on device-shaped calls.** `PUT /connections/:id/accept`,
   `POST /payments/jobs/:id/intent`, and `POST /posts/:id/like` return 400
   `FST_ERR_CTP_EMPTY_JSON_BODY` with an `application/json` header + empty body; they work with `{}`.
   *If the shipped mobile client sends empty bodies, accept-connection / pay-for-post / like are
   broken on device — verify the client, or make the server tolerate empty bodies.* (w1/e1, Days 2/6)
3. **Test/QA accounts leak into "People You May Know."** Real users see "Testy Test", "Cmp Probe"
   (×6), "Verify Owner", "Dayne Arnett", "Balint Gal", etc. in `/network/suggestions`. Data hygiene
   before beta. (w1/w3, Days 1/4/6)
4. **`sort=pay_highest` is wrong** — a $1000 posting sorted last, not first. (Day 6)
5. **`pay-insights` ("What's it paying?") always returns "insufficient"** — the n≥5-postings floor is
   never met at current volume, so the feature shows nothing to anyone. Needs a lower floor or a real
   empty-state for launch markets. (Days 3/6)
6. **Default job feed isn't location-aware** — Columbus OH workers see Chicago/Evanston IL jobs
   first; `location` is null on every listing. (Days 3/6)
7. **Stale "confirm your vouch" notification dead-ends the user** — persists after the vouch is
   already confirmed; `/vouches/pending` is empty. (w2, Day 5)
8. **Cold vouches are allowed** — an out-of-network stranger created a "worked together at <company>"
   vouch for someone they've never worked with (shared-history only pre-fills, never gates). Worth
   revisiting for a credibility feature. (w3, Day 4)

### 🟡 Polish
9. **Toolbox Talk is one global daily question**, not trade-personalized — a plumber and an HVAC tech
   both got an electrical GFCI question. (Day 6)
10. **No experience bucket for exactly "10 years"** — enum jumps `years_6_10` → `years_11_15`. (Day 1)
11. **Trade Card `slug` stays null** at 60% completeness, so `/share/card/:slug` can't be formed. (Day 1)
12. **`/vouches/pending` returns a bare array** instead of the `{vouches:[...]}` envelope other list
    endpoints use. (Day 5)
13. **Employers get/set worker-only `notifyJobMatch`** in notification prefs — no role filtering. (Day 5)
14. **Apply-gate copy assumes a phone exists** — "verify your phone number" when the user has none on
    file. (Day 1)

---

## What worked well
- **Payments, all three tiers, end-to-end in Stripe test mode:** Basic $19 one-time PaymentIntent
  (job draft→open on confirm), Blu $79/mo and Blu Max $139/mo subscriptions (jobs publish immediately
  under an active sub; 402 without one). Confirmed with `pm_card_visa`. Clean every day.
- **Social graph:** crew co-author posts (invite→accept→dual byline), likes, comments, replies,
  `@mentions`, feed `topComments` — all correct, notifications instant.
- **Messaging:** cross-network cold DMs both directions (worker↔employer), threading, unread counts,
  mark-read / mark-all-read, device-token register/unregister.
- **Vouches:** create → confirm → display on public profile (visible to third parties) → reciprocate.
- **Misc:** Toolbox Talk streaks, bookmark idempotency (dup 200 / delete 204), job stats time-series
  (owner view doesn't self-increment).

---

## Experience contrasts
- **Worker vs employer:** each side works in isolation, but the handoff is severed — workers can
  browse/bookmark/read pay-insights but can't apply (gate); employers can pay/post/see dashboards but
  get 0 applicants. Fixing Twilio reconnects the two halves.
- **In-network (w1/w2) vs out-of-network (w3):** the network is **more permeable than expected.** w3,
  with zero connections, could view public profiles, send cold connection requests, send cold DMs, and
  even create a cold vouch. The one real 3-degree gate is tag-suggestions (correctly empty for her).
  In-network adds the social surface (crew posts, reciprocal vouches, PYMK boosts), not a hard wall.
- **Plan tiers (Basic vs Blu vs Blu Max):** all three transacted correctly; gating logic is right.
  Basic = per-post $19 charge (draft until paid). Blu / Blu Max = monthly sub, jobs publish instantly.
  Functionally Blu vs Blu Max looked the same in what was exercised except Blu Max's featured+urgent
  boost — worth confirming the tiers are differentiated enough to justify $79 vs $139.

---

## Recommended pre-launch punch list (ordered)
1. **Move Twilio to paid** so applications can flow (unblocks the entire marketplace loop). *(blocker)*
2. **Audit the mobile client's empty-body requests** (accept / pay-intent / like) and fix client or
   server. *(should-fix; potentially a device blocker)*
3. **Purge test/QA accounts** from staging/prod so PYMK stops surfacing them. *(should-fix)*
4. **Fix `pay_highest` sort** and give **pay-insights** a sane low-data state. *(should-fix)*
5. **Make the job feed location-aware** (or at least populate `location`). *(should-fix)*
6. **Invalidate the vouch-confirm notification on confirm**, and decide whether cold vouches should be
   allowed. *(should-fix)*
7. Polish sweep: Toolbox Talk personalization, experience-bucket gap, Trade Card slug, `/vouches/pending`
   envelope, employer `notifyJobMatch`, apply-gate copy. *(polish)*

*Note on timing: this reflects staging as of Aug 15–20, 2026. If re-validating before launch, run a
fresh sim — several of these may have shipped fixes since.*
