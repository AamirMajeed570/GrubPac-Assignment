import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
