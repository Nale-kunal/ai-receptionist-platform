/**
 * Configuration Cache Service
 *
 * In-process LRU-style cache for active configuration records.
 * Decouples cache client access so we can easily swap it with Redis.
 */

import {
  CONFIGURATION_CACHE_TTL_SECONDS,
  CONFIGURATION_CACHE_MAX_SIZE,
} from '../constants/configuration.constants';
import type { IConfigurationCacheService } from '../interfaces/configuration.interfaces';
import type { SafeConfiguration } from '../types/configuration.types';

interface CacheEntry {
  value: SafeConfiguration;
  expiresAt: number;
  lastAccessed: number;
}

export class ConfigurationCacheService implements IConfigurationCacheService {
  private readonly cache: Map<string, CacheEntry>;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private clockTick = 0;

  constructor(
    ttlSeconds: number = CONFIGURATION_CACHE_TTL_SECONDS,
    maxEntries: number = CONFIGURATION_CACHE_MAX_SIZE,
  ) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  public get(key: string): SafeConfiguration | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check expiry
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    // Update LRU clock
    entry.lastAccessed = ++this.clockTick;
    return entry.value;
  }

  public set(key: string, value: SafeConfiguration): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictLru();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
      lastAccessed: ++this.clockTick,
    });
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public static buildKey(tenantId: string, clinicId: string | null): string {
    const cId = clinicId ?? 'global';
    return `config:${tenantId}:${cId}`;
  }

  private evictLru(): void {
    let lruKey: string | null = null;
    let lruTick = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTick) {
        lruTick = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
    }
  }
}
