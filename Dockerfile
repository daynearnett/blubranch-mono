FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @blubranch/db exec prisma generate
WORKDIR /app/packages/api
EXPOSE ${PORT:-4000}
CMD ["sh", "-c", "echo '=== BluBranch API boot ===' && echo \"PORT=$PORT\" && echo \"DATABASE_URL set: $(test -n \"$DATABASE_URL\" && echo yes || echo no)\" && echo \"Working dir: $(pwd)\" && ls -la ../db/prisma/schema.prisma 2>&1 && echo '=== Running migration ===' && npx prisma migrate reset --schema=../db/prisma/schema.prisma --force 2>&1 && echo '=== Migration done, starting server ===' && node --import tsx src/server.ts 2>&1"]
