# Change Requests

Durable log of bug reports, UI feedback, and small change requests for the BluBranch mobile app, admin panel, and adjacent surfaces. Slack is the **capture** channel; this doc is the **archive** — Slack Free retains messages for 90 days, this doc retains forever.

## Conventions

- **ID format:** `BMA-####` (BluBranch Mobile App, 4-digit zero-padded). First ticket is `BMA-0001`. IDs are append-only and never reused.
- **Status icons:** 🔴 Open · 🟡 In progress · 🟢 Fixed · ⚫ Won't fix · ⚪ Duplicate / out of scope
- **One ticket = one issue.** If a Slack post raises three things, file three tickets and link them all back to the same Slack thread.
- **Ticket entries are immutable once filed**, except for the Status, Fix, and Notes fields. Don't rewrite history.

## How this works (workflow)

The team is on Slack Free + Claude Max, which means there's no automated Slack→Claude→PR bridge — the workflow is manual but deliberately low-ceremony.

**For the cofounder (filer):**

1. Hit a bug or have a change request while testing? Post in the most-relevant Slack channel (see channel index below).
2. Use the [CR template](#cr-template-for-slack) at the bottom of this doc — copy-paste into Slack and fill in.
3. Attach screenshots/screen recordings directly to the Slack post. Slack keeps them inline.
4. **Don't tag `@Claude` in Slack** — the integration isn't installed and won't trigger anything. Just post normally.
5. If the issue spans multiple channels (e.g. an iOS bug that's also relevant to performance), pick the *most-specific* channel and mention the others in the post body.

**For the developer (fixer):**

1. Watch Slack channels for new CR posts.
2. Transcribe each CR into this doc as a new ticket — copy the Slack permalink into the ticket so the original screenshot/discussion is one click away.
3. Status starts at 🔴 Open.
4. When picking up work, set status to 🟡 In progress and note the date.
5. When the fix ships (commit pushed + deployed where applicable), move the ticket to the [Fixed](#fixed) section, fill in the Fix field with commit SHA / PR link, and reply in the original Slack thread with a one-line summary linking the commit.
6. If the issue is rejected or out of scope, set status to ⚫ or ⚪ and note why.

**Why both Slack and a doc?**

- **Slack** is great for capture (fast, native screenshots, mobile) but loses messages after 90 days on the Free plan and has no cross-channel view.
- **This doc** is permanent (lives in git), is greppable, and gives one cross-cutting view across all channels.
- The doc is the **system of record**. If a CR isn't in the doc, it effectively doesn't exist for prioritization or sprint planning.

## Channel index

Slack channels mapped to ticket scopes. When filing, pick the most specific match.

| Channel | Use for |
|---|---|
| `#ios-builds` | iOS-specific issues — TestFlight builds, crashes, iOS-only UI glitches, App Store / TestFlight pipeline problems |
| `#android-builds` | Android-specific issues — APK builds, Play Store pipeline, Android-only UI glitches |
| `#styling` | Visual / UI / typography / spacing / color / dark-mode / accessibility issues that are platform-agnostic |
| `#performance` | Slow screens, jank, battery drain, network waterfall problems, anything timing-related |
| `#payments` | Stripe flows, subscription state, billing UI, payout issues, escrow logic |
| `#admin-panel` | Anything in the web admin — moderation tools, internal dashboards, ops UI |
| `#automation` | CI/CD, GitHub Actions, deploy pipelines, Railway/EAS automation, scripts |

If a CR doesn't fit any channel, file in the closest one and note the mismatch in the ticket — that's a signal to add a channel or re-scope existing ones.

## Severity (optional, for prioritization)

Don't agonize over this — assign on a rough vibe and adjust later if needed.

- **P0 — Blocking:** App crashes, data loss, can't complete primary user flow (signup, booking, payment), or a security/privacy issue. Drop everything.
- **P1 — Major:** Important flow is broken or seriously degraded but workaround exists. Fix this sprint.
- **P2 — Normal:** Visible bug or feedback that affects experience but not function. Fix when convenient.
- **P3 — Polish:** Cosmetic, nice-to-have, low-impact ergonomics. Batch with similar work.

---

## Open

> No open tickets yet. The first ticket will be appended below this line as `### BMA-0001 — <one-line summary>`.

<!-- TICKET TEMPLATE — copy this whole block when filing a new ticket. Keep order: ID + summary, then metadata block, then body. -->

<!--
### BMA-XXXX — <one-line summary>

- **Filed:** YYYY-MM-DD by <name>
- **Slack:** <permalink to original Slack post>
- **Channel:** #<channel-name>
- **Screen / area:** <e.g. "Onboarding → Trade selection", "Admin → Moderation queue", "Stripe checkout">
- **Severity:** P0 | P1 | P2 | P3
- **Status:** 🔴 Open
- **Description:** <what's broken or being requested, in 1–3 sentences>
- **Repro / steps:** <if a bug — minimal steps to reproduce; otherwise N/A>
- **Expected vs actual:** <if a bug>
- **Notes:** <anything that doesn't fit above — related tickets, design considerations, decisions deferred>
- **Fix:** <commit SHA, PR link, or one-line description; filled in when status flips to 🟢>
-->

---

## In progress

> Tickets currently being worked on. Move here from Open when work starts; move to Fixed when shipped.

---

## Fixed

> Tickets fixed and verified. Most recent at top.

---

## Won't fix / out of scope

> Tickets explicitly closed without a fix. Brief rationale required so future-us doesn't re-litigate.

---

## CR template (for Slack)

Copy-paste this block into a Slack post when filing a CR. Keep it short — the goal is to capture enough that the developer can transcribe to a ticket without follow-up questions.

```
[CR] <one-line summary>

Screen/area: <e.g. Onboarding → Trade selection>
Severity: <P0 | P1 | P2 | P3 — leave blank if unsure>
What happened: <1–3 sentences>
Steps to reproduce (if bug): <minimal steps, or N/A>
Expected: <what should happen>
Actual: <what happened instead>

[attach screenshot/recording in Slack]
```

You don't have to fill every field — the template is a checklist of things that are useful, not required. Filing a half-filled CR is much better than not filing at all.

---

## Maintenance

- **Pruning:** keep `Fixed` and `Won't fix` sections in this file for at least 6 months. After that, move older entries to a yearly archive doc (e.g. `docs/archive/CHANGE-REQUESTS-2026.md`) to keep this file scannable.
- **Numbering:** never reuse IDs even after deletion or archive. The latest ID = highest existing number + 1.
- **Slack thread links rot.** When archiving a ticket, copy the relevant context (especially screenshot URLs and key discussion) into the ticket body so the ticket stands alone if Slack purges the original thread.
- **Cross-references:** if two tickets are related (duplicate, blocking, or "fixes both"), link them by ID in the Notes field. Don't assume the reader will hunt for context.
