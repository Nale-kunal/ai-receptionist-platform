import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { InvitationService } from '../services/invitation.service';
import { AuthError } from '../errors/auth.errors';
import { UserRepository } from '../repositories/user.repository';

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

export const CreateInvitationSchema = z.object({
  email: z.string().email('Invalid email address.'),
  roleName: z.enum(['clinic_owner', 'doctor', 'receptionist'], {
    errorMap: () => ({
      message:
        'Role must be Practice Owner (clinic_owner), Dentist (doctor), or Receptionist (receptionist).',
    }),
  }),
  phone: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    )
    .optional(),
  firstName: z.string().min(1, 'First name is required.').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required.').max(100).optional(),
});

export const ListInvitationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'expired', 'revoked', 'all']).default('pending'),
  page: z.preprocess(
    (v) => (v ? parseInt(v as string, 10) : 1),
    z.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    (v) => (v ? parseInt(v as string, 10) : 20),
    z.number().int().min(1).max(100).default(20),
  ),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

interface CachedInvitations {
  payload: any;
  expiresAt: number;
}

export class InvitationController {
  private static invitationCache = new Map<string, CachedInvitations>();
  private static readonly TTL_MS = 15000; // 15-second micro-cache

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of InvitationController.invitationCache.keys()) {
        if (key.startsWith(tenantId)) {
          InvitationController.invitationCache.delete(key);
        }
      }
    } else {
      InvitationController.invitationCache.clear();
    }
  }

  constructor(private readonly service: InvitationService) {}

  /** POST /invitations */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const userId =
        req.user?.userId ||
        (req as any).user?.id ||
        req.context?.user?.userId ||
        (req as any).userId;

      if (!tenantId || !userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' },
        });
        return;
      }

      const parsed = CreateInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }

      const result = await this.service.createInvitation({
        tenantId,
        invitedByUserId: userId,
        email: parsed.data.email,
        roleName: parsed.data.roleName,
        phone: parsed.data.phone,
        notes: parsed.data.notes,
      });

      InvitationController.invalidateCache(tenantId);
      res.status(201).json({
        success: true,
        data: {
          invitationId: result.invitation.id,
          email: result.invitation.email,
          roleName: result.invitation.roleName,
          status: result.invitation.status,
          expiresAt: result.invitation.expiresAt,
          tenantName: result.invitation.tenantName,
          inviteLink: result.inviteLink,
        },
      });
    } catch (err: any) {
      if (err instanceof AuthError || (err.statusCode && err.code)) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
        return;
      }
      if (err.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: { code: 'INVITATION_ALREADY_EXISTS', message: 'A duplicate invitation or user record already exists.' },
        });
        return;
      }
      next(err);
    }
  };

  /** GET /invitations/validate?token= or GET /invitations/:token */
  public validate = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const token = (req.query['token'] as string) || req.params['token'];
      if (!token) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Token query parameter is required.' },
        });
        return;
      }

      const metadata = await this.service.validateInvitationToken(token);
      res.status(200).json({ success: true, data: metadata });
    } catch (err: any) {
      const status = err.statusCode || (err instanceof AuthError ? err.statusCode : 400);
      const code = err.code || 'INVALID_INVITATION_TOKEN';
      res.status(status).json({
        success: false,
        error: {
          code,
          message: err.message || 'Invalid or expired invitation token.',
        },
      });
    }
  };

  /** GET /invitations/:token */
  public getByToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return this.validate(req, res, next);
  };

  /** POST /invitations/accept */
  public accept = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const parsed = AcceptInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }

      const actorUserId =
        req.user?.userId ||
        (req as any).user?.id ||
        req.context?.user?.userId ||
        (req as any).userId;
      const actorEmail =
        req.user?.email ||
        (req as any).user?.email ||
        req.context?.user?.email;

      const user = await this.service.acceptInvitation({
        ...parsed.data,
        actorUserId,
        actorEmail,
      });
      InvitationController.invalidateCache();
      UserRepository.invalidateRelationCache(user.id);
      res.status(201).json({ success: true, data: user });
    } catch (err: any) {
      if (err instanceof AuthError || (err.statusCode && err.code)) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
        return;
      }
      if (err.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: { code: 'USER_ALREADY_REGISTERED', message: 'An account with this email address already exists.' },
        });
        return;
      }
      // Catch Prisma transaction timeout or connection pool exhaustion
      if (
        err.message &&
        (err.message.includes('Transaction') ||
          err.message.includes('timeout') ||
          err.message.includes('timed out') ||
          err.message.includes('expired transaction'))
      ) {
        console.error('[InvitationController] Database transaction timeout during accept:', err);
        res.status(503).json({
          success: false,
          error: {
            code: 'DATABASE_TIMEOUT',
            message: 'The server was unable to complete the transaction in time. Please try again.',
          },
        });
        return;
      }
      console.error('[InvitationController] Unexpected error accepting invitation:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'An unexpected error occurred while processing the invitation. Please try again.',
        },
      });
    }
  };

  /** GET /invitations?status=pending&page=1&limit=20 */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
        });
        return;
      }

      const parsed = ListInvitationsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid query parameters.',
            details: parsed.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }

      const cacheKey = `${tenantId}:list:${parsed.data.status}:${parsed.data.page}:${parsed.data.limit}`;
      const now = Date.now();
      const cached = InvitationController.invitationCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        res.status(200).json({ success: true, data: cached.payload });
        return;
      }

      const result = await this.service.listInvitations({
        tenantId,
        ...parsed.data,
      });

      InvitationController.invitationCache.set(cacheKey, {
        payload: result,
        expiresAt: now + InvitationController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  /** GET /invitations/stats */
  public stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
        });
        return;
      }

      const cacheKey = `${tenantId}:stats`;
      const now = Date.now();
      const cached = InvitationController.invitationCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        res.status(200).json({ success: true, data: cached.payload });
        return;
      }

      const stats = await this.service.getInvitationStats(tenantId);
      InvitationController.invitationCache.set(cacheKey, {
        payload: stats,
        expiresAt: now + InvitationController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  };

  /** DELETE /invitations/:id */
  public revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const userId =
        req.user?.userId ||
        (req as any).user?.id ||
        req.context?.user?.userId ||
        (req as any).userId;
      const id = req.params['id']!;

      if (!tenantId || !userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' },
        });
        return;
      }

      await this.service.revokeInvitation(id, tenantId, userId);
      InvitationController.invalidateCache(tenantId);
      res.status(200).json({ success: true, data: { revoked: true } });
    } catch (err: any) {
      if (err instanceof AuthError || (err.statusCode && err.code)) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
        return;
      }
      next(err);
    }
  };

  /** POST /invitations/:id/resend */
  public resend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || req.context?.tenantId;
      const userId =
        req.user?.userId ||
        (req as any).user?.id ||
        req.context?.user?.userId ||
        (req as any).userId;
      const id = req.params['id']!;
      const clientKey = (
        req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key'] ||
        req.body?.idempotencyKey
      ) as string | undefined;

      if (!tenantId || !userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' },
        });
        return;
      }

      const result = await this.service.resendInvitation(id, tenantId, userId, clientKey);
      InvitationController.invalidateCache(tenantId);
      res.status(200).json({
        success: true,
        data: {
          invitation: {
            id: result.invitation.id,
            email: result.invitation.email,
            roleName: result.invitation.roleName,
            status: result.invitation.status,
            expiresAt: result.invitation.expiresAt,
          },
          inviteLink: result.inviteLink,
        },
      });
    } catch (err: any) {
      if (err instanceof AuthError || (err.statusCode && err.code)) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
        return;
      }
      next(err);
    }
  };

  /** POST /invitations/decline */
  public decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.body?.token || (req.query?.token as string);
      const reason = req.body?.reason;
      const userId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId;

      if (!token) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Invitation token is required.' },
        });
        return;
      }

      if (reason !== undefined && reason !== null && typeof reason !== 'string') {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_FAILED', message: 'Decline reason must be a string.' },
        });
        return;
      }

      if (typeof reason === 'string' && reason.length > 500) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_FAILED', message: 'Decline reason cannot exceed 500 characters.' },
        });
        return;
      }

      const result = await this.service.declineInvitation(token, userId, reason);
      InvitationController.invalidateCache();
      res.status(200).json({ success: true, data: { declined: true, invitation: result } });
    } catch (err: any) {
      if (err instanceof AuthError || (err.statusCode && err.code)) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
        return;
      }
      next(err);
    }
  };
}
