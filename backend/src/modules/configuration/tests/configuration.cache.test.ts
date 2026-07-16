/**
 * Configuration Cache Service Unit Tests
 */

import { ConfigurationCacheService } from '../services/configuration-cache.service';
import type { SafeConfiguration } from '../types/configuration.types';

describe('ConfigurationCacheService', () => {
  let cacheService: ConfigurationCacheService;

  const mockConfig = {
    id: 'c-1',
    tenantId: 't-1',
    clinicId: null,
    version: 1,
    isActive: true,
  } as unknown as SafeConfiguration;

  beforeEach(() => {
    cacheService = new ConfigurationCacheService(300, 3); // 300s TTL, max 3 entries
  });

  it('should store and retrieve configuration entries', () => {
    const key = ConfigurationCacheService.buildKey('t-1', null);
    cacheService.set(key, mockConfig);

    const result = cacheService.get(key);
    expect(result).toEqual(mockConfig);
    expect(cacheService.size()).toBe(1);
  });

  it('should return undefined and delete entry if expired', () => {
    // Instantiate cache service with 0 seconds TTL so it expires immediately
    const immediateCache = new ConfigurationCacheService(0, 3);
    const key = ConfigurationCacheService.buildKey('t-1', null);
    immediateCache.set(key, mockConfig);

    const result = immediateCache.get(key);
    expect(result).toBeUndefined();
    expect(immediateCache.size()).toBe(0);
  });

  it('should invalidate specific key', () => {
    const key1 = ConfigurationCacheService.buildKey('t-1', null);
    const key2 = ConfigurationCacheService.buildKey('t-2', null);

    cacheService.set(key1, mockConfig);
    cacheService.set(key2, { ...mockConfig, tenantId: 't-2' } as any);

    expect(cacheService.size()).toBe(2);

    cacheService.invalidate(key1);
    expect(cacheService.get(key1)).toBeUndefined();
    expect(cacheService.get(key2)).toBeDefined();
    expect(cacheService.size()).toBe(1);
  });

  it('should evict LRU entry when max capacity is exceeded', () => {
    const k1 = ConfigurationCacheService.buildKey('t-1', null);
    const k2 = ConfigurationCacheService.buildKey('t-2', null);
    const k3 = ConfigurationCacheService.buildKey('t-3', null);
    const k4 = ConfigurationCacheService.buildKey('t-4', null);

    cacheService.set(k1, { id: '1' } as any);
    cacheService.set(k2, { id: '2' } as any);
    cacheService.set(k3, { id: '3' } as any);

    // Access k1 to make k2 the least recently accessed
    cacheService.get(k1);

    // Set k4, which triggers eviction of k2
    cacheService.set(k4, { id: '4' } as any);

    expect(cacheService.get(k2)).toBeUndefined();
    expect(cacheService.get(k1)).toBeDefined();
    expect(cacheService.get(k3)).toBeDefined();
    expect(cacheService.get(k4)).toBeDefined();
  });
});
