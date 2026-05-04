# Railway Deploy — Lessons Learned

> Failures hit on the way to a working `api-staging.blubranch.com` deploy,
> with the actual fixes that landed.
> Companion to [RAILWAY-DEPLOY.md](./RAILWAY-DEPLOY.md) (the playbook).

---

## Issue 1: `ca-certificates` doesn't exist as a Nix package
- Initial `nixpacks.toml` `setup` phase listed `ca-certificates` alongside `nodejs_20` and `openssl`
- Nix build failed: `error: undefined variable 'ca-certificates'`
- Cause: Nixpkgs calls the bundle `cacert`, not `ca-certificates`. The latter is the Debian/Ubuntu package name and doesn't exist in Nix.
- Fix: removed it entirely. `openssl` ships with its own trust roots in the Nix derivation, so `cacert` isn't needed for HTTPS-out fetches the API makes (Twilio, Stripe, etc.).
- Lesson: package names in `nixPkgs` are Nix attribute names, not apt names. When in doubt, search `https://search.nixos.org/packages`.

## Issue 2: `pnpm` not on PATH after `npm i -g`
- Install command `npm i -g pnpm@10 && cd /app && pnpm install --frozen-lockfile`
- Build failed: `pnpm: command not found`
- Cause: each item in `cmds` runs as one shell, but the shell that picks up the result of `npm i -g` doesn't inherit the npm-bin directory on `PATH`. `npm root -g` resolves to `/usr/lib/node_modules`, but Nixpacks runs commands in a non-login shell where the corresponding `.bin` directory isn't on `$PATH`.
- Lesson: `npm install -g <bin>` followed by invoking that bin in the same chained command is unreliable in Nixpacks. The bin lands somewhere, but the shell environment doesn't always resolve it.

## Issue 3: corepack signature verification rejects pnpm@10
- Switched to `corepack enable && corepack prepare pnpm@10 --activate && pnpm install …`
- Build failed: `Error: pnpm@10 is not in the list of pinned versions and signature verification failed`
- Cause: corepack on Node 20.18 ships with a hard-coded set of pinned signatures and doesn't trust newer pnpm releases (pnpm 10.33.x was released after the Node 20.18 was cut). Bumping Node minor would fix it but Nix's `nodejs_20` is pinned at the LTS minor.
- Lesson: corepack's signature pinning makes it brittle for "latest pnpm" — fine when versions match, painful when they don't. Skip corepack for non-default pnpm versions.

## Issue 4: PATH-export workaround still couldn't find pnpm
- Tried `npm i -g pnpm@10 && export PATH=$(npm root -g)/../bin:$PATH && pnpm install …`
- Build failed again with `pnpm: command not found`
- Cause: in Nixpacks's Nix-rooted environment, `npm root -g` returns `/usr/lib/node_modules` — but globally installed bins go to `/usr/lib/node_modules/.bin`, not `/usr/bin`. The `$(npm root -g)/../bin` expression evaluates to `/usr/lib/bin`, which is empty.
- Lesson: don't try to derive npm's global-bin location with shell math. The path varies across distros and is especially weird inside Nix.

## Issue 5: Install pnpm via Nix itself (the actual fix)
- Final config:
  ```toml
  [phases.setup]
  nixPkgs = ["nodejs_20", "openssl", "nodePackages.pnpm"]

  [phases.install]
  cmds = ["cd /app && pnpm install --frozen-lockfile"]
  ```
- `nodePackages.pnpm` declares pnpm as a Nix derivation, installed alongside Node. Nix puts the `pnpm` symlink directly on the build's `$PATH` (because that's how `nixPkgs` items are exposed) — no shell hacking needed.
- Lesson: when a dependency needs to be on PATH inside a Nix-based builder, install it as a Nix package, not via a package manager that targets a different layout convention.

## Issue 6: Service "Root Directory" must be blank for monorepo deploys
- Initial Railway service had Root Directory set to `packages/api` (intuitive for a service whose code lives there)
- Build context (`/app`) only contained `packages/api/` files. `cd /app && pnpm install --frozen-lockfile` failed because there was no `pnpm-workspace.yaml` — pnpm just installed `@blubranch/api`'s direct deps and skipped the workspace symlinks, breaking imports of `@blubranch/db` and `@blubranch/shared` at runtime.
- Fix: leave the service's **Root Directory** field blank.
- Lesson: in Railway, "Root Directory" controls the *build context*, not just which subdirectory Railway watches. For pnpm-workspace monorepos, the install must run from the workspace root, so the build context has to be the monorepo root.

