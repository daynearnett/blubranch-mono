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

## Issue 6: Service "Root Directory" must be blank for monorepo + config-as-code path
- Initial Railway service had Root Directory set to `packages/api` (intuitive for a service whose code lives there)
- Build context (`/app`) only contained `packages/api/` files. `cd /app && pnpm install --frozen-lockfile` failed because there was no `pnpm-workspace.yaml` — pnpm just installed `@blubranch/api`'s direct deps and skipped the workspace symlinks, breaking imports of `@blubranch/db` and `@blubranch/shared` at runtime.
- Fix: leave the service's **Root Directory** field blank (build context = repo root) AND set the **Config-as-Code Path** to `packages/api/railway.toml` so Railway still finds the right config file.
- Lesson: in Railway, "Root Directory" controls the *build context*, not just where Railway looks for config. For pnpm-workspace monorepos, the install must run from the workspace root, so the build context has to be the monorepo root.

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

## Configuration recap (known-good)

`packages/api/nixpacks.toml`:
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "openssl", "nodePackages.pnpm"]

[phases.install]
cmds = ["cd /app && pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["cd /app && pnpm --filter @blubranch/db exec prisma generate"]

[start]
cmd = "cd /app/packages/api && npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"
```

Railway dashboard service settings:
- **Source** → connect this repo, branch = `main`
- **Settings → Root Directory** → leave blank
- **Settings → Config-as-Code Path** → `packages/api/railway.toml`
- **Variables** → link `${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`; set `JWT_SECRET`, `NODE_ENV=production`, `PUBLIC_BASE_URL`

`packages/api/package.json` — `tsx` in `dependencies`.
`packages/db/package.json` — `prisma` and `tsx` in `dependencies`.
