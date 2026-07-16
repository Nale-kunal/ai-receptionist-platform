/**
 * Clinic Module Types & Interfaces
 */

import type { ClinicStatus } from '../constants/clinic.constants';

export interface ClinicContactInfo {
  primaryEmail: string | null;
  primaryPhone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface ClinicBrandingInfo {
  logoReference: string | null;
  brandIdentifier: string | null;
}

export interface ClinicSubscriptionInfo {
  subscriptionId: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
}

/**
 * Output representation of a Clinic.
 * Sanitizes and formats the raw database record.
 */
export interface SafeClinic {
  id: string;
  publicId: string;
  tenantId: string;
  ownerId: string;
  name: string;
  legalName: string | null;
  slug: string;
  timezone: string;
  country: string;
  status: ClinicStatus;
  
  contact: ClinicContactInfo;
  branding: ClinicBrandingInfo;
  subscription: ClinicSubscriptionInfo;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
