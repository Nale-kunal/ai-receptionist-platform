/**
 * Tenant Module Type Definitions
 *
 * Safe domain interfaces and contexts representing tenant states and branding options.
 */

import type { TenantStatus, SubscriptionPlan } from '../constants/tenant.constants';

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  clinicName?: string;
  website?: string;
  emailBranding?: {
    headerColor?: string;
    footerText?: string;
  };
  [key: string]: unknown;
}

export interface TenantMetadata {
  [key: string]: unknown;
}

/**
 * Safe representation of a Tenant returned in HTTP responses.
 * Never includes raw connection credentials.
 */
export interface SafeTenant {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  country: string;
  language: string;
  subscriptionPlan: SubscriptionPlan;
  branding: TenantBranding;
  metadata: TenantMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request Context carrying validated tenant parameters.
 * Built by the Tenant Resolution middleware.
 */
export interface TenantContext {
  tenantId: string;
  clinicId: string | null;
  userId: string;
  role: string;
  permissions: string[];
  timezone: string;
  locale: string; // E.g., 'en-US'
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantContext?: TenantContext;
    }
  }
}
