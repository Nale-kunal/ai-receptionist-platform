/**
 * Configuration Service
 *
 * Implements business rules for runtime resolution, versioning, rollback,
 * cache eviction, and audit events dispatching.
 */

import type {
  IConfigurationService,
  IConfigurationRepository,
  IConfigurationCacheService,
  CreateConfigurationParams,
  UpdateConfigurationParams,
} from '../interfaces/configuration.interfaces';
import type { IConfigurationEventPublisher } from '../events/configuration-event.publisher';
import type {
  SafeConfiguration,
} from '../types/configuration.types';
import {
  ConfigurationNotFoundError,
  ConfigurationIsolationViolationError,
  InvalidTimezoneError,
  InvalidProviderError,
} from '../errors/configuration.errors';
import {
  EVENT_CONFIG_CREATED,
  EVENT_CONFIG_UPDATED,
  EVENT_CONFIG_PUBLISHED,
  EVENT_CONFIG_ROLLED_BACK,
  EVENT_CONFIG_RESTORED,
  EVENT_CONFIG_FEATURE_FLAG_CHANGED,
  EVENT_CONFIG_PROVIDER_CHANGED,
} from '../events/configuration.events';
import { ConfigurationCacheService } from './configuration-cache.service';
import { isValidTimezone } from '../validators/create-configuration.validator';
import {
  PROVIDERS_AI,
  PROVIDERS_CALENDAR,
  PROVIDERS_TELEPHONY,
} from '../constants/configuration.constants';

export class ConfigurationService implements IConfigurationService {
  constructor(
    private readonly repository: IConfigurationRepository,
    private readonly cache: IConfigurationCacheService,
    private readonly publisher: IConfigurationEventPublisher,
  ) {}

  public async getActiveConfiguration(
    tenantId: string,
    clinicId: string | null,
  ): Promise<SafeConfiguration> {
    const cacheKey = ConfigurationCacheService.buildKey(tenantId, clinicId);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to resolve the specific config (e.g. clinic override)
    let dbRecord = await this.repository.findActive(tenantId, clinicId);

    // Fall back to tenant-level config if not found at clinic level
    if (!dbRecord && clinicId !== null) {
      dbRecord = await this.repository.findActive(tenantId, null);
    }

    if (!dbRecord) {
      throw new ConfigurationNotFoundError();
    }

    const safeConfig = this.mapToSafeConfig(dbRecord);
    
    // Store in cache under requested clinicId to ensure quick lookups
    this.cache.set(cacheKey, safeConfig);

    return safeConfig;
  }

  public async getConfigurationById(id: string, tenantId: string): Promise<SafeConfiguration> {
    const dbRecord = await this.repository.findById(id);
    if (!dbRecord) {
      throw new ConfigurationNotFoundError(id);
    }

    const safeConfig = this.mapToSafeConfig(dbRecord);
    if (safeConfig.tenantId !== tenantId) {
      throw new ConfigurationIsolationViolationError();
    }

    return safeConfig;
  }

  public async listConfigurationHistory(
    tenantId: string,
    clinicId: string | null,
    limit?: number,
    offset?: number,
  ): Promise<SafeConfiguration[]> {
    const records = await this.repository.findMany(tenantId, clinicId, limit, offset);
    return records.map((r) => this.mapToSafeConfig(r));
  }

  public async createConfiguration(params: CreateConfigurationParams): Promise<SafeConfiguration> {
    // Business validation checks
    this.validateTimezone(params.localization.timezone);
    this.validateProviders(params.ai.provider, params.calendar.calendarProvider);

    const latestVersion = await this.repository.findLatestVersion(params.tenantId, params.clinicId);
    const version = latestVersion + 1;

    // Fetch previous active to check changed feature flags & providers
    const previousActive = await this.repository.findActive(params.tenantId, params.clinicId);

    // Write database transaction sequence: deactivate then create
    await this.repository.deactivateAll(params.tenantId, params.clinicId);

    const created = await this.repository.create({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      version,
      isActive: true,
      createdBy: params.createdBy,
      changeSummary: params.changeSummary,
      business: params.business,
      voice: params.voice,
      ai: params.ai,
      calendar: params.calendar,
      notification: params.notification,
      branding: params.branding,
      localization: params.localization,
      featureFlags: params.featureFlags,
      providers: params.providers,
    });

    const safeConfig = this.mapToSafeConfig(created);

    // Evict & populate cache immediately
    const cacheKey = ConfigurationCacheService.buildKey(params.tenantId, params.clinicId);
    this.cache.set(cacheKey, safeConfig);

    // Audit logs & decoupling
    const occurredAt = new Date();
    await this.publisher.publish({
      type: EVENT_CONFIG_CREATED,
      payload: {
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        actorId: params.createdBy,
        requestId: params.requestId,
        occurredAt,
        configurationId: safeConfig.id,
        version,
        settings: {
          business: params.business,
          voice: params.voice,
          ai: params.ai,
          calendar: params.calendar,
          notification: params.notification,
          branding: params.branding,
          localization: params.localization,
          featureFlags: params.featureFlags,
          providers: params.providers,
        },
      },
    });

    await this.publisher.publish({
      type: EVENT_CONFIG_PUBLISHED,
      payload: {
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        actorId: params.createdBy,
        requestId: params.requestId,
        occurredAt,
        configurationId: safeConfig.id,
        version,
      },
    });

    if (previousActive) {
      const prevSafe = this.mapToSafeConfig(previousActive);
      await this.publishChangedDiffs(
        prevSafe,
        safeConfig,
        params.createdBy,
        params.requestId,
        occurredAt,
      );
    }

    return safeConfig;
  }

