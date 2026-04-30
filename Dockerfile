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

# Copy root-level workspace metadata first. These four files MUST exist
# at the build context root — if any is missing, Docker fails here with
# `ERROR: failed to compute cache key: lstat <name>: no such file or
# directory` instead of waiting until pnpm errors out. A failure on one
# of these COPYs means Railway's "Root Directory" service setting is
# wrong (RAILWAY-LESSONS.md issue 11).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy entire workspace trees. We tried per-manifest COPYs (e.g.
# `COPY packages/shared/package.json ./packages/shared/`) for finer
# install-layer caching, but BuildKit choked on those with
# "failed to calculate checksum... not found" even though the files
# clearly existed. Trading caching for reliability — see
# RAILWAY-LESSONS.md issue 12. .dockerignore still filters
# node_modules, dist, .expo, etc.
COPY apps ./apps
COPY packages ./packages

# Install with workspace context. Postinstall hooks (e.g. packages/db's
# `prisma generate`) run here — schema.prisma is already in place from
# the COPY above, so the client is generated as part of install.
RUN pnpm install --frozen-lockfile

# Belt-and-suspenders: regenerate the Prisma client explicitly. The
# postinstall above should have done it, but pinning it as a real build
# step gives us a clean error if anything in packages/db/prisma is
# broken (instead of a confusing runtime failure later).
RUN pnpm --filter @blubranch/db exec prisma generate

WORKDIR /app/packages/api

EXPOSE 4000

# Migrate then boot. Same start sequence we used under Nixpacks.
# `prisma migrate deploy` is idempotent so a container restart after
# successful migration just no-ops.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"]
