import { PrismaClient } from './generated/client/index.js';

export * from './generated/client/index.js';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
