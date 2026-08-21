/**
 * Configuration Module Interfaces
 */

import type {
  SafeConfiguration,
  BusinessSettings,
  VoiceSettings,
  AiSettings,
  CalendarSettings,
  NotificationSettings,
  BrandingSettings,
  LocalizationSettings,
  FeatureFlagsSettings,
  ProvidersSettings,
} from '../types/configuration.types';

export interface CreateConfigurationParams {
  tenantId: string;
  clinicId: string | null;
  createdBy: string;
  changeSummary?: string;
  
  business: BusinessSettings;
  voice: VoiceSettings;
  ai: AiSettings;
  calendar: CalendarSettings;
  notification: NotificationSettings;
  branding: BrandingSettings;
  localization: LocalizationSettings;
  featureFlags: FeatureFlagsSettings;
  providers: ProvidersSettings;
  
  requestId: string;
}

export interface UpdateConfigurationParams {
  tenantId: string;
  clinicId: string | null;
  updatedBy: string;
  changeSummary?: string;

  business?: Partial<BusinessSettings>;
  voice?: Partial<VoiceSettings>;
  ai?: Partial<AiSettings>;
  calendar?: Partial<CalendarSettings>;
  notification?: Partial<NotificationSettings>;
  branding?: Partial<BrandingSettings>;
  localization?: Partial<LocalizationSettings>;
  featureFlags?: Partial<FeatureFlagsSettings>;
  providers?: Partial<ProvidersSettings>;

  requestId: string;
}

export interface IConfigurationService {
  getActiveConfiguration(tenantId: string, clinicId: string | null): Promise<SafeConfiguration>;
  getConfigurationById(id: string, tenantId: string): Promise<SafeConfiguration>;
  listConfigurationHistory(
    tenantId: string,
    clinicId: string | null,
    limit?: number,
    offset?: number,
  ): Promise<SafeConfiguration[]>;
  createConfiguration(params: CreateConfigurationParams): Promise<SafeConfiguration>;
  updateConfiguration(params: UpdateConfigurationParams): Promise<SafeConfiguration>;
  rollbackConfiguration(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeConfiguration>;
  clearCache(tenantId: string, clinicId: string | null): Promise<void>;
}

export interface IConfigurationRepository {
  create(data: {
    tenantId: string;
    clinicId: string | null;
    version: number;
    isActive: boolean;
    createdBy: string;
    changeSummary?: string;
    previousVersionId?: string;
    rollbackFromVersion?: number;
    business: unknown;
    voice: unknown;
    ai: unknown;
    calendar: unknown;
    notification: unknown;
    branding: unknown;
    localization: unknown;
    featureFlags: unknown;
    providers: unknown;
  }): Promise<unknown>;

  findActive(tenantId: string, clinicId: string | null): Promise<unknown | null>;
  findById(id: string): Promise<unknown | null>;
  findLatestVersion(tenantId: string, clinicId: string | null): Promise<number>;
  findMany(
    tenantId: string,
    clinicId: string | null,
    limit?: number,
    offset?: number,
  ): Promise<unknown[]>;
  deactivateAll(tenantId: string, clinicId: string | null): Promise<void>;
  syncClinicAndTenant?(
    tenantId: string,
    clinicId: string | null,
    updates: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      timezone?: string;
    },
  ): Promise<void>;
}

export interface IConfigurationCacheService {
  get(key: string): SafeConfiguration | undefined;
  set(key: string, value: SafeConfiguration): void;
  invalidate(key: string): void;
  clear(): void;
  size(): number;
}
