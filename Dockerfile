# Dockerfile for the BluBranch API on Railway.
#
# Why a Dockerfile instead of Nixpacks:
#   - Nixpacks' Node provider always inserts an unconditional `RUN npm i`
#     step in stage-0 (regardless of `packageManager` field, custom
#     `[phases.install]`, etc.) which can't parse pnpm's `workspace:*`
#     protocol. We chased that for several deploys before giving up on
#     Nixpacks. See docs/RAILWAY-LESSONS.md issue 10.
#   - With a Dockerfile, every step is explicit. No surprises from a
#     buildpack guessing what we need.
#
# Lives at the monorepo root so the Docker build context covers the whole
# pnpm workspace (lockfile, workspace yaml, all packages).

FROM node:20-bookworm-slim

# Prisma's native query engine needs OpenSSL. ca-certificates is needed
# for outbound HTTPS (Twilio, Stripe, etc.). On Debian both are real apt
# package names — unlike Nix, where ca-certificates is called `cacert`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm via npm. Debian-based images put npm bin on PATH out of the box, so
# `npm i -g pnpm` works reliably here — the Nix PATH-resolution failures
# we hit on Nixpacks (RAILWAY-LESSONS.md issues 2-5) don't apply.
RUN npm install -g pnpm@10

WORKDIR /app

# Copy the entire monorepo so pnpm install can resolve workspace symlinks
# (@blubranch/db, @blubranch/shared) and read pnpm-workspace.yaml +
# pnpm-lock.yaml at the workspace root.
# .dockerignore excludes node_modules, .git, dist artifacts, etc.
COPY . .

# Install all deps. We don't pass --prod=false here because tsx + prisma
# are already in `dependencies` (RAILWAY-LESSONS.md issue 7); a default
# install picks them up. Postinstall hooks (Prisma client generation in
# packages/db) run as part of this step.
RUN pnpm install --frozen-lockfile

# Belt-and-suspenders: regenerate the Prisma client explicitly. The db
# package's postinstall already does this, but pinning it as a real build
# step gives us a clean error message if anything in packages/db/prisma
# is broken (versus a confusing runtime failure later).
RUN pnpm --filter @blubranch/db exec prisma generate

WORKDIR /app/packages/api

# Railway sets PORT dynamically; the API reads process.env.PORT.
EXPOSE 4000

# Migrate then boot. Same start sequence we used under Nixpacks.
# `prisma migrate deploy` is idempotent so a container restart after
# successful migration just no-ops.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"]
