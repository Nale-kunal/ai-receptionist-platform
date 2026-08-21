/**
 * Admin WhatsApp Controller
 *
 * Full technical management of WhatsApp integrations — ADMIN ONLY.
 * This is the only place where phoneNumberId, wabaId, and webhookVerifyToken
 * can be set or viewed. Clinic users cannot access these fields.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { adminCache } from '../../shared/admin-cache';

const E164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format');

const ProvisionSchema = z.object({
  clinicId: z.string().uuid(),
  phoneNumber: E164,
  phoneNumberId: z.string().min(1, 'Meta Phone Number ID is required'),
  wabaId: z.string().min(1, 'WABA ID is required'),
  displayName: z.string().min(1).max(120),
  webhookVerifyToken: z.string().min(8),
  settings: z.record(z.unknown()).optional(),
});

const UpdateSchema = z.object({
  phoneNumberId: z.string().min(1).optional(),
  wabaId: z.string().min(1).optional(),
  displayName: z.string().min(1).max(120).optional(),
  webhookVerifyToken: z.string().min(8).optional(),
  settings: z.record(z.unknown()).optional(),
});

export class AdminWhatsAppController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
      const clinicId = req.query['clinicId'] as string | undefined;
      const PAGE_SIZE = 20;

      const where = {
        deletedAt: null,
        ...(clinicId ? { clinicId } : {}),
      };

      const [integrations, total] = await Promise.all([
        this.prisma.whatsAppIntegration.findMany({
          where,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: 'desc' },
          include: { clinic: { select: { id: true, name: true } } },
        }),
        this.prisma.whatsAppIntegration.count({ where }),
      ]);

      // Admin sees ALL fields — no redaction
      res.json({
        success: true,
        data: {
          integrations,
          pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
        },
      });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const integration = await this.prisma.whatsAppIntegration.findFirst({
        where: { id, deletedAt: null },
        include: { clinic: { select: { id: true, name: true, tenantId: true } } },
      });
      if (!integration) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } });
        return;
      }
      res.json({ success: true, data: { integration } });
    } catch (err) { next(err); }
  };

  provision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = ProvisionSchema.parse(req.body);
      const adminId = req.adminUser!.adminId;

      const clinic = await this.prisma.clinic.findUnique({
        where: { id: body.clinicId },
        select: { id: true, tenantId: true },
      });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const integration = await this.prisma.whatsAppIntegration.create({
        data: {
          tenantId: clinic.tenantId,
          clinicId: body.clinicId,
          phoneNumber: body.phoneNumber,
          phoneNumberId: body.phoneNumberId,
          wabaId: body.wabaId,
          displayName: body.displayName,
          webhookVerifyToken: body.webhookVerifyToken,
          settings: (body.settings ?? {}) as any,
          status: 'inactive',
          isEnabled: false,
        },
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'whatsapp.provision',
          entityType: 'WhatsAppIntegration',
          entityId: integration.id,
          tenantId: clinic.tenantId,
          clinicId: body.clinicId,
          // Never log phoneNumberId, wabaId, or webhookVerifyToken in audit metadata
          metadata: { phoneNumber: body.phoneNumber, displayName: body.displayName },
        },
      });

      res.status(201).json({ success: true, data: { integration } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = UpdateSchema.parse(req.body);
      const adminId = req.adminUser!.adminId;

      const updateData: any = { ...body, updatedAt: new Date() };
      if (body.settings) updateData.settings = body.settings as any;

      const integration = await this.prisma.whatsAppIntegration.update({
        where: { id },
        data: updateData,
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'whatsapp.update',
          entityType: 'WhatsAppIntegration',
          entityId: id,
          tenantId: integration.tenantId,
          clinicId: integration.clinicId,
          metadata: { updatedFields: Object.keys(body).filter(k => k !== 'webhookVerifyToken') },
        },
      });

      res.json({ success: true, data: { integration } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
        return;
      }
      next(err);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser!.adminId;

      const integration = await this.prisma.whatsAppIntegration.update({
        where: { id },
        data: { isEnabled: true, status: 'active' },
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: { adminId, action: 'whatsapp.activate', entityType: 'WhatsAppIntegration', entityId: id, tenantId: integration.tenantId, clinicId: integration.clinicId },
      });

      res.json({ success: true, data: { integration } });
    } catch (err) { next(err); }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser!.adminId;

      const integration = await this.prisma.whatsAppIntegration.update({
        where: { id },
        data: { isEnabled: false, status: 'inactive' },
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: { adminId, action: 'whatsapp.deactivate', entityType: 'WhatsAppIntegration', entityId: id, tenantId: integration.tenantId, clinicId: integration.clinicId },
      });

      res.json({ success: true, data: { integration } });
    } catch (err) { next(err); }
  };
}
