/**
 * Shared Authoritative PrismaClient Singleton for Backend API
 *
 * Enforces a single PrismaClient lifecycle across the entire backend process.
 * Configures connection pooling parameters, query logging, and profiling.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env['LOG_QUERIES'] === 'true'
      ? ['query', 'error', 'warn']
      : ['error', 'warn'],
  });

  // Profile queries exceeding threshold
  const slowQueryThresholdMs = parseInt(process.env['SLOW_QUERY_THRESHOLD_MS'] ?? '2000', 10);
  if (slowQueryThresholdMs > 0) {
    client.$use(async (params, next) => {
      const start = performance.now();
      const result = await next(params);
      const duration = performance.now() - start;
      if (duration > slowQueryThresholdMs) {
        const modelName = params.model ?? 'query';
        console.warn(`[PRISMA SLOW QUERY] ${modelName}.${params.action} execution time: ${duration.toFixed(2)}ms`);
      }
      return result;
    });
  }

  return client;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
