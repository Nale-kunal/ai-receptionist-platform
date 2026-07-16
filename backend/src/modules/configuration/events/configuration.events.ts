/**
 * Configuration Module Domain Events
 */

export const EVENT_CONFIG_CREATED = 'configuration.created' as const;
export const EVENT_CONFIG_UPDATED = 'configuration.updated' as const;
export const EVENT_CONFIG_PUBLISHED = 'configuration.published' as const;
export const EVENT_CONFIG_ARCHIVED = 'configuration.archived' as const;
export const EVENT_CONFIG_RESTORED = 'configuration.restored' as const;
export const EVENT_CONFIG_ROLLED_BACK = 'configuration.rolled-back' as const;
export const EVENT_CONFIG_CACHE_INVALIDATED = 'configuration.cache.invalidated' as const;
export const EVENT_CONFIG_FEATURE_FLAG_CHANGED = 'configuration.feature-flag.changed' as const;
export const EVENT_CONFIG_PROVIDER_CHANGED = 'configuration.provider.changed' as const;

export interface BaseConfigEventPayload {
  tenantId: string;
  clinicId: string | null;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

export interface ConfigurationCreatedEvent {
  type: typeof EVENT_CONFIG_CREATED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    version: number;
    settings: any;
  };
}

export interface ConfigurationUpdatedEvent {
  type: typeof EVENT_CONFIG_UPDATED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    version: number;
    changedFields: string[];
    previousSettings: any;
    newSettings: any;
  };
}

export interface ConfigurationPublishedEvent {
  type: typeof EVENT_CONFIG_PUBLISHED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    version: number;
  };
}

export interface ConfigurationArchivedEvent {
  type: typeof EVENT_CONFIG_ARCHIVED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
  };
}

export interface ConfigurationRestoredEvent {
  type: typeof EVENT_CONFIG_RESTORED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    version: number;
  };
}

export interface ConfigurationRolledBackEvent {
  type: typeof EVENT_CONFIG_ROLLED_BACK;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    version: number;
    fromVersion: number;
    toVersion: number;
  };
}

export interface ConfigurationCacheInvalidatedEvent {
  type: typeof EVENT_CONFIG_CACHE_INVALIDATED;
  payload: BaseConfigEventPayload & {
    cacheKey: string;
  };
}

export interface ConfigurationFeatureFlagChangedEvent {
  type: typeof EVENT_CONFIG_FEATURE_FLAG_CHANGED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    flagName: string;
    previousValue: boolean;
    newValue: boolean;
  };
}

export interface ConfigurationProviderChangedEvent {
  type: typeof EVENT_CONFIG_PROVIDER_CHANGED;
  payload: BaseConfigEventPayload & {
    configurationId: string;
    category: string;
    previousProvider: string;
    newProvider: string;
  };
}

export type ConfigurationEvent =
  | ConfigurationCreatedEvent
  | ConfigurationUpdatedEvent
  | ConfigurationPublishedEvent
  | ConfigurationArchivedEvent
  | ConfigurationRestoredEvent
  | ConfigurationRolledBackEvent
  | ConfigurationCacheInvalidatedEvent
  | ConfigurationFeatureFlagChangedEvent
  | ConfigurationProviderChangedEvent;
