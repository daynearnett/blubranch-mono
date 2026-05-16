# Change Request System — Lessons Learned

Gotchas from setting up the CR sync system on 2026-05-13 / 2026-05-14. Each entry is a real issue we hit during setup or first use, with the fix and the lesson.

## Issue 1: grep matched example BMA-#### strings in prose, not just real ticket headers

- The original `CR-HANDLING.md` told Claude Code to find the highest existing ticket ID with: `grep -oE 'BMA-[0-9]{4}' docs/CHANGE-REQUESTS.md | sort -u | tail -1`
- Cause: that regex matches the pattern `BMA-####` *anywhere* in the file, including inside example sentences I wrote into `CR-HANDLING.md` itself ("bump BMA-0001 to P1", "close BMA-0007 as duplicate", "move BMA-0012 to In progress", "Recurrence of BMA-0023..."). Since `CR-HANDLING.md` is *referenced* from `CHANGE-REQUESTS.md` workflow examples, those IDs leaked in.
- Symptom: the very first test ticket got assigned `BMA-0020` instead of `BMA-0001`, because the grep found `BMA-0019` (the highest example) and incremented. Confusing and would have caused real numbering collisions if uncaught.
- Fix: anchor the grep on `^### ` (the actual ticket header pattern). After hitting platform-portability issues (see Issue 2), the final form is: `grep -oP '(?<=^### )BMA-[0-9]{4}' docs/CHANGE-REQUESTS.md | sort -u | tail -1`
- Lesson: any pattern-matching that runs against a *documentation file* must anchor on syntactic structure (headers, code blocks, specific positions) rather than just matching the pattern anywhere. The doc is going to contain examples of the pattern it's documenting — that's the whole point of documentation. Plan for it.

## Issue 2: `\K` regex feature isn't portable across grep implementations on macOS

- After fixing Issue 1, the first attempt at the corrected grep used `\K` (PCRE keep-out): `grep -oE '^### \KBMA-[0-9]{4}' ...`
- On the user's machine, `grep` is aliased or installed as `ugrep`, which errored with: `ugrep: error at position 10 (?m)^### \KBMA-[0-9]{4} \___invalid escape`
- Cause: `\K` is a PCRE feature. GNU `grep` supports it with `-P` (PCRE mode), but `-E` (Extended Regular Expressions) mode does not. `ugrep` apparently doesn't support `\K` at all in `-E` mode, and behavior varies across BSD grep (macOS default), GNU grep, and ugrep.
- Fix: switch to PCRE lookbehind with explicit `-P`: `grep -oP '(?<=^### )BMA-[0-9]{4}' docs/CHANGE-REQUESTS.md | sort -u | tail -1`. Lookbehinds are first-class PCRE and work consistently in `-P` mode on every grep that supports PCRE at all.
- Lesson: when writing shell commands in procedural docs, stick to features that work across BSD grep, GNU grep, and ugrep — or explicitly require `-P` and use canonical PCRE constructs (`(?<=...)` lookbehind, `(?=...)` lookahead). The `\K` shorthand is a GNU-grep convenience that doesn't carry over.

## Issue 3: "Configure consent screen" banner in Google Cloud Console is a red herring for service-account flows

- During setup, the Google Cloud Console showed a prominent yellow warning banner on the Credentials page: "Remember to configure the OAuth consent screen with information about your application." with a "Configure consent screen" button.
- Cause: that banner is targeted at developers building user-facing OAuth flows (where humans sign in with their Google accounts). It's irrelevant for service-account credentials, which use a machine identity and don't involve a user consent step.
- Symptom: easy to assume the banner means "you must configure this before service accounts will work." It doesn't. Following it leads to ~10 minutes of unnecessary OAuth app configuration that has no effect on the service-account flow.
- Fix: ignore the banner. Service accounts work without an OAuth consent screen configured.
- Lesson: Google Cloud Console's UI doesn't distinguish well between OAuth and service-account credential flows — both share the same Credentials page, and warnings/prompts often apply only to one or the other without saying which. When following a service-account setup, mentally filter out anything that mentions "consent screen," "OAuth client," or "user authorization."

## Issue 4: env vars in `~/.zshrc` require an explicit reload to take effect

- After appending `GOOGLE_SHEETS_CREDS_PATH` and `GOOGLE_SHEETS_SHEET_ID` to `~/.zshrc`, running `pnpm sync-crs` immediately in the same shell would have failed with "env var not set" — even though the file was correct.
- Cause: `.zshrc` is read at shell startup. Changes to it don't propagate to the running shell automatically. Either `source ~/.zshrc` to reload, or open a new terminal window/tab.
- Fix: the setup doc was updated to include `source ~/.zshrc` immediately after the `cat >> ~/.zshrc` block, then verify with `echo $VARNAME`.
- Lesson: whenever a setup procedure modifies `~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, or any shell-init file, follow up *in the same step* with the reload command and a verification echo. Don't trust that the user will open a fresh terminal.

## Operational notes (not lessons, just things worth remembering)

- **`pnpm sync-crs` is idempotent.** The script clears the sheet and re-writes from markdown each run. Safe to re-run repeatedly. Manual edits to the sheet between syncs get clobbered — that's by design (markdown is source of truth).
- **Service account email lives in the JSON key file.** Grep for `client_email` if you ever need to re-share the sheet (e.g., if it accidentally gets unshared, or you create a new sheet): `cat ~/.config/blubranch/cr-sync-service-account.json | grep client_email`.
- **The sheet's "Last synced" column** is populated by the script, not a Sheets formula. Each row gets the same timestamp on every sync (the time of the sync, not the time the ticket was created or last modified). If you ever need actual per-ticket timestamps, that's a separate enhancement to the sync script.
- **Don't run `pnpm sync-crs` from inside a Claude Code session** unless you've verified that the env vars are propagating into Claude Code's bash sandbox. Default `claude` invocations from a configured shell *should* inherit env, but the safer pattern is to exit Claude Code and run sync from your regular shell.
