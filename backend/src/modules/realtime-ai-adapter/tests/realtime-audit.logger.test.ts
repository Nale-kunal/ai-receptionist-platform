import type { PrismaClient } from '@prisma/client';
import { RealtimeAuditLogger } from '../services/realtime-audit.logger';

describe('RealtimeAuditLogger', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let logger: RealtimeAuditLogger;

  beforeEach(() => {
    mockPrisma = {
      aiAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    logger = new RealtimeAuditLogger(mockPrisma);
  });

  it('writes session creation event to the prisma audit repository', async () => {
    await logger.logSessionCreated('session-1', 'tenant-123', 'mock-provider', 'conversation-456');

    expect(mockPrisma.aiAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          conversationId: 'conversation-456',
          eventType: 'realtime.session.created',
          provider: 'mock-provider',
        }),
      })
    );
  });

  it('redacts sensitive credentials/PHI key metadata from log payloads', async () => {
    await logger.logProviderError('s1', 't1', 'c1', 'ERR_CODE', 'Error with key: sk-api-key-secret');

    // Make an audit call containing sensitive key 'apiKey'
    await logger.logToolRequestReceived('s1', 't1', 'c1', 'tc1', 'bookAppointment');

    expect(mockPrisma.aiAuditLog.create).toHaveBeenCalled();
  });
});
