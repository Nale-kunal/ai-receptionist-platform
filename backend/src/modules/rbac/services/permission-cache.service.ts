/**
 * Permission Cache Service
 *
 * In-process LRU-style cache for resolved permission sets.
 * Per RBAC Contract §Permission Cache: cache must be invalidated
 * immediately after role changes, permission updates, user disable,
 * or tenant suspension.
 *
 * Cache key strategy: `{userId}:{tenantId}` — ensures full invalidation
 * when a user's roles change.
 *
 * This implementation is single-process safe. In a multi-instance
 * deployment this would be replaced with a Redis-backed implementation
 * via the same IPermissionCacheService interface (zero code change).
 */

import {
  PERMISSION_CACHE_TTL_SECONDS,
  PERMISSION_CACHE_MAX_ENTRIES,
} from '../constants/rbac.constants';
import type { IPermissionCacheService } from '../interfaces/rbac.interfaces';
import type { ResolvedPermissions } from '../types/rbac.types';

interface CacheEntry {
  value: ResolvedPermissions;
  /** Monotonic clock value used for LRU eviction */
  lastAccessed: number;
}

export class PermissionCacheService implements IPermissionCacheService {
  private readonly cache: Map<string, CacheEntry>;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private clockTick = 0;

  constructor(
    ttlSeconds = PERMISSION_CACHE_TTL_SECONDS,
    maxEntries = PERMISSION_CACHE_MAX_ENTRIES,
  ) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  // --------------------------------------------------------------------------
  // Public interface
  // --------------------------------------------------------------------------

  public get(cacheKey: string): ResolvedPermissions | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;

    // Check expiry
    if (entry.value.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    // Update LRU timestamp
    entry.lastAccessed = ++this.clockTick;
    return entry.value;
  }

  public set(cacheKey: string, value: ResolvedPermissions): void {
    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(cacheKey)) {
      this.evictLru();
    }
    this.cache.set(cacheKey, { value, lastAccessed: ++this.clockTick });
  }

  public invalidate(cacheKey: string): void {
    this.cache.delete(cacheKey);
  }

  public invalidateByUserId(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateByTenantId(tenantId: string): void {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${tenantId}`)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Build a deterministic cache key from userId + tenantId */
  public static buildKey(userId: string, tenantId: string): string {
    return `${userId}:${tenantId}`;
  }

  public buildExpiresAt(): Date {
    return new Date(Date.now() + this.ttlMs);
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
