/**
 * Admin Clinics Controller
 *
 * Cross-tenant clinic management for the Platform Super Admin.
 * Can list, view, update, suspend, and activate clinics across all tenants.
 *
 * Clinic status values (from Prisma schema):
 *   'pending_setup' — newly created, not yet fully configured
 *   'active'        — live and operational
 *   'suspended'     — access blocked by platform admin
 *
 * NOTE: The Clinic model uses a `status` string field.
 *       There is NO `isActive` boolean field on Clinic.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { adminCache } from '../../shared/admin-cache';

const UpdateClinicSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  // NOTE: Do NOT include `isActive` — it does not exist on the Clinic model.
  // Use POST /clinics/:id/suspend and POST /clinics/:id/activate instead.
});

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(200),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
  ownerPassword: z.string().min(8),
  timezone: z.string().default('UTC'),
  country: z.string().default('US'),
});

const PAGE_SIZE = 20;

export class AdminClinicController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
      const search = (req.query['search'] as string) ?? '';
      const tenantId = req.query['tenantId'] as string | undefined;
      const statusFilter = req.query['status'] as string | undefined;

      const where = {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      };

      const [clinics, total] = await Promise.all([
        this.prisma.clinic.findMany({
          where,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: { select: { id: true, name: true } },
            _count: { select: { doctors: true, patients: true, appointments: true } },
          },
        }),
        this.prisma.clinic.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          clinics,
          pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const clinic = await this.prisma.clinic.findFirst({
        where: { id, deletedAt: null },
        include: {
          tenant: { select: { id: true, name: true } },
          _count: { select: { doctors: true, patients: true, appointments: true } },
        },
      });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }
      res.json({ success: true, data: { clinic } });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = UpdateClinicSchema.parse(req.body);
      const adminId = req.adminUser!.adminId;

      // Verify clinic exists
      const existing = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const clinic = await this.prisma.$transaction(async (tx: any) => {
        const updatedClinic = await tx.clinic.update({ where: { id }, data: body });
        if (body.name && body.name.trim().length > 0) {
          await tx.tenant.update({ where: { id: existing.tenantId }, data: { name: body.name.trim() } });
        }
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'clinic.update',
            entityType: 'Clinic',
            entityId: id,
            tenantId: existing.tenantId,
            metadata: body,
          },
        });
        return updatedClinic;
      });

      adminCache.invalidateAll();

      res.json({ success: true, data: { clinic } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
        return;
      }
      next(err);
    }
  };

  suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser!.adminId;

      // Verify clinic exists and check current state
      const existing = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }
      if (existing.status === 'suspended') {
        res.status(409).json({ success: false, error: { code: 'INVALID_STATE', message: 'Clinic is already suspended' } });
        return;
      }

      const clinic = await this.prisma.$transaction(async (tx: any) => {
        // 1. Update clinic status to suspended
        const updatedClinic = await tx.clinic.update({ where: { id }, data: { status: 'suspended' } });

        // 2. Update tenant status to suspended
        await tx.tenant.update({ where: { id: existing.tenantId }, data: { status: 'suspended' } });

        // 3. Immediately revoke all active sessions for this tenant
        await tx.session.updateMany({
          where: { tenantId: existing.tenantId, status: 'active' },
          data: { status: 'revoked' },
        });

        // 4. Increment tokenVersion on all users of this tenant for instant global JWT invalidation
        await tx.user.updateMany({
          where: { tenantId: existing.tenantId },
          data: { tokenVersion: { increment: 1 } },
        });

        // 5. Create real immutable audit log
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'clinic.suspend',
            entityType: 'Clinic',
            entityId: id,
            tenantId: existing.tenantId,
            metadata: { reason: req.body?.reason ?? null, previousStatus: existing.status },
          },
        });

        return updatedClinic;
      });

      adminCache.invalidateAll();

      res.json({ success: true, data: { clinic } });
    } catch (err) {
      next(err);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser!.adminId;

      // Verify clinic exists and check current state
      const existing = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }
      if (existing.status === 'active') {
        res.status(409).json({ success: false, error: { code: 'INVALID_STATE', message: 'Clinic is already active' } });
        return;
      }

      const clinic = await this.prisma.$transaction(async (tx: any) => {
        // 1. Update clinic status to active
        const updatedClinic = await tx.clinic.update({ where: { id }, data: { status: 'active' } });

        // 2. Update tenant status to active
        await tx.tenant.update({ where: { id: existing.tenantId }, data: { status: 'active' } });

        // 3. Create real immutable audit log
        await tx.adminAuditLog.create({
          data: {
            adminId,
            action: 'clinic.activate',
            entityType: 'Clinic',
            entityId: id,
            tenantId: existing.tenantId,
            metadata: { previousStatus: existing.status },
          },
        });

        return updatedClinic;
      });

      adminCache.invalidateAll();

      res.json({ success: true, data: { clinic } });
    } catch (err) {
      next(err);
    }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { tenantId: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      // Users are scoped by tenantId AND clinicId to avoid cross-tenant data leaks
      const users = await this.prisma.user.findMany({
        where: { tenantId: clinic.tenantId, clinicId: id, deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: { users } });
    } catch (err) {
      next(err);
    }
  };

  getDoctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      // Verify clinic exists
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const doctors = await this.prisma.doctor.findMany({
        where: { clinicId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: { doctors } });
    } catch (err) {
      next(err);
    }
  };

  getPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));

      // Verify clinic exists
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const [patients, total] = await Promise.all([
        this.prisma.patient.findMany({
          where: { clinicId: id, deletedAt: null },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.patient.count({ where: { clinicId: id, deletedAt: null } }),
      ]);
      res.json({ success: true, data: { patients, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } } });
    } catch (err) {
      next(err);
    }
  };

  getAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));

      // Verify clinic exists
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const [appointments, total] = await Promise.all([
        this.prisma.appointment.findMany({
          where: { clinicId: id, deletedAt: null },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: 'desc' },
          include: {
            patient: { select: { firstName: true, lastName: true, fullName: true } },
            // Doctor model uses fullName / displayName — NOT firstName / lastName
            doctor: { select: { fullName: true, displayName: true } },
          },
        }),
        this.prisma.appointment.count({ where: { clinicId: id, deletedAt: null } }),
      ]);
      res.json({ success: true, data: { appointments, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } } });
    } catch (err) {
      next(err);
    }
  };

  getWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      // Verify clinic exists
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const integrations = await this.prisma.whatsAppIntegration.findMany({
        where: { clinicId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      // Admin can see ALL fields including phoneNumberId, wabaId, webhookVerifyToken
      res.json({ success: true, data: { integrations } });
    } catch (err) {
      next(err);
    }
  };

  getConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));

      // Verify clinic exists
      const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!clinic) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        return;
      }

      const [conversations, total] = await Promise.all([
        this.prisma.conversation.findMany({
          where: { clinicId: id, deletedAt: null },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.conversation.count({ where: { clinicId: id, deletedAt: null } }),
      ]);
      res.json({ success: true, data: { conversations, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } } });
    } catch (err) {
      next(err);
    }
  };

  createTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = CreateTenantSchema.parse(req.body);
      const adminId = req.adminUser!.adminId;

      const slug = body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic';

      // Check existing email — must be done BEFORE the transaction to give a clean error
      const existingUser = await this.prisma.user.findUnique({ where: { email: body.ownerEmail } });
      if (existingUser) {
        res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists' } });
        return;
      }

      const passwordHash = await argon2.hash(body.ownerPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });

      /**
       * Transaction ordering:
       * 1. Create Tenant
       * 2. Create Clinic (requires ownerId → must reference owner User)
       *    BUT Clinic.ownerId is required and owner User.clinicId points to Clinic.
       *    Chicken-and-egg problem — solved by:
       *    a) Create User with clinicId = null first (User.clinicId is nullable in schema)
       *    b) Create Clinic with ownerId = user.id, tenantId = tenant.id
       *    c) Update User to set clinicId = clinic.id
       */
      const result = await this.prisma.$transaction(async (tx: any) => {
        // Step 1 — Create Tenant
        const tenant = await tx.tenant.create({
          data: {
            name: body.name,
            slug: `${slug}-${Date.now().toString(36)}`,
            status: 'active',
            subscriptionPlan: 'pro',
            timezone: body.timezone,
            country: body.country,
          },
        });

        // Step 2 — Create Owner User (no clinicId yet — clinicId is nullable on User)
        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            clinicId: null, // Will be set after clinic is created
            email: body.ownerEmail,
            passwordHash,
            firstName: body.ownerFirstName,
            lastName: body.ownerLastName,
            role: 'clinic_owner',
            status: 'active',
            emailVerified: true,
          },
        });

        // Step 3 — Create Clinic (now we have ownerId)
        const clinicSlug = tenant.slug; // reuse tenant slug for clinic
        const clinic = await tx.clinic.create({
          data: {
            tenantId: tenant.id,
            ownerId: owner.id,   // Required field — now available
            name: body.name,
            slug: clinicSlug,
            timezone: body.timezone,   // Required field — from request or default
            country: body.country,     // Required field — from request or default
            status: 'active',          // Use string status — NO isActive boolean on Clinic
          },
        });

        // Step 4 — Update Owner User to point to the clinic
        await tx.user.update({
          where: { id: owner.id },
          data: { clinicId: clinic.id },
        });

        return { tenant, clinic, owner };
      });

      adminCache.invalidateAll();

      await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          tenantId: result.tenant.id,
          clinicId: result.clinic.id,
          action: 'tenant.create',
          entityType: 'Tenant',
          entityId: result.tenant.id,
          metadata: { name: body.name, ownerEmail: body.ownerEmail },
        },
      });

      res.status(201).json({
        success: true,
        data: {
          tenant: result.tenant,
          clinic: result.clinic,
          owner: {
            id: result.owner.id,
            email: result.owner.email,
            firstName: result.owner.firstName,
            lastName: result.owner.lastName,
          },
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
        return;
      }
      next(err);
    }
  };
}
