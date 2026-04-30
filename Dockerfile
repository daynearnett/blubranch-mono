FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @blubranch/db exec prisma generate
WORKDIR /app/packages/api
EXPOSE ${PORT:-4000}
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../db/prisma/schema.prisma && node --import tsx src/server.ts"]
