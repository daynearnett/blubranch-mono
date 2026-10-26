# Tester-agent simulation (pre-launch, Aug 3–9 2026)

Six AI tester personas interact with the **staging** app daily via the REST API
(`https://blubranch-production.up.railway.app`), recording friction/bugs/copy
feedback. Runs Mon–Sat; Sunday morning all feedback is condensed into a
one-pager for Dayne + Balint.

## Personas

| Tag | Name | Role | Setup |
|-----|------|------|-------|
| w1 | Ray Delgado | Worker — journeyman electrician, Columbus OH | Connected to w2 |
| w2 | Tommy Barnes | Worker — plumber, Columbus OH | Connected to w1 |
| w3 | Nina Kowalski | Worker — HVAC tech, Cleveland OH | **Out of network** (no connections) |
| e1 | Hank Morrow | Employer — Morrow Electric LLC | **Basic** ($19/post, pay-per-job) |
| e2 | Deb Castillo | Employer — Castillo Mechanical | **Blu** ($79/mo subscription) |
| e3 | Vic Tran | Employer — Tran Builds Group | **Blu Max** ($139/mo subscription) |

- **Credentials:** master copy in `~/.config/blubranch/tester-agents.json` on
  Dayne's Mac (NOT in the repo — public); the cloud routines carry them in
  their private prompts. Accounts registered 2026-08-03; w1↔w2 accepted.
- **Execution:** two cloud routines (claude.ai/code/routines) — a Mon–Sat
  daily run and a Sunday-morning summarizer. Each daily run appends its log
  to `sim-logs/YYYY-MM-DD.md` on the **`sim-logs` branch** (never `main` —
  pushes to main auto-deploy Railway) and pushes. Logs contain observations
  only — NEVER credentials.
- Stripe on staging is TEST mode. Payments are driven headlessly: create the
  intent/subscription via the BluBranch API, then confirm against Stripe's API
  with the publishable key + test payment method `pm_card_visa` (same mechanics
  as `packages/api/scripts/stripe-e2e.ts`).

## Known constraint (do not "fix" mid-sim)

The SMS apply-gate will 403 for all agents — Twilio is on trial and only
texts verified caller IDs. **As of 2026-10-14 the gate's shape is the richer
`403 ProfileIncomplete, missing:[...]`** (phone + photo + headline + trade +
location + experience-or-"actively looking"), not the old phone-only
`PhoneVerificationRequired` — that legacy code only still fires when phone is
literally the *only* missing field. Confirmed stable across every sim run
since (2026-10-19, 10-21, 10-23). Agents should HIT the gate once each,
record the UX of the failure, and otherwise test everything around applying
(browse, search, save/bookmark, job detail, pay-insights).

## Fixture maintenance (read before Thu/network-day runs)