  public async updateConfiguration(params: UpdateConfigurationParams): Promise<SafeConfiguration> {
    // Update must target an existing active configuration version
    const activeRecord = await this.repository.findActive(params.tenantId, params.clinicId);
    if (!activeRecord) {
      throw new ConfigurationNotFoundError();
    }

    const current = this.mapToSafeConfig(activeRecord);

    // Deep merge payload properties
    const business = { ...current.business, ...params.business };
    const voice = { ...current.voice, ...params.voice };
    const ai = { ...current.ai, ...params.ai };
    const calendar = { ...current.calendar, ...params.calendar };
    const notification = { ...current.notification, ...params.notification };
    const branding = { ...current.branding, ...params.branding };
    const localization = { ...current.localization, ...params.localization };
    const featureFlags = { ...current.featureFlags, ...params.featureFlags };
    const providers = { ...current.providers, ...params.providers };

    // Validation
    this.validateTimezone(localization.timezone);
    this.validateProviders(ai.provider, calendar.calendarProvider);

    const latestVersion = await this.repository.findLatestVersion(params.tenantId, params.clinicId);
    const version = latestVersion + 1;

    await this.repository.deactivateAll(params.tenantId, params.clinicId);

    const updated = await this.repository.create({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      version,
      isActive: true,
      createdBy: params.updatedBy,
      changeSummary: params.changeSummary,
      previousVersionId: current.id,
      business,
      voice,
      ai,
      calendar,
      notification,
      branding,
      localization,
      featureFlags,
      providers,
    });

    const safeConfig = this.mapToSafeConfig(updated);

    // Invalidate and update cache
    const cacheKey = ConfigurationCacheService.buildKey(params.tenantId, params.clinicId);
    this.cache.set(cacheKey, safeConfig);

    const occurredAt = new Date();
    const changedFields: string[] = [];
    if (params.business) changedFields.push('business');
    if (params.voice) changedFields.push('voice');
    if (params.ai) changedFields.push('ai');
    if (params.calendar) changedFields.push('calendar');
    if (params.notification) changedFields.push('notification');
    if (params.branding) changedFields.push('branding');
    if (params.localization) changedFields.push('localization');
    if (params.featureFlags) changedFields.push('featureFlags');
    if (params.providers) changedFields.push('providers');

    await this.publisher.publish({
      type: EVENT_CONFIG_UPDATED,
      payload: {
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        actorId: params.updatedBy,
        requestId: params.requestId,
        occurredAt,
        configurationId: safeConfig.id,
        version,
        changedFields,
        previousSettings: current,
        newSettings: safeConfig,
      },
    });

    await this.publishChangedDiffs(
      current,
      safeConfig,
      params.updatedBy,
      params.requestId,
      occurredAt,
    );

    return safeConfig;
  }