## Issue 7: `NODE_ENV=production` stripped runtime devDependencies
- Railway sets `NODE_ENV=production` by default. With `pnpm install --frozen-lockfile` (no `--prod=false`), pnpm honors that and skips devDependencies.
- The first deploys to clear the build phase failed at start: `npx prisma migrate deploy` → "prisma not found", and `node --import tsx` → "Cannot find package 'tsx'".
- Cause: `prisma` (CLI), `tsx` (loader) were both in `devDependencies`. The runtime needs them.
- Fix: moved them to `dependencies` —
  - `packages/api/package.json` — `tsx` to `dependencies`
  - `packages/db/package.json` — `prisma` and `tsx` to `dependencies`
- Considered but rejected: setting `NPM_CONFIG_PRODUCTION=false` or adding `--prod=false` to the install command. Both work but make the dep-graph look a lie ("dev" deps that are actually required at runtime). Moving them is more honest and survives a future tooling change.
- Lesson: any package the start command literally invokes is a runtime dependency. The "dev" label is for things only used during local iteration (eslint, vitest, @types/*).

## Issue 8: Cross-service variable references use `${{Service.VAR}}`
- Linking `DATABASE_URL` from the Postgres service to the API service via the Variables panel produces a reference of the form:
  ```
  DATABASE_URL = ${{Postgres.DATABASE_URL}}
  ```
- This is Railway's templating syntax — not standard shell or env-file expansion. Pasting `$Postgres.DATABASE_URL` or `$DATABASE_URL_FROM_POSTGRES` does not work. Only the `${{ServiceName.VAR}}` form is resolved at deploy time.
- The dashboard's "Add Reference" picker writes this for you; if you ever set vars via `railway variables --set` from the CLI, you have to type the `${{...}}` form yourself, including the double curlies.
- Lesson: don't try to be clever with custom env-var plumbing — use the Variables → "Add Reference" picker every time. It's the only path that won't bite later when service names change or new env-prefix conventions land.

## Issue 9: `Config-as-Code Path` doesn't move the build context — configs live at repo root
- After fixing Issues 1–8, the build cleared install/build phases. Then the start command failed: `ERR_PNPM_NO_LOCKFILE` — pnpm couldn't find `pnpm-lock.yaml` at `/app`.
- The lockfile was tracked in git, sitting at the monorepo root, not in `.gitignore` or any other ignore file. `git ls-files` proved it was in every clone Railway pulled.
- Initial setup put `nixpacks.toml` and `railway.toml` inside `packages/api/` and pointed Railway at them via the **Config-as-Code Path** service setting (`packages/api/railway.toml`). The assumption: that setting only controls *where Railway reads its config*, leaving the build context at the repo root.
- Reality: Railway uses the directory containing the config file as the **build context**. With `Config-as-Code Path` pointing into `packages/api/`, only that subdirectory got mounted at `/app` — `pnpm-lock.yaml` and `pnpm-workspace.yaml` (at the monorepo root) were excluded.
- Fix: moved `nixpacks.toml` and `railway.toml` to the **monorepo root** and cleared the **Config-as-Code Path** field in the dashboard. Railway auto-detects both files at the default location, the entire monorepo lands at `/app`, and `pnpm install --frozen-lockfile` finds the lockfile.
- Lesson: in a pnpm-workspace monorepo, deploy configs (`railway.toml`, `nixpacks.toml`, `Dockerfile`, etc.) must live at the workspace root — alongside `pnpm-workspace.yaml` and the lockfile — for any builder that copies "the directory containing the config" into the build container. Don't try to scope them to a sub-package via a config-path setting; the build context follows the file, not the setting.

## Issue 10: Nixpacks always inserts `RUN npm i` — switched to a Dockerfile
- After fixing the lockfile-missing issue, the next failure was: `npm error code EUNSUPPORTEDPROTOCOL — Unsupported URL Type "workspace:": workspace:*` from a `RUN npm i` step in stage-0.
- We tried to override the install step three different ways:
  1. Custom `[phases.install]` cmds running `pnpm install --frozen-lockfile`
  2. Adding a `packageManager: pnpm@10.0.0` field to root `package.json` so Nixpacks would "detect pnpm"
  3. Pinning pnpm via Nix (`nodePackages.pnpm`) so it'd be available before install
- Reality: Nixpacks's Node provider has a **stage-0 metadata-extraction step** that runs `npm i` unconditionally to read package metadata. This step runs *before* user-defined phases, isn't documented as overridable, and doesn't honor `packageManager`. It can't be turned off from `nixpacks.toml`.
- Fix: ditched Nixpacks for a `Dockerfile` at the repo root. Sets `builder = "DOCKERFILE"` in `railway.toml`, deleted `nixpacks.toml` outright. The Dockerfile uses `node:20-bookworm-slim`, installs pnpm via `npm install -g pnpm@10` (the Debian PATH issues from Nixpacks issues 2-5 don't apply because Debian images put npm bin on PATH normally), copies the entire monorepo, runs `pnpm install --frozen-lockfile`, and `CMD`s `prisma migrate deploy && node --import tsx src/server.ts`.
- Lesson: Nixpacks is great for single-package Node apps with no surprises in install. For pnpm workspaces (or anything with a `workspace:*` protocol in deps), reach for a Dockerfile. The Dockerfile is also faster to debug because every step is explicit — no hidden buildpack steps, no provider auto-detection running before your config takes effect.

## Issue 11: Dockerfile build context isn't the repo root → `ERR_PNPM_NO_LOCKFILE`
- After switching to the Dockerfile, the build progressed to step 6 (`RUN pnpm install --frozen-lockfile`) and failed with `ERR_PNPM_NO_LOCKFILE`. pnpm couldn't find `pnpm-lock.yaml` at `/app`.
- The lockfile was confirmed:
  - Tracked in git (`git ls-files pnpm-lock.yaml` returns it)
  - Pushed to `origin/main` (`git ls-tree -r origin/main` includes it)
  - Not in `.gitignore`, `.dockerignore`, or `.gitattributes` (no export-ignore)
  - Available in a fresh clone of the repo
- Diagnosis: Railway has TWO independent service settings that affect Docker builds —
  - `dockerfilePath`: where to find the Dockerfile (resolved against the repo root)
  - **Root Directory**: the build context (what `COPY . .` actually copies)
  - These are separate. With Root Directory set to `packages/api`, Railway still finds `/Dockerfile` at the repo root, BUT `COPY . .` only copies `packages/api/` contents — the lockfile and `pnpm-workspace.yaml` (which live at the repo root) are *not* in the build context. The build proceeds far enough to fail at the install step.
- Fix: clear the Root Directory field in the Railway service dashboard (Settings → Source → Root Directory) so the build context becomes the repo root. The `dockerfilePath = "Dockerfile"` in `railway.toml` then resolves correctly and `COPY . .` brings in everything.
- Defense: the Dockerfile now does explicit per-file COPYs of `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `.npmrc`, and each workspace package's manifest BEFORE `pnpm install`. If the build context is wrong, Docker fails at one of those COPYs with `ERROR: failed to compute cache key: lstat <name>: no such file or directory` — which names the missing file directly instead of letting the failure surface deep inside pnpm.
- Lesson: in Railway, "where Railway finds the Dockerfile" and "what's in the Dockerfile's build context" are two separate dashboard settings, and the Root Directory field controls the latter even when a custom `dockerfilePath` is set. Always verify the Root Directory field shows blank in the dashboard before debugging anything else when the symptom is "expected file isn't at /app". Adding fail-fast COPYs of critical files in the Dockerfile turns a deep, misleading error (ERR_PNPM_NO_LOCKFILE) into an immediate, file-named one.

## Issue 12: BuildKit "failed to calculate checksum" on workspace COPYs
- After fixing the Root Directory issue, the build cleared the root-level metadata COPYs (`COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./`) and then died on `COPY packages/shared/package.json ./packages/shared/` with `failed to calculate checksum... packages/shared/package.json: not found`.
- The file genuinely existed:
  - On disk locally (regular file, 557 bytes, not a symlink)
  - Tracked in git, on origin/main
  - Not matched by any `.gitignore`, `.dockerignore`, or `.gitattributes` pattern
  - No non-ASCII chars or hidden characters in `.dockerignore`
- First attempted fix: replaced per-package-manifest COPYs (`COPY packages/shared/package.json ./packages/shared/` etc.) with whole-directory COPYs (`COPY apps ./apps`, `COPY packages ./packages`). **This also failed** with the same `failed to calculate checksum... not found` error pattern, which ruled out the per-file COPY hypothesis.
- See Issue 13 for the actual fix.

## Issue 13: Trimming `.dockerignore` to the bare minimum unblocked workspace COPYs
- The `.dockerignore` we were running with had ~30 patterns including a bunch of `**/dist`, `**/.expo`, `**/.turbo` globs and per-path entries like `apps/mobile/.expo`. None of them should have matched `apps/`, `packages/`, or `packages/shared/package.json`, but the build kept failing with "failed to calculate checksum... not found" on those COPYs.
- Hypothesis (unconfirmed): something in BuildKit's interaction between `**`-globs and a deep monorepo tree was confusing its checksum calculation for whole-directory COPYs. It wasn't matching the directories — it was failing to traverse them while applying ignore filters.
- Fix: minimized `.dockerignore` to three concerns only:
  ```
  node_modules
  **/node_modules
  .git
  .env
  .env.*
  !.env.example
  ```
  Removed every `**/dist`, `**/.expo`, `**/.turbo`, `web-build`, `*.md`, `docs`, `apps/mobile/dist`, `packages/db/src/generated`, etc. They were nice-to-have for keeping the build context small, but each was a potential interaction trigger and we'd already paid for several failed deploys chasing them.
- Trade-off: the build context now includes `dist/`, `.expo/`, `.turbo/`, `docs/`, etc. directories. This makes uploads larger and the install image slightly fatter (because subsequent `COPY apps ./apps` brings in `apps/mobile/dist` for example). For our purposes (a few-MB difference in build context, build still under 2 minutes) this doesn't matter. The Dockerfile only `cd`s into `packages/api/` at runtime so unused files don't affect the running app.
- Lesson: when BuildKit fails with cryptic "not found" errors on COPYs of files that demonstrably exist, the smallest `.dockerignore` is the safest. Pattern interactions with `**`-globs in a monorepo are not worth debugging — minimize first, optimize later. If you need to exclude something specific, exclude it by an exact path, not a wildcard.

## Issue 14: Railway's stock Postgres doesn't ship PostGIS — migrations and code made graceful
- After getting the build to succeed and the API to actually start, the Prisma migration phase failed: `CREATE EXTENSION IF NOT EXISTS "postgis"` errored with `extension "postgis" is not available`. Railway's managed Postgres image is plain `postgres`, not `postgis/postgis`.
- A failed migration also poisoned the `_prisma_migrations` table — subsequent deploys hit `P3009` ("migrate found failed migrations in the target database"). One-shot fix: change CMD to `prisma migrate reset --force` to wipe + re-apply, then revert to `migrate deploy`. This works only because staging has no real data yet.
- Cleanest fix going forward: make both PostGIS migrations gracefully no-op when the extension isn't available, AND have the runtime skip geography queries via an env var. Three changes:
  1. **Init migration** (`20260428150143_init/migration.sql`): wrapped the `CREATE EXTENSION` in a `DO ... EXCEPTION WHEN OTHERS` block that turns the failure into a NOTICE. The rest of the migration (table DDL, no PostGIS dependency) runs unaffected.
  2. **Geography migration** (`20260428150200_postgis_geography/migration.sql`): wrapped each `ALTER TABLE ... ADD COLUMN ... geography(Point, 4326)` and the corresponding `CREATE INDEX ... USING GIST` in their own DO blocks. When PostGIS is missing, the geography columns simply aren't created and the migration succeeds.
  3. **Runtime guard**: added `packages/api/src/lib/postgis.ts` exporting `isPostGisEnabled()` which reads `POSTGIS_ENABLED` env var (defaults to `true` for safe local dev). The two raw-SQL paths that reference `j."location"` or `wp."location"` (`GET /jobs` with lat/lng, and the home feed) check this flag before adding the geography branch. With `POSTGIS_ENABLED=false`, those queries skip the location filter and distance sort, return non-geo results, and never reference the (missing) `location` column.
- Trade-off: radius search and distance sort are no-ops on Railway staging. Workers' job-board queries return all open jobs (filtered by trade and other text fields), not nearest-first. Acceptable for TestFlight smoke-testing but needs a real fix before going wider:
  - Switch the staging Postgres to a provider that supports PostGIS (Supabase, AWS RDS with `rds.allowed_extensions=postgis`, or self-host `postgis/postgis` on Railway as a separate service)
  - OR fall back to ST_DWithin via a different geometry library (PostGIS's `cube` + `earthdistance` modules are sometimes available where `postgis` isn't, but Railway's stock image likely doesn't have those either)
- Lesson: when targeting a managed Postgres provider, never assume optional extensions ship with the base image. Make migrations and runtime code feature-detect the extension and degrade gracefully. The pattern — DO-block exception in migrations + env-var guard in code — is portable to any Postgres-extension dependency (pg_trgm, vector, etc.).

## Issue 15: `railway run` executes locally → can't resolve `*.railway.internal` hostnames

- Trying to seed the staging database from the laptop with `railway run --service blubranch pnpm seed` failed at the first `prisma.trade.upsert()`: `Can't reach database server at postgres.railway.internal:5432`.
- Cause: `railway run` injects the service's environment variables and runs the given command **in your local shell, on your machine**. The injected `DATABASE_URL` references `postgres.railway.internal`, which is a private DNS name that only resolves inside Railway's wireguard mesh — from a laptop, the hostname doesn't exist.
- This wasn't obvious from the CLI's docs. The mental model "railway run = run-as-if-on-Railway" is wrong; it's "run-locally-with-Railway-env-vars-injected." The injected vars *contain* internal-only hostnames that local processes can't reach.
- Fix path A (preferred for one-off ops): use the Postgres service's **public** URL. In the Railway dashboard, on the Postgres service: **Settings → Networking → enable Public Networking** if not already on. After ~30s, the service's **Variables** tab shows a `DATABASE_PUBLIC_URL` (form `postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway`). Use that URL — *not* the internal `${{Postgres.DATABASE_URL}}` reference — when running migrations or seeds from the laptop.
- Fix path B (cleaner long-term): run the operation inside the Railway service container so internal hostnames resolve. `railway ssh --service <name>` opens a shell inside the running container; from there, `cd packages/db && pnpm exec prisma db seed` works because `DATABASE_URL` is already set and `postgres.railway.internal` is reachable. Whether this works depends on the Railway plan and the service's runtime image having a usable shell.
- Lesson: `railway run` is for "I want my local code to run with this service's env vars" (e.g., running a script that hits external APIs like Stripe with the production keys), **not** for "I want this command to execute as if it were inside the deployed container." For the latter, use `railway ssh` or commit the operation as a one-off Railway job.

## Issue 16: `pnpm seed` doesn't resolve from the monorepo root → must filter into a workspace package

- RAILWAY-DEPLOY.md step 8 documented the seed command as `railway run --service blubranch-api pnpm seed`. From the repo root that errors with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL — Command "seed" not found. Did you mean "pnpm semver"?`
- Cause: the root `package.json` has no `seed` script. The `seed` script is defined inside `packages/api/package.json` as `pnpm --filter @blubranch/db exec prisma db seed`. pnpm's recursive resolver looks at the current package's `scripts`, doesn't find `seed`, and bails.
- Fix (the command that actually works): `pnpm --filter @blubranch/api seed` from the repo root. The `--filter` flag tells pnpm "run this script in the named workspace package's scope," which finds the script and runs the inner filter to `@blubranch/db`. Combined with the public-URL approach from Issue 15, the full local-seed invocation is:
  ```bash
  set -a; source .env.seed; set +a   # .env.seed contains DATABASE_URL=<public URL>
  pnpm --filter @blubranch/api seed
  ```
- Considered but skipped: adding `"seed": "pnpm --filter @blubranch/api seed"` to the root `package.json` so the documented command would Just Work. Worth doing eventually for ergonomics; not done in this session because the explicit `--filter` form is more honest about what's actually executing.
- Lesson: in pnpm workspaces, scripts are package-scoped, not repo-scoped. Documenting commands as `pnpm <script>` from the root only works if a top-level alias exists. Either define top-level aliases for every operationally-relevant script, or document commands with the explicit `--filter` form so they're copy-pasteable.

## Issue 17: TextEdit's "rich text by default" + "iCloud save by default" break env-file workflows

- Tried to put a multi-character DB URL into `.env.seed` via TextEdit because terminal paste was misbehaving (Terminal.app variant of clipboard issues). Two macOS defaults bit hard:
  1. TextEdit opens new documents in **Rich Text Format**, which embeds RTF metadata into saved files. `source .env.seed` then reads garbage and `DATABASE_URL` ends up unset (or set to RTF junk).
  2. TextEdit's Save dialog defaults the location to **TextEdit – iCloud**, not the directory the file came from. With `open -e .env.seed` followed by Cmd+S, TextEdit happily saves a *new* file in iCloud Drive named `.env.seed.rtf` and leaves the original empty.
- Fix that worked reliably: skip TextEdit entirely. Write the file directly from the shell with a heredoc, single-quoting the marker so the shell doesn't expand `$` or backticks in the URL:
  ```bash
  cat > .env.seed << 'ENVEOF'
  DATABASE_URL="postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway"
  ENVEOF
  cat .env.seed   # verify
  ```
- If TextEdit really has to be used: **Format → Make Plain Text** (Cmd+Shift+T) before pasting, and in the Save dialog, navigate explicitly to the project directory rather than accepting the iCloud default.
- Lesson: any workflow that involves "paste a secret into a GUI editor on a Mac" is fragile in ways that aren't visible until something downstream fails to parse. Heredoc-from-shell is fewer steps and has no hidden formatting layer.

## Issue 18: Secrets in screenshots/chat = treat as compromised, rotate immediately

- During the seeding workflow, the Postgres `DATABASE_PUBLIC_URL` (with the live password) appeared in a screenshot pasted into a chat with an LLM assistant. The URL is now in chat history that may be retained server-side and is visible to anyone with access to the conversation.
- This is not abstract risk: the public URL grants full read/write to the staging Postgres from anywhere on the internet. Chat retention policies and account-compromise scenarios both turn "in a screenshot" into "in someone else's hands."
- Fix: treat any password that has appeared in a screenshot, paste, log file, or screen-shared session as **already compromised**, regardless of how the receiving channel is described. Rotate the credential the moment the operation that needed it is done. For Railway Postgres: dashboard → Postgres service → Variables → `POSTGRES_PASSWORD` → regenerate. Railway restarts the DB and propagates the new value through `${{Postgres.DATABASE_URL}}` references to dependent services.
- Lesson: build the rotation step into the runbook, not the discipline. RAILWAY-DEPLOY.md should include "rotate `POSTGRES_PASSWORD` after any one-off operation that exposed `DATABASE_PUBLIC_URL`" so it's a checklist item, not something to remember.

---

## Reference: known-good Dockerfile and Railway config

`Dockerfile` (at the **monorepo root**):

```dockerfile
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /app

# Root-level metadata first — fails fast if the build context is wrong
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Whole workspace dirs (per-manifest COPYs broke under BuildKit; see issue 12)
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @blubranch/db exec prisma generate

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"]
```

`railway.toml` also lives at the **monorepo root** and only carries deploy-time settings (`builder = "DOCKERFILE"`, healthcheck, restart policy, watch paths).

Railway dashboard service settings:
- **Source** → connect this repo, branch = `main`
- **Settings → Root Directory** → leave blank
- **Settings → Config-as-Code Path** → leave default (Railway auto-detects `railway.toml` + `nixpacks.toml` at the repo root)
- **Variables** → link `${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`; set `JWT_SECRET`, `NODE_ENV=production`, `PUBLIC_BASE_URL`

`packages/api/package.json` — `tsx` in `dependencies`.
`packages/db/package.json` — `prisma` and `tsx` in `dependencies`.
