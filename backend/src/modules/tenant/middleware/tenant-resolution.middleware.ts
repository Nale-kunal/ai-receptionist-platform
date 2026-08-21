/**
 * Tenant Resolution Middleware
 *
 * Resolves the active tenant context for incoming requests.
 * Enforces status-based isolation rules (block suspended, block writes on archived).
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TenantService } from '../services/tenant.service';
import {
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
  TENANT_STATUS_DELETED,
} from '../constants/tenant.constants';
import { SafeTenant } from '../types/tenant.types';

// Simple UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantResolverOptions {
  /** Injected mapping function for Twilio phone numbers or API keys */
  telephonyMapper?: (phoneNumber: string) => Promise<string | null>;
  apiKeyMapper?: (apiKey: string) => Promise<string | null>;
  clinicChecker?: (clinicId: string) => Promise<{ status: string } | null>;
}

// In-memory tenant resolution cache (15-second TTL)
interface CachedTenantResolution {
  tenant: SafeTenant;
  clinicStatus?: string;
  expiresAt: number;
}

const tenantResolutionCache = new Map<string, CachedTenantResolution>();
const TENANT_RESOLUTION_TTL_MS = 15000;

export function invalidateTenantResolutionCache(tenantIdOrSlug?: string): void {
  if (tenantIdOrSlug) {
    for (const [key, val] of tenantResolutionCache.entries()) {
      if (key === tenantIdOrSlug || val.tenant.id === tenantIdOrSlug || val.tenant.slug === tenantIdOrSlug) {
        tenantResolutionCache.delete(key);
      }
    }
  } else {
    tenantResolutionCache.clear();
  }
}

export function createTenantResolutionMiddleware(
  tenantService: TenantService,
  options: TenantResolverOptions = {},
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let resolvedIdOrSlug: string | null = null;

      // 1. JWT Payload
      if (req.user?.tenantId) {
        resolvedIdOrSlug = req.user.tenantId;
      }

      // 2. Route Parameter Override (for admin routes/actions)
      // Check if user is super_admin before permitting override
      const isAdminOverrideAllowed = req.user?.role === 'super_admin';
      const parameterTenant = (req.query['tenantId'] as string) || (req.params['tenantId'] as string) || (req.headers['x-tenant-id'] as string);
      
      if (parameterTenant) {
        if (isAdminOverrideAllowed || !req.user) {
          resolvedIdOrSlug = parameterTenant;
        } else {
          // Reject cross-tenant access for non-admins
          if (req.user.tenantId !== parameterTenant) {
            res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied. Cross-tenant access prohibited.',
                details: [],
              },
              requestId: req.requestId ?? '',
            });
            return;
          }
        }
      }

      // 3. API Key Resolver
      const authHeader = req.headers['authorization'];
      if (!resolvedIdOrSlug && authHeader?.startsWith('ApiKey ')) {
        const apiKey = authHeader.slice(7).trim();
        if (options.apiKeyMapper) {
          resolvedIdOrSlug = await options.apiKeyMapper(apiKey);
        }
      }

      // 4. Twilio Telephony Mapping
      // Twilio requests usually post "To" or "From" containing target numbers
      const twilioTo = (req.body?.To as string | undefined) || (req.query?.To as string | undefined);
      if (!resolvedIdOrSlug && twilioTo && options.telephonyMapper) {
        resolvedIdOrSlug = await options.telephonyMapper(twilioTo);
      }

      // 5. Custom header mapping by slug
      const tenantSlugHeader = req.headers['x-tenant-slug'] as string | undefined;
      if (!resolvedIdOrSlug && tenantSlugHeader) {
        resolvedIdOrSlug = tenantSlugHeader;
      }

      if (!resolvedIdOrSlug) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TENANT_CONTEXT_REQUIRED',
            message: 'A valid tenant context is required to complete this request.',
            details: [],
          },
          requestId: req.requestId ?? '',
        });
        return;
      }

      // Check fast in-memory resolution cache
      const now = Date.now();
      const cached = tenantResolutionCache.get(resolvedIdOrSlug);
      let tenant: SafeTenant | null = null;
      let clinicStatus: string | undefined = undefined;

      if (cached && cached.expiresAt > now) {
        tenant = cached.tenant;
        clinicStatus = cached.clinicStatus;
      } else {
        // Fetch tenant from db
        try {
          if (UUID_REGEX.test(resolvedIdOrSlug)) {
            tenant = await tenantService.getTenantById(resolvedIdOrSlug);
          } else {
            tenant = await tenantService.getTenantBySlug(resolvedIdOrSlug);
          }
        } catch (err) {
          // Map to 404 or 400
          res.status(404).json({
            success: false,
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Resolved tenant not found.',
              details: [],
            },
            requestId: req.requestId ?? '',
          });
          return;
        }

        if (req.user?.clinicId && options.clinicChecker) {
          try {
            const clinic = await options.clinicChecker(req.user.clinicId);
            if (clinic) {
              clinicStatus = clinic.status;
            }
          } catch {
            // Ignored
          }
        }

        tenantResolutionCache.set(resolvedIdOrSlug, {
          tenant,
          clinicStatus,
          expiresAt: now + TENANT_RESOLUTION_TTL_MS,
        });
        if (tenant.id !== resolvedIdOrSlug) {
          tenantResolutionCache.set(tenant.id, {
            tenant,
            clinicStatus,
            expiresAt: now + TENANT_RESOLUTION_TTL_MS,
          });
        }
      }

      // Enforce isolation rules — Tenant level suspension
      if (tenant.status === TENANT_STATUS_SUSPENDED) {
        res.status(403).json({
          success: false,
          error: {
            code: 'CLINIC_SUSPENDED',
            message: 'Clinic access is suspended. Please contact your platform administrator.',
            details: [],
          },
          requestId: req.requestId ?? '',
        });
        return;
      }

      // Enforce Clinic level suspension if clinic context is present
      if (clinicStatus === 'suspended') {
        res.status(403).json({
          success: false,
          error: {
            code: 'CLINIC_SUSPENDED',
            message: 'Clinic access is suspended. Please contact your platform administrator.',
            details: [],
          },
          requestId: req.requestId ?? '',
        });
        return;
      }

      // archived is read-only for writes (POST, PUT, DELETE, PATCH)
      if (
        tenant.status === TENANT_STATUS_ARCHIVED &&
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'TENANT_ARCHIVED_READ_ONLY',
            message: 'Tenant is archived and read-only. Modification prohibited.',
            details: [],
          },
          requestId: req.requestId ?? '',
        });
        return;
      }

      // Setup Request parameters
      req.tenantId = tenant.id;
      if (req.context) {
        req.context.tenantId = tenant.id;
      }
      req.tenantContext = {
        tenantId: tenant.id,
        clinicId: req.user?.clinicId ?? null,
        userId: req.user?.userId ?? 'system',
        role: req.user?.role ?? 'guest',
        permissions: [], // populated later by RBAC context builder if needed
        timezone: tenant.timezone,
        locale: `${tenant.language}-${tenant.country}`,
      };

      req.profiler?.markTenantComplete();
      next();
    } catch (error) {
      next(error);
    }
  };
}
