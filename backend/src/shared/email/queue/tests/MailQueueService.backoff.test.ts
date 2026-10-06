/**
 * MailQueueService — Database Resilience & Backoff Unit Tests
 *
 * Verifies that:
 * 1. Database errors (P1001, P1002, P1017, ETIMEDOUT, ECONNREFUSED) are correctly classified.
 * 2. The worker enters exponential backoff during DB outages instead of hammering.
 * 3. The worker automatically recovers when the database becomes reachable again.
 * 4. getMetrics() returns safe fallbacks during database outages without crashing.
 */

import { MailQueueService, isDbConnectivityError } from '../MailQueueService';
import type { IEmailProvider } from '../../interfaces/IEmailProvider';
import type { PrismaClient } from '@prisma/client';

describe('MailQueueService — Database Resilience & Backoff', () => {
  let mockProvider: jest.Mocked<IEmailProvider>;
  let mockPrisma: any;
  let service: MailQueueService;

  beforeEach(() => {
    jest.useFakeTimers();

    mockProvider = {
      sendEmail: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
    } as any;

    mockPrisma = {
      mailJob: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockResolvedValue({ id: 'job-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'ntf-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'ntf-1' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    service = new MailQueueService(mockProvider, mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    service.shutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('isDbConnectivityError', () => {
    it('should classify Prisma P1001 (cannot reach DB) as connectivity error', () => {
      const err = { code: 'P1001', message: "Can't reach database server at host:5432" };
      expect(isDbConnectivityError(err)).toBe(true);
    });

    it('should classify Prisma P1002 (DB server timeout) as connectivity error', () => {
      const err = { code: 'P1002', message: 'Database server timed out' };
      expect(isDbConnectivityError(err)).toBe(true);
    });

    it('should classify Prisma P1017 (server closed connection) as connectivity error', () => {
      const err = { code: 'P1017', message: 'Server has closed the connection' };
      expect(isDbConnectivityError(err)).toBe(true);
    });

    it('should classify ECONNREFUSED and ETIMEDOUT network errors as connectivity errors', () => {
      expect(isDbConnectivityError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe(true);
      expect(isDbConnectivityError(new Error('connect ETIMEDOUT'))).toBe(true);
    });

    it('should not classify application / validation errors as DB connectivity errors', () => {
      expect(isDbConnectivityError(new Error('Invalid email recipient'))).toBe(false);
      expect(isDbConnectivityError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
      expect(isDbConnectivityError(null)).toBe(false);
    });
  });

  describe('Worker Outage Backoff & Automatic Recovery', () => {
    it('should back off and avoid tight-looping when $queryRaw throws P1001', async () => {
      const dbError = new Error("Can't reach database server at ep-test.neon.tech:5432");
      (dbError as any).code = 'P1001';

      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      await service.initialize();

      // First tick occurs after initial poll interval (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

      // Advance by only 500ms: worker should NOT have run again because it is in backoff (min 2000ms)
      await jest.advanceTimersByTimeAsync(500);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

      // Advance by another 2500ms (total 3000ms from tick 1): second backoff tick should run
      await jest.advanceTimersByTimeAsync(2500);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should automatically recover and resume normal interval once DB becomes reachable', async () => {
      const dbError = new Error("Can't reach database server at ep-test.neon.tech:5432");
      (dbError as any).code = 'P1001';

      // First call fails, second call succeeds
      mockPrisma.$queryRaw
        .mockRejectedValueOnce(dbError)
        .mockResolvedValueOnce([]);

      await service.initialize();

      // Tick 1 fails -> enters backoff
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

      // Advance through backoff period -> Tick 2 runs and succeeds
      await jest.advanceTimersByTimeAsync(3000);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);

      // After recovery, normal 1000ms poll interval resumes
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    });
  });

  describe('getMetrics during database failure', () => {
    it('should return safe fallback metrics without throwing when count queries fail', async () => {
      mockPrisma.mailJob.count.mockRejectedValue(new Error('DB unreachable'));

      const metrics = await service.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.queueDepth).toBe(0);
      expect(metrics.pendingJobs).toBe(0);
      expect(metrics.deliveredJobs).toBe(0);
    });
  });
});
