/**
 * Clinic Module Interfaces & Contracts
 */

import type { ClinicStatus } from '../constants/clinic.constants';
import type { SafeClinic } from '../types/clinic.types';

export interface CreateClinicParams {
  tenantId: string;
  ownerId: string;
  name: string;
  legalName?: string | null;
  slug: string;
  timezone: string;
  country: string;
  
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  
  logoReference?: string | null;
  brandIdentifier?: string | null;
  
  subscriptionId?: string | null;
  planId?: string | null;
  subscriptionStatus?: string | null;
  
  actorId: string;
  requestId: string;
}

export interface UpdateClinicParams {
  id: string;
  tenantId: string;
  name?: string;
  legalName?: string | null;
  timezone?: string;
  country?: string;
  
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  
  logoReference?: string | null;
  brandIdentifier?: string | null;
  
  subscriptionId?: string | null;
  planId?: string | null;
  subscriptionStatus?: string | null;
  
  actorId: string;
  requestId: string;
}

export interface IClinicService {
  createClinic(params: CreateClinicParams): Promise<SafeClinic>;
  updateClinic(params: UpdateClinicParams): Promise<SafeClinic>;
  getClinicById(id: string, tenantId: string): Promise<SafeClinic>;
  getClinicBySlug(slug: string, tenantId: string): Promise<SafeClinic>;
  listClinics(params: {
    tenantId: string;
    status?: ClinicStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafeClinic[]>;
  transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: ClinicStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafeClinic>;
  transferOwnership(
    id: string,
    tenantId: string,
    targetOwnerId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeClinic>;
  softDeleteClinic(id: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  restoreClinic(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeClinic>;
}

export interface IClinicRepository {
  create(data: {
    tenantId: string;
    ownerId: string;
    name: string;
    legalName?: string | null;
    slug: string;
    timezone: string;
    country: string;
    status: ClinicStatus;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    logoReference?: string | null;
    brandIdentifier?: string | null;
    subscriptionId?: string | null;
    planId?: string | null;
    subscriptionStatus?: string | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      ownerId?: string;
      name?: string;
      legalName?: string | null;
      timezone?: string;
      country?: string;
      status?: ClinicStatus;
      primaryEmail?: string | null;
      primaryPhone?: string | null;
      website?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      logoReference?: string | null;
      brandIdentifier?: string | null;
      subscriptionId?: string | null;
      planId?: string | null;
      subscriptionStatus?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findBySlug(slug: string, includeDeleted?: boolean): Promise<unknown | null>;
  findMany(params: {
    tenantId: string;
    status?: ClinicStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;
  exists(slug: string): Promise<boolean>;
  userBelongsToTenant(userId: string, tenantId: string): Promise<boolean>;
}
