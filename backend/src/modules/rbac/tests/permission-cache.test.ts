/**
 * PermissionCacheService Tests
 */

import { PermissionCacheService } from '../services/permission-cache.service';
import type { ResolvedPermissions } from '../types/rbac.types';

function makeResolved(userId: string, tenantId: string, overrides: Partial<ResolvedPermissions> = {}): ResolvedPermissions {
  const now = new Date();
  return {
    userId,
    tenantId,
    clinicId: null,
    roleNames: ['admin'],
    permissions: new Set(['appointment.read', 'appointment.create']),
    resolvedAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    ...overrides,
  };
}

describe('PermissionCacheService', () => {
  let cache: PermissionCacheService;

  beforeEach(() => {
    cache = new PermissionCacheService(300, 100);
  });

  describe('get/set', () => {
    it('should return undefined for a missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should store and retrieve a value', () => {
      const key = PermissionCacheService.buildKey('user-1', 'tenant-1');
      const resolved = makeResolved('user-1', 'tenant-1');
      cache.set(key, resolved);

      const result = cache.get(key);
      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-1');
      expect(result?.permissions.has('appointment.read')).toBe(true);
    });

    it('should return undefined for an expired entry', () => {
      const key = PermissionCacheService.buildKey('user-2', 'tenant-1');
      const resolved = makeResolved('user-2', 'tenant-1', {
        expiresAt: new Date(Date.now() - 1000), // already expired
      });
      cache.set(key, resolved);

      expect(cache.get(key)).toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('should remove a specific key', () => {
      const key = PermissionCacheService.buildKey('user-3', 'tenant-1');
      cache.set(key, makeResolved('user-3', 'tenant-1'));
      expect(cache.get(key)).toBeDefined();

      cache.invalidate(key);
      expect(cache.get(key)).toBeUndefined();
    });
  });

  describe('invalidateByUserId', () => {
    it('should remove all keys for a specific user', () => {
      const key1 = PermissionCacheService.buildKey('user-4', 'tenant-a');
      const key2 = PermissionCacheService.buildKey('user-4', 'tenant-b');
      const key3 = PermissionCacheService.buildKey('user-5', 'tenant-a');

      cache.set(key1, makeResolved('user-4', 'tenant-a'));
      cache.set(key2, makeResolved('user-4', 'tenant-b'));
      cache.set(key3, makeResolved('user-5', 'tenant-a'));

      cache.invalidateByUserId('user-4');

      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toBeUndefined();
      expect(cache.get(key3)).toBeDefined();
    });
  });

  describe('invalidateByTenantId', () => {
    it('should remove all keys for a specific tenant', () => {
      const key1 = PermissionCacheService.buildKey('user-6', 'tenant-x');
      const key2 = PermissionCacheService.buildKey('user-7', 'tenant-x');
      const key3 = PermissionCacheService.buildKey('user-8', 'tenant-y');

      cache.set(key1, makeResolved('user-6', 'tenant-x'));
      cache.set(key2, makeResolved('user-7', 'tenant-x'));
      cache.set(key3, makeResolved('user-8', 'tenant-y'));

      cache.invalidateByTenantId('tenant-x');

      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toBeUndefined();
      expect(cache.get(key3)).toBeDefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict LRU entry when at max capacity', () => {
      // Create a cache with max 3 entries
      const smallCache = new PermissionCacheService(300, 3);

      const k1 = 'u1:t1';
      const k2 = 'u2:t1';
      const k3 = 'u3:t1';
      const k4 = 'u4:t1';

      smallCache.set(k1, makeResolved('u1', 't1'));
      smallCache.set(k2, makeResolved('u2', 't1'));
      smallCache.set(k3, makeResolved('u3', 't1'));

      // Access k1 to make it recently used
      smallCache.get(k1);

      // Adding k4 should evict the LRU — which is k2 (set before k1 was re-accessed)
      smallCache.set(k4, makeResolved('u4', 't1'));

      expect(smallCache.size()).toBe(3);
      expect(smallCache.get(k1)).toBeDefined(); // recently used
      expect(smallCache.get(k4)).toBeDefined(); // just added
    });
  });

  describe('buildKey', () => {
    it('should produce a deterministic key', () => {
      const k1 = PermissionCacheService.buildKey('user-a', 'tenant-b');
      const k2 = PermissionCacheService.buildKey('user-a', 'tenant-b');
      expect(k1).toBe(k2);
    });

    it('should produce different keys for different inputs', () => {
      const k1 = PermissionCacheService.buildKey('user-a', 'tenant-b');
      const k2 = PermissionCacheService.buildKey('user-b', 'tenant-a');
      expect(k1).not.toBe(k2);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('k1', makeResolved('u1', 't1'));
      cache.set('k2', makeResolved('u2', 't1'));
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });
});
