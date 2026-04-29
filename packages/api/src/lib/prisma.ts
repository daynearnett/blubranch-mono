import { PrismaClient } from '@blubranch/db';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }
  return prisma;
}
