# Dockerfile for the BluBranch API on Railway.
#
# Lives at the monorepo root. The Docker build context MUST be the repo
# root so that pnpm-lock.yaml + pnpm-workspace.yaml are visible during
# install. If Railway's service "Root Directory" is set to anything
# other than blank/`/`, the build context becomes that subdirectory and
# the explicit COPYs below will fail with a clear `lstat <file>: no
# such file` error before pnpm even runs. See RAILWAY-LESSONS.md issue
# 11 for the diagnostic story.
#
# Why a Dockerfile (not Nixpacks):
#   - Nixpacks's Node provider always runs `RUN npm i` in stage-0 to
#     extract metadata. npm chokes on pnpm's `workspace:*` protocol and
#     the build dies before user-defined phases run. Two days of
#     workarounds didn't help. See RAILWAY-LESSONS.md issue 10.

FROM node:20-bookworm-slim

# Prisma's native query engine needs OpenSSL. ca-certificates is needed
# for outbound HTTPS (Twilio, Stripe, etc.). On Debian both are real apt
# package names — unlike Nix, where ca-certificates is called `cacert`
# (RAILWAY-LESSONS.md issue 1).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm via npm. Debian-based images put the npm bin on PATH out of the
# box, so this works reliably (the Nix PATH-resolution failures we hit
# on Nixpacks — RAILWAY-LESSONS.md issues 2-5 — don't apply here).
RUN npm install -g pnpm@10

WORKDIR /app

# === Stage 1: install ===
# Copy ONLY workspace metadata + per-package manifests first. This:
#   1. Lets Docker cache the install layer when only source files change
#      (much faster iterative builds).
#   2. Fails LOUDLY and IMMEDIATELY if the build context is wrong: any
#      missing file produces `ERROR: failed to compute cache key: lstat
#      <name>: no such file or directory` — clearer than waiting for
#      ERR_PNPM_NO_LOCKFILE three steps later.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install with workspace context. Postinstall hooks (e.g. packages/db's
# `prisma generate`) attempt to run but will silently no-op for the db
# package because schema.prisma isn't copied yet (the hook uses
# `|| true`). The explicit `prisma generate` after the source COPY
# below regenerates the client correctly.
RUN pnpm install --frozen-lockfile

# === Stage 2: source ===
# Bring in actual source after the install layer so source changes
# don't invalidate the deps cache. `.dockerignore` excludes
# node_modules, so the install layer's node_modules survives.
COPY . .

# Generate the Prisma client now that schema.prisma is in /app.
RUN pnpm --filter @blubranch/db exec prisma generate

# === Stage 3: runtime ===
WORKDIR /app/packages/api

EXPOSE 4000

# Migrate then boot. Same start sequence we used under Nixpacks.
# `prisma migrate deploy` is idempotent so a container restart after
# successful migration just no-ops.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"]
