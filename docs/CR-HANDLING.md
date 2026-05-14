# CR Handling Procedure

This file is the operational playbook Claude Code follows when filing or editing change requests. The user-facing overview lives in [CHANGE-REQUESTS.md](./CHANGE-REQUESTS.md); this file is the *implementation* details.

**Audience:** Claude Code sessions that have been asked to handle a CR action. Read this end-to-end before acting.

**Trigger phrases that mean "handle a CR":** "CR:", "file this as a CR", "file a CR for...", "log this", "ticket this", "track this issue", or pasted Slack content with a screenshot when the user is clearly asking for the issue to be tracked.

---

## Filing a new CR

### Step 1 — Determine the next ticket ID

Run from the repo root:

```bash
grep -oP '(?<=^### )BMA-[0-9]{4}' docs/CHANGE-REQUESTS.md | sort -u | tail -1
```

The `^### ` lookbehind ensures we only match actual ticket headings, not example IDs that appear in the doc's prose or template comments. Take the result, increment by 1, zero-pad to 4 digits. If the grep returns nothing (first CR ever), use `BMA-0001`.

### Step 2 — Classify the ticket

From the user's pasted content + screenshot, infer:

**Type** (`Bug` | `Extension` | `Enhancement`):
- `Bug` — Something is broken, crashing, returning wrong data, looking visually wrong, or behaving unexpectedly. Default for most CRs.
- `Extension` — A new capability that doesn't exist yet. The user is asking for something to be *added*. Phrases: "add a...", "we need a...", "I'd like to be able to...", "missing".
- `Enhancement` — An existing capability that should work better. The thing exists; it's not broken; but it could be improved. Phrases: "could be better if...", "would be nice if...", "improve...", "tweak...".

When uncertain between Bug and Enhancement, lean Bug if there's any sense of "this isn't right." Lean Enhancement if it's clearly working as designed but the design itself is the issue.

**Severity** (`P0` | `P1` | `P2` | `P3`):
- `P0` — App crashes, data loss, primary user flow blocked (signup, booking, payment), security or privacy issue. Use sparingly.
- `P1` — Important flow seriously degraded but workaround exists. Examples: "checkout works but takes 30 seconds", "trade selection works but shows wrong icons".
- `P2` — Visible bug or feedback that affects experience but not function. Default for most filed CRs. Examples: "Continue button is too low", "color is off".
- `P3` — Cosmetic / polish / nice-to-have. Examples: "padding could be tighter", "spinner could be on-brand".

If unsure, pick `P2`. The user can override after.

**Platform** — derive from the Slack channel via the channel index in `CHANGE-REQUESTS.md`. If the channel isn't given, infer from the description (e.g., screenshot of an iPhone → iOS).

**Screen / area** — concise dotted path. Examples: `Onboarding → Trade selection`, `Admin → Moderation queue`, `Stripe checkout return URL`.

### Step 3 — Locate the relevant code

Before writing the ticket, do a quick codebase scan to confirm the issue is real and the fix is feasible. This also gives you context for the description.

For UI bugs, look in `apps/mobile/src/screens/` or `apps/mobile/src/components/` based on the screen name. For backend bugs, look in `packages/api/src/`. For admin bugs, look in `apps/admin/`.

**You do not need to make the fix at this stage** — just confirm the issue is locatable. If you can't find the relevant code, that's worth noting in the ticket's `Notes` field.

### Step 4 — Append the ticket to `docs/CHANGE-REQUESTS.md`

Insert the new ticket block under the `## Open` section, immediately after the comment block that ends with `-->`. Use this exact format (replacing placeholder values; keep the dash-bullet structure exactly as shown):

```markdown
### BMA-#### — <one-line summary>

- **Type:** <Bug | Extension | Enhancement>
- **Severity:** <P0 | P1 | P2 | P3>
- **Status:** 🔴 Open
- **Reporter:** <name from context, default to "Cofounder" if it's a Slack post and reporter isn't specified>
- **Reported:** <YYYY-MM-DD from `date '+%Y-%m-%d'`>
- **Channel:** #<channel-name>
- **Platform:** <iOS | Android | Both | Backend | Admin>
- **Screen / area:** <screen path>
- **Slack:** <permalink, or "—" if not provided>
- **Description:** <2-3 sentences expanded from the user's terse input + the screenshot>
- **Notes:** <leave as "—" unless there's something specific to note>
- **Fix:** —
```

### Step 5 — Make the fix (if instructed)

