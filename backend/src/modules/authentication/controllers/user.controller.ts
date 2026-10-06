import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService, SoleOwnerProtectionError } from '../services/user.service';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address.'),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  role: z.enum(['clinic_owner', 'doctor', 'receptionist'], {
    errorMap: () => ({ message: 'Role must be Practice Owner (clinic_owner), Dentist (doctor), or Receptionist (receptionist).' }),
  }),
  password: z.string().min(8, 'Password must be at least 8 characters.').optional(),
  clinicId: z.string().uuid().nullable().optional(),
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['clinic_owner', 'doctor', 'receptionist'], {
    errorMap: () => ({ message: 'Role must be Practice Owner (clinic_owner), Dentist (doctor), or Receptionist (receptionist).' }),
  }).optional(),
  status: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  clinicId: z.string().uuid().nullable().optional(),
});

export const TransferOwnershipSchema = z.object({
  targetUserId: z.string().uuid('Valid target user ID is required.'),
});

export const ListUsersQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(1).max(100).default(20),
  ),
  offset: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(0).default(0),
  ),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

interface CachedUsers {
  payload: any;
  expiresAt: number;
}

export class UserController {
  private static userCache = new Map<string, CachedUsers>();
  private static readonly TTL_MS = 15000; // 15-second micro-cache

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of UserController.userCache.keys()) {
        if (key.startsWith(tenantId)) {
          UserController.userCache.delete(key);
        }
      }
    } else {
      UserController.userCache.clear();
    }
  }

  constructor(private readonly service: UserService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = CreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const user = await this.service.createUser({
        tenantId,
        ...parsed.data,
      });

      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;
      res.status(201).json({ success: true, data: safeUser });
    } catch (err) {
      if (err instanceof Error && err.message === 'Email already registered') {
        res.status(409).json({ success: false, error: { code: 'EMAIL_ALREADY_REGISTERED', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;

      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = UpdateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const user = await this.service.updateUser({
        id: req.params['id']!,
        tenantId,
        actorUserId,
        ...parsed.data,
      });

      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;
      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      if (err instanceof SoleOwnerProtectionError) {
        res.status(422).json({ success: false, error: { code: 'SOLE_OWNER_PROTECTION', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public transferOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;

      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const parsed = TransferOwnershipSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const updatedUser = await this.service.transferOwnership({
        tenantId,
        actorUserId,
        targetUserId: parsed.data.targetUserId,
      });

      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = updatedUser as any;
      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      next(err);
    }
  };

  public get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const user = await this.service.getUserById(req.params['id']!, tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;

      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      next(err);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = ListUsersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const cacheKey = `${tenantId}:${parsed.data.role || 'all'}:${parsed.data.status || 'all'}:${parsed.data.search || ''}:${parsed.data.limit || 20}:${parsed.data.offset || 0}`;
      const now = Date.now();
      const cached = UserController.userCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        res.status(200).json({ success: true, data: cached.payload });
        return;
      }

      const users = await this.service.listUsers({
        tenantId,
        ...parsed.data,
      });

      const safeUsers = users.map((u) => {
        const { passwordHash: _, tokenVersion: __, ...safe } = u as any;
        return safe;
      });

      UserController.userCache.set(cacheKey, {
        payload: safeUsers,
        expiresAt: now + UserController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      res.status(200).json({ success: true, data: safeUsers });
    } catch (err) {
      next(err);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;
      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const rawReason = (req.body?.reason || req.query?.reason || '') as string;
      const reason = rawReason && rawReason.trim() ? rawReason.trim() : 'Account access removed by clinic administrator.';

      const user = await this.service.revokeUser(req.params['id']!, tenantId, actorUserId, reason);
      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;

      res.status(200).json({ success: true, data: safeUser });
    } catch (err: any) {
      if (err instanceof SoleOwnerProtectionError || err.code === 'SOLE_OWNER_PROTECTION') {
        res.status(422).json({ success: false, error: { code: 'SOLE_OWNER_PROTECTION', message: err.message } });
        return;
      }
      if (err.code === 'MISSING_REASON' || err.code === 'INVALID_REASON') {
        res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
        return;
      }
      if (err.code === 'CANNOT_DELETE_SELF' || (err instanceof Error && err.message?.includes('own account'))) {
        res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE_SELF', message: err.message } });
        return;
      }
      if (err.code === 'TENANT_ISOLATION_VIOLATION') {
        res.status(403).json({ success: false, error: { code: 'TENANT_ISOLATION_VIOLATION', message: err.message } });
        return;
      }
      if (err.code === 'USER_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;
      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const reason = (req.body?.reason || '') as string;
      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, error: { code: 'MISSING_REASON', message: 'Revocation reason is required.' } });
        return;
      }

      const user = await this.service.revokeUser(req.params['id']!, tenantId, actorUserId, reason);
      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;

      res.status(200).json({ success: true, data: safeUser });
    } catch (err: any) {
      if (err instanceof SoleOwnerProtectionError || err.code === 'SOLE_OWNER_PROTECTION') {
        res.status(422).json({ success: false, error: { code: 'SOLE_OWNER_PROTECTION', message: err.message } });
        return;
      }
      if (err.code === 'MISSING_REASON' || err.code === 'INVALID_REASON') {
        res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
        return;
      }
      if (err.code === 'CANNOT_DELETE_SELF' || (err instanceof Error && err.message?.includes('own account'))) {
        res.status(400).json({ success: false, error: { code: 'CANNOT_DELETE_SELF', message: err.message } });
        return;
      }
      if (err.code === 'TENANT_ISOLATION_VIOLATION') {
        res.status(403).json({ success: false, error: { code: 'TENANT_ISOLATION_VIOLATION', message: err.message } });
        return;
      }
      if (err.code === 'USER_NOT_FOUND') {
        res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const user = await this.service.restoreUser(req.params['id']!, tenantId);
      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;

      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      next(err);
    }
  };

  public suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;
      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const user = await this.service.suspendUser(req.params['id']!, tenantId, actorUserId);
      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;
      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      if (err instanceof SoleOwnerProtectionError) {
        res.status(422).json({ success: false, error: { code: 'SOLE_OWNER_PROTECTION', message: err.message } });
        return;
      }
      if (err instanceof Error && (err.message.includes('cannot suspend') || err.message.includes('already suspended'))) {
        res.status(409).json({ success: false, error: { code: 'INVALID_OPERATION', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;
      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const user = await this.service.reactivateUser(req.params['id']!, tenantId, actorUserId);
      UserController.invalidateCache(tenantId);
      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;
      res.status(200).json({ success: true, data: safeUser });
    } catch (err) {
      if (err instanceof Error && err.message.includes('already active')) {
        res.status(409).json({ success: false, error: { code: 'INVALID_OPERATION', message: err.message } });
        return;
      }
      next(err);
    }
  };

  public forceLogout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const actorUserId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId || (req as any).userId;
      if (!tenantId || !actorUserId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' } });
        return;
      }

      const result = await this.service.forceLogout(req.params['id']!, tenantId, actorUserId);
      UserController.invalidateCache(tenantId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
