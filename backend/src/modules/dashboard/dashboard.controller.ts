import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

interface CachedSummary {
  payload: any;
  etag: string;
  expiresAt: number;
}

export class DashboardController {
  private static cache = new Map<string, CachedSummary>();
  private static readonly TTL_MS = 10000; // 10-second short TTL cache

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Invalidate tenant dashboard cache on mutations (appointments, doctors, patients)
   */
  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      DashboardController.cache.delete(tenantId);
    } else {
      DashboardController.cache.clear();
    }
  }

  public getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const totalStart = performance.now();
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId || (req as any).context?.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is required for dashboard operations.' },
        });
        return;
      }

      const now = Date.now();
      const cached = DashboardController.cache.get(tenantId);

      // Check if cache entry is fresh
      if (cached && cached.expiresAt > now) {
        const clientEtag = req.headers['if-none-match'];
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');

        if (clientEtag === cached.etag) {
          const totalMs = (performance.now() - totalStart).toFixed(2);
          res.setHeader('Server-Timing', `cache;desc="HIT", total;dur=${totalMs}`);
          res.status(304).end();
          return;
        }

        const totalMs = (performance.now() - totalStart).toFixed(2);
        res.setHeader('Server-Timing', `cache;desc="HIT", total;dur=${totalMs}`);
        res.status(200).json(cached.payload);
        return;
      }

      // Execute queries in parallel with selected relation fields and composite indexes
      const dbStart = performance.now();
      const [appointmentsRaw, doctorsRaw, patientsRaw, conversationsRaw] = await Promise.all([
        this.prisma.appointment.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            patientId: true,
            doctorId: true,
            startTime: true,
            endTime: true,
            status: true,
            durationMinutes: true,
            appointmentType: true,
            patient: {
              select: {
                fullName: true,
                phone: true,
              },
            },
            doctor: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
          take: 50,
        }),

        this.prisma.doctor.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            fullName: true,
            specialization: true,
            workingHours: true,
            status: true,
          },
          take: 30,
        }),

        this.prisma.patient.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            dateOfBirth: true,
          },
          take: 50,
        }),

        this.prisma.conversation.findMany({
          where: { tenantId },
          select: {
            id: true,
            callerPhone: true,
            startedAt: true,
            status: true,
            summary: true,
            intent: true,
          },
          orderBy: { startedAt: 'desc' },
          take: 10,
        }),
      ]);
      const dbMs = (performance.now() - dbStart).toFixed(2);

      const appointments = appointmentsRaw.map((a) => {
        const start = new Date(a.startTime);
        const y = start.getFullYear();
        const m = String(start.getMonth() + 1).padStart(2, '0');
        const day = String(start.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const hh = String(start.getHours()).padStart(2, '0');
        const mm = String(start.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        return {
          id: a.id,
          patientId: a.patientId ?? undefined,
          doctorId: a.doctorId ?? undefined,
          patientName: a.patient?.fullName || 'Unknown Patient',
          patientPhone: a.patient?.phone || '',
          doctorName: a.doctor?.fullName || 'Unknown Doctor',
          startTime: a.startTime.toISOString(),
          endTime: a.endTime.toISOString(),
          date: dateStr,
          time: timeStr,
          durationMinutes: a.durationMinutes || 30,
          appointmentType: a.appointmentType || 'checkup',
          status: a.status.toLowerCase(),
        };
      });

      const doctors = doctorsRaw.map((d) => ({
        id: d.id,
        name: d.fullName,
        specialty: d.specialization,
        workingHours: typeof d.workingHours === 'string' ? d.workingHours : '09:00 - 17:00',
        availability: d.status === 'active' ? 'available' : 'busy',
      }));

      const patients = patientsRaw.map((p) => ({
        id: p.id,
        name: p.fullName,
        phone: p.phone,
        email: p.email || '',
        dob: p.dateOfBirth ? p.dateOfBirth.toISOString().split('T')[0] : '',
      }));

      const conversations = conversationsRaw.map((c) => ({
        id: c.id,
        callerPhone: c.callerPhone || 'Unknown Phone',
        startedAt: c.startedAt,
        status: c.status,
        summary: typeof c.summary === 'string' ? { text: c.summary } : c.summary,
        intent: c.intent,
      }));

      const responseData = {
        success: true,
        data: {
          appointments,
          doctors,
          patients,
          conversations,
        },
        requestId: (req as any).requestId || '',
      };

      // Generate ETag and cache entry
      const etag = `W/"${crypto.createHash('md5').update(JSON.stringify(responseData.data)).digest('hex').substring(0, 16)}"`;

      DashboardController.cache.set(tenantId, {
        payload: responseData,
        etag,
        expiresAt: now + DashboardController.TTL_MS,
      });

      const totalMs = (performance.now() - totalStart).toFixed(2);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      res.setHeader('Server-Timing', `db;dur=${dbMs}, total;dur=${totalMs}`);

      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === etag) {
        res.status(304).end();
        return;
      }

      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Fast Granular KPI Metrics Endpoint
   */
  public getKpiMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant required.' } });
        return;
      }

      // Compute today's UTC midnight boundary — explicit UTC to be timezone-safe
      // regardless of what timezone the Node.js process runs in.
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      const [todayApptsCount, pendingConfirmationsCount, todayCallsCount, missedCallsCount] = await Promise.all([
        this.prisma.appointment.count({
          where: { tenantId, deletedAt: null, startTime: { gte: todayStart, lte: todayEnd }, status: { not: 'cancelled' } },
        }),
        this.prisma.appointment.count({
          where: { tenantId, deletedAt: null, status: 'pending' },
        }),
        this.prisma.conversation.count({
          where: { tenantId, startedAt: { gte: todayStart, lte: todayEnd } },
        }),
        this.prisma.conversation.count({
          where: { tenantId, startedAt: { gte: todayStart, lte: todayEnd }, status: { in: ['abandoned', 'failed'] } },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          todayApptsCount,
          pendingConfirmationsCount,
          todayCallsCount,
          missedCallsCount,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Fast Granular Recent Conversations Widget Endpoint
   */
  public getConversationsWidget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant required.' } });
        return;
      }

      const conversations = await this.prisma.conversation.findMany({
        where: { tenantId },
        select: {
          id: true,
          callerPhone: true,
          startedAt: true,
          status: true,
          summary: true,
          intent: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      });

      res.status(200).json({
        success: true,
        data: conversations.map((c) => ({
          id: c.id,
          callerPhone: c.callerPhone || 'Unknown Phone',
          startedAt: c.startedAt,
          status: c.status,
          summary: typeof c.summary === 'string' ? { text: c.summary } : c.summary,
          intent: c.intent,
        })),
      });
    } catch (err) {
      next(err);
    }
  };
}