**Underrepresented trades:** staging's job listings come entirely from the
sim's own employer personas posting real jobs — there is no admin seed
script backing them. By 2026-10-21 the plumber trade (Tommy/w2's own trade)
had **zero** postings on staging across both `/jobs?trade=plumber` and
`/jobs/pay-insights`, a real cold-start gap a plumber signing up at launch
would also hit. When an employer persona (e1/e2/e3) posts a job and the
trade doesn't matter to the day's theme, prefer a trade that currently has
thin or no coverage (check `GET /jobs?trade=<slug>&limit=1` first) over
repeating electrician/welder/HVAC again.

**Out-of-network "stranger" fixture:** by 2026-10-23 every pair among the
six personas had some relationship (connection, vouch, or message) — the
"can an outsider do X" scenario (cold vouch, cold connection request) can no
longer produce a genuinely untested pairing. Before a Thu/network-day run
that wants to test this, **deliberately reset one relationship** first
(`DELETE /connections/:id` on an existing w3↔employer connection, for
example) so there's a real stranger to probe, rather than re-confirming a
finding that's already proven six ways.

## Per-run protocol (the prompt each scheduled run executes)

> Read docs/SIM-TESTER-AGENTS.md and ~/.config/blubranch/tester-agents.json.
> Today you are all six BluBranch tester personas, interacting with STAGING
> via the REST API only (the routes live in packages/api/src/routes/ if you
> need exact shapes). For each persona in turn, log in and perform 4–8
> realistic actions appropriate to the day (early days: finish profiles,
> create companies, first posts/jobs; later days: daily-return behavior —
> Toolbox Talk answer, feed browsing, likes/comments, messages, vouches,
> crew posts between w1+w2, w3 attempting cross-network interaction, job
> posting/payment per each employer's plan, checking applicant dashboards
> and notifications). Behave like real users: read what the API returns and
> react to it. THE POINT IS FEEDBACK: every time something surprises you —
> an error, a confusing message, missing data, a flow that dead-ends, copy
> that doesn't sound like the trades, something a real tradesperson would
> mock or love — write it down. Do not fix bugs, do not touch the repo; you
> are users, not developers. Append your run log (persona, action, result,
> observation, severity) to ~/.config/blubranch/sim-logs/<today>.md. Keep
> each persona's session under ~15 API calls. If an account is broken
> (can't log in), note it and continue with the others.

## Sunday summarizer (Aug 9, 08:00 — the prompt)

> Read every file in ~/.config/blubranch/sim-logs/ plus
> docs/SIM-TESTER-AGENTS.md. Produce a ONE-PAGE summary for the founders:
> top findings ranked by severity (launch-blocker / should-fix / polish),
> what worked well, per-persona highlights (worker vs employer experience,
> in-network vs out-of-network differences, plan-tier differences), and a
> recommended pre-launch punch list. Write it to
> docs/SIM-FINDINGS-2026-08-09.md, commit it (do NOT push), and present it.

## Day themes (guidance, not gospel)

- **Mon (day 1):** onboarding — profiles, trades, companies; e1/e2/e3 set up
  their plan (e1 pays for one Basic post; e2/e3 start subscriptions).
- **Tue:** content — posts (w1+w2 make a crew post), Toolbox Talk, likes.
- **Wed:** jobs — searches, bookmarks, the apply-gate, pay-insights; employers
  review dashboards/stats.
- **Thu:** network — w3 tries to break in (requests, messages, tag attempts);
  vouches between w1/w2; profile views.
- **Fri:** messaging + notifications sweep; forgot-password round-trip is NOT
  testable headlessly (email codes) — note it, skip it.
- **Sat:** free play + regression — repeat whatever felt broken earlier.

## Cleanup note

Earlier orphaned accounts from a failed setup run (emails `+sim-w1`…`+sim-e3`,
registered 2026-08-03 with lost passwords) can be ignored or admin-deleted
later. The live sim uses `+sim2-*` emails.

## Git isolation (REQUIRED — added 2026-10-05 after two worktree collisions)

Sim/background sessions must NOT operate in the main checkout at
`~/Dev/blubranch-mono` — on 2026-10-04/05 a sim session switched that
directory's checked-out branch mid-day while an interactive session was
working in it. Result: the interactive session committed onto the sim's
branch without knowing (a docs commit stranded on `fix/empty-json-body-400`),
later saw "reverted" files from the sim's stale branch, and in recovering
nearly clobbered the sim branch's ref with a `reset --hard`.

Rules:
1. **Every sim/background session creates its own worktree first** and does
   ALL work there:
   `git worktree add ../blubranch-sim-<runid> -b <branch> origin/main`
   Remove it at the end of the run (`git worktree remove ../blubranch-sim-<runid>`).
2. **Never run `git checkout`/`switch`/`reset` in the main checkout** from a
   sim session — the main checkout belongs to the interactive session and
   stays on `main`.
3. Interactive sessions: guard commits with a
   `[ "$(git branch --show-current)" = main ]` check in the same shell line —
   a checkout can land between two separate commands.
