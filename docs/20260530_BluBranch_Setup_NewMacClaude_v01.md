# BluBranch — New-Machine Setup & Parity Verification

> Onboarding doc for a new contributor (Balint) bringing a fresh Mac to parity
> with the BluBranch dev environment. Phases 1–10 cover toolchain, repo, env,
> and services. **Phase 11** is the parity gate: a 9-item checklist to confirm
> the environment is fully working before building begins.

## Phase 11 — Confirm parity

Once the env setup (Phases 1–10) is finished, paste this prompt into Claude Code
at the repo root.

> Verify my BluBranch dev environment is fully working before I start building.
> Go one step at a time and tell me PASS/FAIL for each, then a final summary.
> Don't fix anything without explaining first.
>
> 1. **Toolchain versions** — run `node --version` (expect v20+), `pnpm --version`
>    (expect 10.x), `docker --version` and `docker compose version` (both print numbers).
> 2. **Repo + install** — confirm I'm in `blubranch-mono`, `git remote -v` points at
>    the BluBranch repo, and `pnpm install` completes with no red errors.
> 3. **Env file** — confirm `.env` exists (copied from `.env.example`) and has
>    `DATABASE_URL`, `REDIS_URL`, and a `JWT_SECRET` value. (Real third-party keys
>    aren't needed yet.)
> 4. **Local services** — run `docker compose up -d`, then `docker compose ps`;
>    expect postgres (5432) and redis (6379) both running.
> 5. **Database** — run `pnpm db:generate`, then `pnpm db:migrate`; expect
>    "All migrations have been successfully applied."
> 6. **Full dev stack** — run `pnpm dev` and watch for: API "Server listening at
>    http://0.0.0.0:4000", Admin "Local: http://localhost:5173", and the Expo QR/Metro line.
> 7. **API health** — in a second terminal, `curl http://localhost:4000/health` →
>    expect `{"status":"ok"}`.
> 8. **Admin panel (my focus)** — open http://localhost:5173. Expect the BluBranch
>    admin login (navy background, orange button). Then stop dev and run
>    `pnpm --filter @blubranch/admin build`; expect a clean build with no TypeScript errors.
> 9. **Git identity** — `git config --list | grep user` shows my name + the email on
>    my GitHub account, and `ssh -T git@github.com` authenticates as me.
>
> If all nine PASS, tell me I'm cleared to start on the admin panel (Phase 6).

### Notes on this checklist

- **Items 4–7 intentionally overlap Phase 10** (Docker up, db migrate, `pnpm dev`,
  `/health`). This is a deliberate re-confirmation gate, not duplicate work — just
  confirm each still passes.
- **Item 8** is the only step that exercises the admin app specifically. It proves
  the area Balint will build runs and compiles.
- **Item 9** re-verifies the git identity / SSH set up in earlier phases actually took.

### What does NOT need transferring from the original machine

For building the admin panel, essentially nothing sensitive. The admin app talks
to the contributor's own local API (`VITE_API_URL` defaults to `localhost:4000`),
so no production secrets are required to build or run it.

| Item | Needs transfer? | How |
|---|---|---|
| `.env` (JWT, DB, Stripe, Twilio, Resend, Firebase, Maps) | **No — self-generated.** Copy `.env.example` → `.env`, use Docker-default `DATABASE_URL`/`REDIS_URL` and a throwaway `JWT_SECRET`. Real keys only when touching those features — **via password manager only, never in chat/Slack/commits.** |
| Taist admin source (`taist-mono`) | **No.** The branded admin shell lives in-repo (`apps/admin`); do not grant `taist-mono` access (it holds live Taist credentials). | N/A |
| CR-sync service account | Only if running `pnpm sync-crs`. Not needed for admin. Place at `~/.config/blubranch/` (chmod 600) via password manager. |
| Expo/EAS creds (`~/.expo`) | Only for mobile builds. Not needed for admin. |
| Railway / Apple / Google Play | Only for deploy/store submission, not local dev. Grant dashboard access directly. |
