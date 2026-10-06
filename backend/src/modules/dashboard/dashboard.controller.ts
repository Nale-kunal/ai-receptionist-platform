import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

interface CachedSummary {
  payload: any;
  etag: string;
  expiresAt: number;
}

interface CachedKpi {
  payload: any;
  expiresAt: number;
}

interface CachedConversations {
  payload: any;
  expiresAt: number;
}

export class DashboardController {
  private static summaryCache = new Map<string, CachedSummary>();
  private static kpiCache = new Map<string, CachedKpi>();
  private static convCache = new Map<string, CachedConversations>();
  private static readonly TTL_MS = 15000; // 15-second high-speed micro-cache

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Invalidate tenant dashboard caches on mutations (appointments, doctors, patients, calls)
   */
  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of DashboardController.summaryCache.keys()) {
        if (key.startsWith(tenantId)) {
          DashboardController.summaryCache.delete(key);
        }
      }
      for (const key of DashboardController.kpiCache.keys()) {
        if (key.startsWith(tenantId)) {
          DashboardController.kpiCache.delete(key);
        }
      }
      for (const key of DashboardController.convCache.keys()) {
        if (key.startsWith(tenantId)) {
          DashboardController.convCache.delete(key);
        }
      }
    } else {
      DashboardController.summaryCache.clear();
      DashboardController.kpiCache.clear();
      DashboardController.convCache.clear();
    }
  }

  private async resolveDoctor(tenantId: string, email?: string): Promise<{ id: string; fullName: string; specialization: string; workingHours: any; status: string } | null> {
    if (!email) return null;
    return this.prisma.doctor.findFirst({
      where: {
        tenantId,
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        workingHours: true,
        status: true,
      },
    });
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

      const userRole = (req as any).user?.role;
      const userEmail = (req as any).user?.email;
      const isDoctor = userRole === 'doctor';

      let doctorRecord: { id: string; fullName: string; specialization: string; workingHours: any; status: string } | null = null;
      if (isDoctor) {
        doctorRecord = await this.resolveDoctor(tenantId, userEmail);
      }

      const cacheKey = isDoctor
        ? `${tenantId}:doctor:${doctorRecord?.id || (req as any).user?.userId || 'unknown'}`
        : `${tenantId}:all`;

      const now = Date.now();
      const cached = DashboardController.summaryCache.get(cacheKey);

      // Check if cache entry is fresh
      if (cached && cached.expiresAt > now) {
        const clientEtag = req.headers['if-none-match'];
        if (typeof res.setHeader === 'function') {
          res.setHeader('ETag', cached.etag);
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
        }

        if (clientEtag === cached.etag) {
          const totalMs = (performance.now() - totalStart).toFixed(2);
          if (typeof res.setHeader === 'function') {
            res.setHeader('Server-Timing', `cache;desc="HIT", total;dur=${totalMs}`);
          }
          res.status(304).end();
          return;
        }

        const totalMs = (performance.now() - totalStart).toFixed(2);
        if (typeof res.setHeader === 'function') {
          res.setHeader('Server-Timing', `cache;desc="HIT", total;dur=${totalMs}`);
        }
        res.status(200).json(cached.payload);
        return;
      }

      // Execute queries in parallel with selected relation fields and composite indexes
      const dbStart = performance.now();

      const appointmentWhere: any = { tenantId, deletedAt: null };
      const patientWhere: any = { tenantId, deletedAt: null };
      const doctorWhere: any = { tenantId, deletedAt: null };
      const convWhere: any = { tenantId };

      if (isDoctor) {
        if (!doctorRecord) {
          // If doctor record is not configured yet, return empty scoped summary safely
          const emptyResponse = {
            success: true,
            data: {
              appointments: [],
              doctors: [],
              patients: [],
              conversations: [],
            },
            requestId: (req as any).requestId || '',
          };
          res.status(200).json(emptyResponse);
          return;
        }
        appointmentWhere.doctorId = doctorRecord.id;
        patientWhere.appointments = { some: { doctorId: doctorRecord.id, deletedAt: null } };
        doctorWhere.id = doctorRecord.id;
        convWhere.doctorId = doctorRecord.id;
      }

      const [appointmentsRaw, doctorsRaw, patientsRaw, conversationsRaw] = await Promise.all([
        this.prisma.appointment.findMany({
          where: appointmentWhere,
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
          where: doctorWhere,
          select: {
            id: true,
            fullName: true,
            specialization: true,
            workingHours: true,
            status: true,
          },
          take: isDoctor ? 1 : 30,
        }),

        this.prisma.patient.findMany({
          where: patientWhere,
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            dateOfBirth: true,
          },
          take: 50,
        }),

        isDoctor
          ? Promise.resolve([])
          : this.prisma.conversation.findMany({
              where: convWhere,
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
          doctorName: a.doctor?.fullName || (doctorRecord?.fullName ?? 'Unknown Doctor'),
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

      DashboardController.summaryCache.set(cacheKey, {
        payload: responseData,
        etag,
        expiresAt: now + DashboardController.TTL_MS,
      });

      const totalMs = (performance.now() - totalStart).toFixed(2);
      if (typeof res.setHeader === 'function') {
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
        res.setHeader('Server-Timing', `db;dur=${dbMs}, total;dur=${totalMs}`);
      }

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
   * Fast Granular KPI Metrics Endpoint with In-Memory Micro-Caching & Doctor Scoping
   */
  public getKpiMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant required.' } });
        return;
      }

      const userRole = (req as any).user?.role;
      const userEmail = (req as any).user?.email;
      const isDoctor = userRole === 'doctor';

      let doctorRecord: { id: string } | null = null;
      if (isDoctor) {
        doctorRecord = await this.resolveDoctor(tenantId, userEmail);
      }

      const cacheKey = isDoctor
        ? `${tenantId}:doctor:${doctorRecord?.id || (req as any).user?.userId || 'unknown'}`
        : `${tenantId}:all`;

      const nowTime = Date.now();
      const cached = DashboardController.kpiCache.get(cacheKey);
      if (cached && cached.expiresAt > nowTime) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        res.status(200).json(cached.payload);
        return;
      }

      // Compute today's UTC midnight boundary — explicit UTC to be timezone-safe
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      const apptTodayWhere: any = {
        tenantId,
        deletedAt: null,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { not: 'cancelled' },
      };
      const apptPendingWhere: any = {
        tenantId,
        deletedAt: null,
        status: 'pending',
      };

      if (isDoctor) {
        if (!doctorRecord) {
          const emptyPayload = {
            success: true,
            data: {
              todayApptsCount: 0,
              pendingConfirmationsCount: 0,
              todayCallsCount: 0,
              missedCallsCount: 0,
            },
          };
          res.status(200).json(emptyPayload);
          return;
        }
        apptTodayWhere.doctorId = doctorRecord.id;
        apptPendingWhere.doctorId = doctorRecord.id;
      }

      const [todayApptsCount, pendingConfirmationsCount, todayCallsCount, missedCallsCount] = await Promise.all([
        this.prisma.appointment.count({
          where: apptTodayWhere,
        }),
        this.prisma.appointment.count({
          where: apptPendingWhere,
        }),
        isDoctor
          ? Promise.resolve(0)
          : this.prisma.conversation.count({
              where: { tenantId, startedAt: { gte: todayStart, lte: todayEnd } },
            }),
        isDoctor
          ? Promise.resolve(0)
          : this.prisma.conversation.count({
              where: { tenantId, startedAt: { gte: todayStart, lte: todayEnd }, status: { in: ['abandoned', 'failed'] } },
            }),
      ]);

      const payload = {
        success: true,
        data: {
          todayApptsCount,
          pendingConfirmationsCount,
          todayCallsCount,
          missedCallsCount,
        },
      };

      DashboardController.kpiCache.set(cacheKey, {
        payload,
        expiresAt: nowTime + DashboardController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Fast Granular Recent Conversations Widget Endpoint with In-Memory Micro-Caching & Doctor Scoping
   */
  public getConversationsWidget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant required.' } });
        return;
      }

      const userRole = (req as any).user?.role;
      const userEmail = (req as any).user?.email;
      const isDoctor = userRole === 'doctor';

      let doctorRecord: { id: string } | null = null;
      if (isDoctor) {
        doctorRecord = await this.resolveDoctor(tenantId, userEmail);
      }

      const cacheKey = isDoctor
        ? `${tenantId}:doctor:${doctorRecord?.id || (req as any).user?.userId || 'unknown'}`
        : `${tenantId}:all`;

      const nowTime = Date.now();
      const cached = DashboardController.convCache.get(cacheKey);
      if (cached && cached.expiresAt > nowTime) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        res.status(200).json(cached.payload);
        return;
      }

      if (isDoctor) {
        // Doctors do not have access to clinic-wide phone/AI call recordings
        const payload = {
          success: true,
          data: [],
        };
        res.status(200).json(payload);
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

      const payload = {
        success: true,
        data: conversations.map((c) => ({
          id: c.id,
          callerPhone: c.callerPhone || 'Unknown Phone',
          startedAt: c.startedAt,
          status: c.status,
          summary: typeof c.summary === 'string' ? { text: c.summary } : c.summary,
          intent: c.intent,
        })),
      };

      DashboardController.convCache.set(cacheKey, {
        payload,
        expiresAt: nowTime + DashboardController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  };
}
