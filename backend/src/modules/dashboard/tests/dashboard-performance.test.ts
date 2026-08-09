import { DashboardController } from '../dashboard.controller';

describe('Dashboard Performance & Latency Optimization', () => {
  let mockPrisma: any;
  let controller: DashboardController;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    DashboardController.invalidateCache();

    mockPrisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      doctor: { findMany: jest.fn().mockResolvedValue([]) },
      patient: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    controller = new DashboardController(mockPrisma);

    req = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it('should execute parallel Prisma queries and set ETag + Server-Timing headers on first call', async () => {
    await controller.getSummary(req, res, next);

    expect(mockPrisma.appointment.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.doctor.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.patient.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversation.findMany).toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^W\/"/));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
    expect(res.setHeader).toHaveBeenCalledWith('Server-Timing', expect.stringContaining('db;dur='));
  });

  it('should serve from short-TTL in-memory cache without hitting DB on repeat requests', async () => {
    await controller.getSummary(req, res, next);
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledTimes(1);

    // Second call within 5-second TTL
    const res2: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    await controller.getSummary(req, res2, next);

    // Database should NOT be queried a second time
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledTimes(1);
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(res2.setHeader).toHaveBeenCalledWith('Server-Timing', expect.stringContaining('cache;desc="HIT"'));
  });

  it('should return HTTP 304 Not Modified when client provides matching If-None-Match ETag', async () => {
    await controller.getSummary(req, res, next);

    const etagCall = res.setHeader.mock.calls.find((call: any[]) => call[0] === 'ETag');
    const generatedEtag = etagCall[1];

    const req304: any = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      headers: { 'if-none-match': generatedEtag },
    };

    const res304: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    await controller.getSummary(req304, res304, next);

    expect(res304.status).toHaveBeenCalledWith(304);
    expect(res304.end).toHaveBeenCalled();
    expect(res304.json).not.toHaveBeenCalled();
  });

  it('should re-query database after cache invalidation', async () => {
    await controller.getSummary(req, res, next);
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledTimes(1);

    DashboardController.invalidateCache('00000000-0000-0000-0000-000000000001');

    const res3: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    await controller.getSummary(req, res3, next);

    expect(mockPrisma.appointment.findMany).toHaveBeenCalledTimes(2);
  });

  it('should calculate KPI counts in parallel via getKpiMetrics', async () => {
    mockPrisma.appointment.count = jest.fn().mockResolvedValue(5);
    mockPrisma.conversation.count = jest.fn().mockResolvedValue(2);

    await controller.getKpiMetrics(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        todayApptsCount: 5,
        pendingConfirmationsCount: 5,
        todayCallsCount: 2,
        missedCallsCount: 2,
      },
    });
  });

  it('should fetch recent conversations via getConversationsWidget', async () => {
    mockPrisma.conversation.findMany = jest.fn().mockResolvedValue([
      { id: 'conv-1', callerPhone: '+18005550199', startedAt: new Date(), status: 'completed', summary: 'Checkup appointment requested', intent: 'booking' }
    ]);

    await controller.getConversationsWidget(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          id: 'conv-1',
          callerPhone: '+18005550199',
          status: 'completed',
        })
      ],
    });
  });
});
