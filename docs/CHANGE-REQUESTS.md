# Change Requests

Durable log of bug reports, extensions, and enhancements for the BluBranch mobile app, admin panel, and adjacent surfaces. Slack is the **capture** channel; this doc is the **archive** — Slack Free retains messages for 90 days, this doc retains forever.

This doc is **the source of truth.** A Google Sheet mirror exists for triage and dashboarding (`docs/CR-SETUP.md` covers how it's set up), but every ticket and every edit lands here first. The sheet is rebuilt from this doc by `pnpm sync-crs`.

## Conventions

- **ID format:** `BMA-####` (BluBranch Mobile App, 4-digit zero-padded). First ticket is `BMA-0001`. IDs are append-only and never reused.
- **Type:** `Bug` (something broken) | `Extension` (new capability we don't have yet) | `Enhancement` (existing capability that should work better)
- **Severity:** `P0` (blocking) | `P1` (major) | `P2` (normal) | `P3` (polish). See severity guide below.
- **Status icons:** 🔴 Open · 🟡 In progress · 🟢 Fixed · ⚫ Won't fix · ⚪ Duplicate / out of scope
- **One ticket = one issue.** If a Slack post raises three things, file three tickets and link them all back to the same Slack thread.
- **Edits are versioned via git.** When changing a ticket field after filing (e.g. severity override), commit the change so the audit trail is preserved.

## How this works (workflow)

The team is on Slack Free + Claude Max. There's no automated Slack→Claude bridge — Claude Code does the heavy lifting once a CR is pasted into a session.

**For the filer (cofounder, mostly):**

1. Hit a bug, want a feature, or want an existing thing improved? Post in the most-relevant Slack channel (see [channel index](#channel-index) below).
2. Use the [CR template](#cr-template-for-slack) at the bottom of this doc — copy-paste into Slack and fill in.
3. Attach screenshots/screen recordings directly to the Slack post.
4. **Don't tag `@Claude` in Slack** — that integration isn't installed.

**For the developer (you, eventually both of you):**

1. Open a Claude Code session in the repo: `cd ~/Dev/blubranch-mono && claude`
2. Copy the Slack post text + Slack permalink, drag the screenshot into the Claude Code prompt
3. Type something like: `CR: file this and fix it` (Claude Code reads `docs/CR-HANDLING.md` for the procedure)
4. Claude Code investigates the codebase, classifies the ticket, appends it to this doc, makes the fix, and shows the diff
5. Review the diff, approve, Claude Code commits both the code and the ticket entry
6. After committing, run `pnpm sync-crs` to push the new/updated ticket to the Google Sheet mirror

**For edits and overrides** (priority changes, status updates, marking dupes, etc.):

In a Claude Code session, just say what you want in natural language. Examples:
- `Bump BMA-0001 to P1`
- `Mark BMA-0007 as a duplicate of BMA-0003`
- `Move BMA-0012 to In progress, I'm working on it now`
- `Close BMA-0019 as won't fix — we decided not to support landscape mode`

Claude Code edits the markdown, commits with a sensible message (`chore(BMA-####): <change>`), and the next sync pushes the change to the sheet.

## Severity guide

Don't agonize over this — Claude Code will guess on file, and you can override after.

- **P0 — Blocking:** App crashes, data loss, can't complete primary user flow (signup, booking, payment), security/privacy issue. Drop everything.
- **P1 — Major:** Important flow is broken or seriously degraded but workaround exists. Fix this sprint.
- **P2 — Normal:** Visible bug or feedback that affects experience but not function. Fix when convenient.
- **P3 — Polish:** Cosmetic, nice-to-have, low-impact ergonomics. Batch with similar work.

## Channel index

Slack channels mapped to ticket scopes. When filing, pick the most specific match. Claude Code uses this mapping to set the `Platform` field automatically.

| Channel | Use for | Default platform |
|---|---|---|
| `#ios-builds` | iOS-specific issues — TestFlight builds, crashes, iOS-only UI glitches, App Store / TestFlight pipeline problems | iOS |
| `#android-builds` | Android-specific issues — APK builds, Play Store pipeline, Android-only UI glitches | Android |
| `#styling` | Visual / UI / typography / spacing / color / dark-mode / accessibility issues that are platform-agnostic | Both |
| `#performance` | Slow screens, jank, battery drain, network waterfall problems, anything timing-related | Both |
| `#payments` | Stripe flows, subscription state, billing UI, payout issues, escrow logic | Backend |
| `#admin-panel` | Anything in the web admin — moderation tools, internal dashboards, ops UI | Admin |
| `#automation` | CI/CD, GitHub Actions, deploy pipelines, Railway/EAS automation, scripts | Backend |

If a CR doesn't fit any channel, file in the closest one and Claude Code will note the mismatch in the ticket — that's a signal to add a channel or re-scope existing ones.

---

## Open

> Append-only. New tickets land here as `### BMA-#### — <one-line summary>` blocks. Move to `## In progress` when work starts; move to `## Fixed` when shipped.

<!-- TICKET TEMPLATE — Claude Code uses this exact format. Don't change without updating docs/CR-HANDLING.md. -->

<!--
### BMA-XXXX — <one-line summary>

- **Type:** Bug | Extension | Enhancement
- **Severity:** P0 | P1 | P2 | P3
- **Status:** 🔴 Open
- **Reporter:** <name>
- **Reported:** YYYY-MM-DD
- **Channel:** #<channel-name>
- **Platform:** iOS | Android | Both | Backend | Admin
- **Screen / area:** <e.g. "Onboarding → Trade selection", "Admin → Moderation queue", "Stripe checkout">
- **Slack:** <permalink to original Slack post>
- **Description:** <2–3 sentences with what's happening, expected vs actual if it's a bug>
- **Notes:** <related tickets, design considerations, decisions deferred — leave blank if none>
- **Fix:** <commit SHA, PR link, or one-line description; filled when status flips to 🟢>
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

Copy-paste this block into a Slack post when filing a CR. Keep it short — Claude Code will expand the description and infer fields when it transcribes to a ticket.

```
[CR] <one-line summary>

What happened: <1–2 sentences>
Steps to reproduce (if bug): <minimal steps, or N/A>
Expected: <what should happen>

[attach screenshot/recording]
```

You don't have to fill every field — Claude Code can derive most of them from the description + screenshot. Filing a half-filled CR is much better than not filing at all.

---

## Maintenance

- **Pruning:** keep `Fixed` and `Won't fix` sections in this file for at least 6 months. After that, archive older entries to `docs/archive/CHANGE-REQUESTS-YYYY.md` to keep this file scannable.
- **Numbering:** never reuse IDs. The latest ID = highest existing number + 1. Claude Code derives this by grepping this doc.
- **Slack thread links rot.** When archiving a ticket, copy the relevant context (especially screenshot URLs and key discussion) into the ticket body so the ticket stands alone if Slack purges the original thread.
- **Cross-references:** if two tickets are related (duplicate, blocking, "fixes both"), link them by ID in `**Notes:**`. Don't assume the reader will hunt for context.
- **Sync to sheet:** after editing this doc, run `pnpm sync-crs` to update the Google Sheet mirror. The sheet does not auto-sync — it's a manual step.