  public async rollbackConfiguration(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeConfiguration> {
    const targetRecord = await this.repository.findById(id);
    if (!targetRecord) {
      throw new ConfigurationNotFoundError(id);
    }

    const target = this.mapToSafeConfig(targetRecord);
    if (target.tenantId !== tenantId) {
      throw new ConfigurationIsolationViolationError();
    }

    const latestVersion = await this.repository.findLatestVersion(tenantId, target.clinicId);
    const version = latestVersion + 1;

    // Fetch previous active config before rollback
    const previousActive = await this.repository.findActive(tenantId, target.clinicId);

    await this.repository.deactivateAll(tenantId, target.clinicId);

    const rolledBack = await this.repository.create({
      tenantId,
      clinicId: target.clinicId,
      version,
      isActive: true,
      createdBy: actorId,
      changeSummary: `Rolled back to version ${target.version}`,
      previousVersionId: id,
      rollbackFromVersion: target.version,
      business: target.business,
      voice: target.voice,
      ai: target.ai,
      calendar: target.calendar,
      notification: target.notification,
      branding: target.branding,
      localization: target.localization,
      featureFlags: target.featureFlags,
      providers: target.providers,
    });

    const safeConfig = this.mapToSafeConfig(rolledBack);

    // Evict cache
    const cacheKey = ConfigurationCacheService.buildKey(tenantId, target.clinicId);
    this.cache.set(cacheKey, safeConfig);

    const occurredAt = new Date();
    await this.publisher.publish({
      type: EVENT_CONFIG_ROLLED_BACK,
      payload: {
        tenantId,
        clinicId: target.clinicId,
        actorId,
        requestId,
        occurredAt,
        configurationId: safeConfig.id,
        version,
        fromVersion: target.version,
        toVersion: version,
      },
    });

    await this.publisher.publish({
      type: EVENT_CONFIG_RESTORED,
      payload: {
        tenantId,
        clinicId: target.clinicId,
        actorId,
        requestId,
        occurredAt,
        configurationId: safeConfig.id,
        version,
      },
    });

    if (previousActive) {
      const prevSafe = this.mapToSafeConfig(previousActive);
      await this.publishChangedDiffs(
        prevSafe,
        safeConfig,
        actorId,
        requestId,
        occurredAt,
      );
    }

    return safeConfig;
  }

  public async clearCache(tenantId: string, clinicId: string | null): Promise<void> {
    const cacheKey = ConfigurationCacheService.buildKey(tenantId, clinicId);
    this.cache.invalidate(cacheKey);
  }

  // --------------------------------------------------------------------------
  // Private helper methods
  // --------------------------------------------------------------------------

  private validateTimezone(tz: string): void {
    if (!isValidTimezone(tz)) {
      throw new InvalidTimezoneError(tz);
    }
  }

  private validateProviders(aiProvider: string, calendarProvider: string): void {
    if (!PROVIDERS_AI.includes(aiProvider as any)) {
      throw new InvalidProviderError('AI', aiProvider);
    }
    if (!PROVIDERS_CALENDAR.includes(calendarProvider as any)) {
      throw new InvalidProviderError('Calendar', calendarProvider);
    }
  }

  private mapToSafeConfig(dbRecord: any): SafeConfiguration {
    return {
      id: dbRecord.id,
      tenantId: dbRecord.tenantId,
      clinicId: dbRecord.clinicId,
      version: dbRecord.version,
      isActive: dbRecord.isActive,
      createdBy: dbRecord.createdBy,
      createdAt: dbRecord.createdAt,
      changeSummary: dbRecord.changeSummary,
      previousVersionId: dbRecord.previousVersionId,
      rollbackFromVersion: dbRecord.rollbackFromVersion,
      business: dbRecord.business as any,
      voice: dbRecord.voice as any,
      ai: dbRecord.ai as any,
      calendar: dbRecord.calendar as any,
      notification: dbRecord.notification as any,
      branding: dbRecord.branding as any,
      localization: dbRecord.localization as any,
      featureFlags: dbRecord.featureFlags as any,
      providers: dbRecord.providers as any,
    };
  }

  private async publishChangedDiffs(
    prev: SafeConfiguration,
    curr: SafeConfiguration,
    actorId: string,
    requestId: string,
    occurredAt: Date,
  ): Promise<void> {
    // 1. Audit feature flags changes
    const flagsKeys = Object.keys(curr.featureFlags);
    for (const key of flagsKeys) {
      const prevVal = (prev.featureFlags as any)[key];
      const currVal = (curr.featureFlags as any)[key];
      if (prevVal !== currVal) {
        await this.publisher.publish({
          type: EVENT_CONFIG_FEATURE_FLAG_CHANGED,
          payload: {
            tenantId: curr.tenantId,
            clinicId: curr.clinicId,
            actorId,
            requestId,
            occurredAt,
            configurationId: curr.id,
            flagName: key,
            previousValue: !!prevVal,
            newValue: !!currVal,
          },
        });
      }
    }

    // 2. Audit provider selections changes
    if (prev.ai.provider !== curr.ai.provider) {
      await this.publisher.publish({
        type: EVENT_CONFIG_PROVIDER_CHANGED,
        payload: {
          tenantId: curr.tenantId,
          clinicId: curr.clinicId,
          actorId,
          requestId,
          occurredAt,
          configurationId: curr.id,
          category: 'AI',
          previousProvider: prev.ai.provider,
          newProvider: curr.ai.provider,
        },
      });
    }

    if (prev.calendar.calendarProvider !== curr.calendar.calendarProvider) {
      await this.publisher.publish({
        type: EVENT_CONFIG_PROVIDER_CHANGED,
        payload: {
          tenantId: curr.tenantId,
          clinicId: curr.clinicId,
          actorId,
          requestId,
          occurredAt,
          configurationId: curr.id,
          category: 'Calendar',
          previousProvider: prev.calendar.calendarProvider,
          newProvider: curr.calendar.calendarProvider,
        },
      });
    }
  }
}
