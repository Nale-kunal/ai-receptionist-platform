/**
 * Admin Audit Logs Controller
 */

import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';

const PAGE_SIZE = 50;

export class AdminAuditController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
      const adminId = req.query['adminId'] as string | undefined;
      const tenantId = req.query['tenantId'] as string | undefined;
      const action = req.query['action'] as string | undefined;

      const where = {
        ...(adminId ? { adminId } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(action ? { action: { contains: action } } : {}),
      };

      const [logs, total] = await Promise.all([
        this.prisma.adminAuditLog.findMany({
          where,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { occurredAt: 'desc' },
          include: { admin: { select: { email: true, displayName: true } } },
        }),
        this.prisma.adminAuditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
        },
      });
    } catch (err) { next(err); }
  };
}
