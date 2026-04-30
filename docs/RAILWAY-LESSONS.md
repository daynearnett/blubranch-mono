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
