import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { InvitationService } from '../services/invitation.service';
import { AuthError } from '../errors/auth.errors';

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

export class InvitationController {
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

  /** GET /invitations/validate?token= */
  public validate = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const token = req.query['token'] as string;
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

      const user = await this.service.acceptInvitation(parsed.data);
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
      res.status(400).json({
        success: false,
        error: {
          code: 'ACCEPTANCE_FAILED',
          message: err.message || 'Invitation acceptance failed.',
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

      const result = await this.service.listInvitations({
        tenantId,
        ...parsed.data,
      });
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

      const stats = await this.service.getInvitationStats(tenantId);
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

      if (!tenantId || !userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_CONTEXT', message: 'Tenant or user context is missing.' },
        });
        return;
      }

      const result = await this.service.resendInvitation(id, tenantId, userId);
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
      const userId = req.user?.userId || (req as any).user?.id || req.context?.user?.userId;

      if (!token) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Invitation token is required.' },
        });
        return;
      }

      await this.service.declineInvitation(token, userId);
      res.status(200).json({ success: true, data: { declined: true } });
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
