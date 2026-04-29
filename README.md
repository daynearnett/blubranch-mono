# BluBranch monorepo

> The professional network built for the Blue Collar.

Phase 0 scaffold. See [CLAUDE.md](./CLAUDE.md) for project context and [docs/](./docs) for architecture/data-model/roadmap.

## Prerequisites

- Node.js >= 20
- pnpm >= 10 (`npm install -g pnpm`)
- Docker (for local PostgreSQL + Redis)

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d                 # postgres (postgis) + redis
pnpm --filter @blubranch/db prisma:migrate    # creates schema in dev DB
pnpm dev                              # runs all dev tasks via turbo
```

## Workspace layout

- `apps/mobile` — Expo (React Native, SDK 52, new architecture, web export)
- `apps/admin` — Vite + React admin panel
- `packages/api` — Fastify API server
- `packages/shared` — Zod schemas + shared TypeScript types
- `packages/db` — Prisma schema, migrations, generated client

## Common commands

```bash
pnpm build              # build all packages
pnpm dev                # run all dev servers
pnpm lint               # eslint across the monorepo
pnpm test               # run tests across the monorepo
pnpm typecheck          # typecheck all packages

pnpm dev --filter @blubranch/api      # run API only
pnpm dev --filter @blubranch/admin    # run admin only
pnpm dev --filter @blubranch/mobile   # run Expo only

pnpm db:generate        # prisma generate
pnpm db:migrate         # prisma migrate dev
pnpm db:studio          # prisma studio
```

## Health check

With the API running:

```bash
curl http://localhost:4000/health
# -> {"status":"ok"}
```
