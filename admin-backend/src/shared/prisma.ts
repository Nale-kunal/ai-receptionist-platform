/**
 * Admin Backend — Shared Prisma Client
 *
 * Singleton PrismaClient for the admin-backend process.
 * The admin-backend uses the SAME database as the main backend
 * (same DATABASE_URL) but runs as a completely separate process
 * with its own JWT secrets and auth boundary.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
