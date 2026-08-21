/**
 * Admin Auth Controller
 *
 * Handles HTTP layer for admin authentication.
 * Refresh token delivered via HttpOnly cookie.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AdminAuthService } from './admin-auth.service';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
});

const REFRESH_COOKIE = 'admin_refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/admin/auth',
};

export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = LoginSchema.parse(req.body);
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
      const userAgent = req.headers['user-agent'] ?? 'unknown';

      const result = await this.authService.login({ ...body, ipAddress, userAgent });

      // Set refresh token as HttpOnly cookie
      res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          admin: result.admin,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.errors } });
        return;
      }
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
      if (!rawToken) {
        res.status(401).json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' } });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
      const { accessToken, refreshToken } = await this.authService.refreshTokens(rawToken, ipAddress);

      res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
      res.status(200).json({ success: true, data: { accessToken } });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, adminId } = (req as any).adminUser ?? {};
      if (sessionId && adminId) {
        await this.authService.logout(sessionId, adminId);
      }
      res.clearCookie(REFRESH_COOKIE, { path: COOKIE_OPTIONS.path });
      res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { adminId } = (req as any).adminUser ?? {};
      if (!adminId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const body = ChangePasswordSchema.parse(req.body);
      await this.authService.changePassword(adminId, body.currentPassword, body.newPassword);

      // Clear refresh cookie — user must log in fresh
      res.clearCookie(REFRESH_COOKIE, { path: COOKIE_OPTIONS.path });
      res.status(200).json({ success: true, data: { message: 'Password changed. Please log in again.' } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.errors } });
        return;
      }
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUser = (req as any).adminUser;
      res.status(200).json({ success: true, data: { admin: adminUser } });
    } catch (err) {
      next(err);
    }
  };
}
