/**
 * Admin WhatsApp Controller
 *
 * Full technical management of WhatsApp integrations — PLATFORM ADMIN ONLY.
 *
 * Responsibilities:
 *  - Provisioning channels (phone number, Meta Phone Number ID, WABA ID)
 *  - Pre-activation Meta verification & WABA app subscription
 *  - Diagnostic connection testing (without modifying state)
 *  - Activation and deactivation
 *  - Zero secret exposure in responses or audit logs
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { adminCache } from '../../shared/admin-cache';
import { MetaVerificationService } from './meta-verification.service';

const E164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g. +919405686422)');

const ProvisionSchema = z.object({
  clinicId: z.string().uuid(),
  phoneNumber: E164,
  phoneNumberId: z.string().min(1, 'Meta Phone Number ID is required'),
  wabaId: z.string().min(1, 'WABA ID is required'),
  displayName: z.string().min(1).max(120),
  settings: z.record(z.unknown()).optional(),
});

const UpdateSchema = z.object({
  phoneNumberId: z.string().min(1).optional(),
  wabaId: z.string().min(1).optional(),
  displayName: z.string().min(1).max(120).optional(),
  settings: z.record(z.unknown()).optional(),
});

export class AdminWhatsAppController {
  private readonly metaVerification: MetaVerificationService;

  constructor(
    private readonly prisma: PrismaClient,
    metaVerification?: MetaVerificationService,
  ) {
    this.metaVerification = metaVerification ?? new MetaVerificationService();
  }

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

      // Check for phone number conflicts
      const existingByPhone = await this.prisma.whatsAppIntegration.findFirst({
        where: { phoneNumber: body.phoneNumber, deletedAt: null },
      });
      if (existingByPhone) {
        res.status(409).json({
          success: false,
          error: { code: 'PHONE_NUMBER_EXISTS', message: `Phone number ${body.phoneNumber} is already provisioned.` },
        });
        return;
      }

      // Check for Phone Number ID conflicts
      const existingById = await this.prisma.whatsAppIntegration.findFirst({
        where: { phoneNumberId: body.phoneNumberId, deletedAt: null },
      });
      if (existingById) {
        res.status(409).json({
          success: false,
          error: { code: 'PHONE_NUMBER_ID_EXISTS', message: `Meta Phone Number ID ${body.phoneNumberId} is already provisioned.` },
        });
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
          settings: (body.settings ?? {}) as any,
          status: 'inactive',
          isEnabled: false,
          wabaSubscribed: false,
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
          metadata: { updatedFields: Object.keys(body) },
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

  /**
   * Diagnostic connection test without modifying activation status.
   */
  testConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const integration = await this.prisma.whatsAppIntegration.findFirst({
        where: { id, deletedAt: null },
      });

      if (!integration) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } });
        return;
      }

      const checkResult = await this.metaVerification.runConnectivityCheck({
        wabaId: integration.wabaId,
        phoneNumberId: integration.phoneNumberId,
        phoneNumber: integration.phoneNumber,
      });

      res.json({
        success: checkResult.success,
        data: {
          status: checkResult.status,
          checks: checkResult.checks,
          details: checkResult.details,
          error: checkResult.error,
        },
      });
    } catch (err) { next(err); }
  };

  /**
   * Controlled Activation Workflow:
   * 1. Validate Meta Credentials
   * 2. Validate WABA Access
   * 3. Validate Phone Number ID & E.164 phone
   * 4. Subscribe WABA to Webhooks
   * 5. Verify Subscription
   * 6. Atomically update DB state: isEnabled = true, status = 'active', wabaSubscribed = true
   */
  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser!.adminId;

      const integration = await this.prisma.whatsAppIntegration.findFirst({
        where: { id, deletedAt: null },
      });

      if (!integration) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } });
        return;
      }

      // Run full pre-activation verification pipeline
      const checkResult = await this.metaVerification.runConnectivityCheck({
        wabaId: integration.wabaId,
        phoneNumberId: integration.phoneNumberId,
        phoneNumber: integration.phoneNumber,
      });

      if (!checkResult.success) {
        res.status(422).json({
          success: false,
          status: 'verification_failed',
          checks: checkResult.checks,
          error: checkResult.error || {
            code: 'ACTIVATION_VERIFICATION_FAILED',
            message: 'One or more Meta WhatsApp connectivity checks failed.',
          },
        });
        return;
      }

      // All external checks passed — activate integration in database
      const updated = await this.prisma.whatsAppIntegration.update({
        where: { id },
        data: {
          isEnabled: true,
          status: 'active',
          wabaSubscribed: true,
        },
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'whatsapp.activate',
          entityType: 'WhatsAppIntegration',
          entityId: id,
          tenantId: integration.tenantId,
          clinicId: integration.clinicId,
          metadata: {
            verifiedName: checkResult.details?.verifiedName,
            displayPhoneNumber: checkResult.details?.displayPhoneNumber,
          },
        },
      });

      res.json({
        success: true,
        status: 'active',
        checks: checkResult.checks,
        details: checkResult.details,
        data: { integration: updated },
      });
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
        data: {
          adminId,
          action: 'whatsapp.deactivate',
          entityType: 'WhatsAppIntegration',
          entityId: id,
          tenantId: integration.tenantId,
          clinicId: integration.clinicId,
        },
      });

      res.json({ success: true, data: { integration } });
    } catch (err) { next(err); }
  };
}