If the user said "file this AND fix it" (or similar), proceed to make the code fix following normal Claude Code practices:
- Edit the relevant files
- Make the change minimal and targeted
- Don't refactor adjacent code unless asked
- Show the user the full diff before committing

If the user said only "file this" (without "fix it"), stop after Step 4 and ask whether to proceed with the fix or hold for triage.

### Step 6 — Commit

If both ticket and fix are done in the same session, commit them together. Commit message format:

```
fix(BMA-####): <imperative description>
```

Or for non-bug tickets:
```
feat(BMA-####): <imperative description>    # for Extension
chore(BMA-####): <imperative description>   # for Enhancement
```

If only filing (no fix yet), use:
```
docs(BMA-####): file ticket — <one-line summary>
```

### Step 7 — Sync to sheet (manual)

After committing, remind the user to run `pnpm sync-crs` to push the new ticket to the Google Sheet mirror. Do NOT run this command yourself — it depends on environment variables that may not be set in every session, and it makes external API calls.

---

## Editing an existing CR

When the user asks to edit a CR (e.g., "bump BMA-0001 to P1", "close BMA-0007 as duplicate", "move BMA-0012 to In progress"):

### Step 1 — Locate the ticket

```bash
grep -n "^### BMA-####" docs/CHANGE-REQUESTS.md
```

(replace `####` with the actual number). The ticket block runs from the `### BMA-####` line through to either the next `### BMA-` line or the next `---` separator.

### Step 2 — Apply the edit

Use `str_replace` with the specific field line being changed. For example, to bump severity:

- Find: `- **Severity:** P2`
- Replace: `- **Severity:** P1`

For status changes, also update the status icon in the field value (🔴 Open / 🟡 In progress / 🟢 Fixed / ⚫ Won't fix / ⚪ Duplicate).

### Step 3 — Move ticket between sections (if status changes)

When a ticket's status flips, move the entire ticket block to the matching section:
- 🔴 Open → 🟡 In progress: move from `## Open` to `## In progress`
- 🟡 In progress → 🟢 Fixed: move from `## In progress` to `## Fixed` (insert at top of Fixed section, since "most recent at top")
- Any → ⚫ Won't fix or ⚪ Duplicate: move to `## Won't fix / out of scope`

When moving to `## Fixed`, also fill in the `**Fix:**` field with the commit SHA (use `git log -1 --format=%h` for the latest commit) or a one-line description.

### Step 4 — Add audit note (for non-trivial changes)

For severity changes, status changes, or duplicates, append a line to the ticket's `**Notes:**` field with the date and reason. Example:

- Before: `- **Notes:** —`
- After: `- **Notes:** 2026-05-04: severity bumped P2 → P1 per cofounder review.`

If `Notes` already has content, append a new line below it rather than overwriting.

### Step 5 — Commit

Edit-only commit message format:

```
chore(BMA-####): <description of the edit>
```

Examples:
- `chore(BMA-0001): bump severity P2 → P1`
- `chore(BMA-0007): mark as duplicate of BMA-0003`
- `chore(BMA-0012): move to In progress`

### Step 6 — Remind user to sync

Same as filing: remind the user to run `pnpm sync-crs` after the commit.

---

## Bulk edits

If the user requests a bulk edit ("bump all open P3s with channel=#styling to P2"), do it in one commit with a summary message. Show the diff before committing — bulk edits should always be reviewed by a human before they land.

Commit format:

```
chore(crs): <description of bulk change>

Affected: BMA-0001, BMA-0007, BMA-0012, ...
```

---

## Edge cases

### Multiple issues in one Slack post
If the user pastes a Slack post that describes multiple distinct issues, file them as separate tickets and cross-reference them in each ticket's `**Notes:**` field. Use IDs that increment together (e.g., BMA-0008, BMA-0009, BMA-0010 all from the same post).

### CR doesn't fit any channel
If the user files a CR but the right Slack channel is unclear, set the `**Channel:**` field to the closest match and add a note in `**Notes:**` flagging the channel-fit issue. This is a signal to revisit the channel structure.

### User asks to "delete" a ticket
Don't delete tickets. Move them to `## Won't fix / out of scope` with a note explaining why. The audit trail matters.

### Reopen a fixed ticket
If a previously-fixed bug recurs, don't reopen the original — file a new CR and link it to the old one in `**Notes:**`. Example: `Recurrence of BMA-0023, originally fixed in <commit SHA>.` This preserves the timeline.
