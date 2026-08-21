/**
 * Admin Frontend Instant-Cache & SWR (Stale-While-Revalidate) Service
 *
 * Provides sub-millisecond initial render while strictly guaranteeing
 * that PostgreSQL remains the single authoritative source of truth.
 *
 * Rules:
 *   - Client cache is temporary and disposable
 *   - Cached items older than MAX_AGE_MS (default: 5s) are automatically expired
 *   - Never allows stale sessionStorage to permanently override newer database values
 *   - Supports instant targeted or global cache invalidation on any mutation
 */

import { adminApiClient } from './adminApiClient';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const DEFAULT_CACHE_MAX_AGE_MS = 5_000; // 5 seconds freshness window

class AdminFrontendCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private listeners = new Set<() => void>();

  constructor() {
    // Hydrate recent entries from sessionStorage on boot
    try {
      const now = Date.now();
      const keys = Object.keys(sessionStorage);
      for (const k of keys) {
        if (k.startsWith('admin_swr:')) {
          const raw = sessionStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            // Only keep if within max age
            if (parsed && typeof parsed.timestamp === 'number' && now - parsed.timestamp < DEFAULT_CACHE_MAX_AGE_MS) {
              this.memoryCache.set(k.replace('admin_swr:', ''), parsed);
            } else {
              sessionStorage.removeItem(k);
            }
          }
        }
      }
    } catch {}
  }

  /**
   * Get cached data ONLY if within fresh maxAgeMs window.
   * If expired or not present, returns null so caller fetches from PostgreSQL.
   */
  get<T>(key: string, maxAgeMs: number = DEFAULT_CACHE_MAX_AGE_MS): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > maxAgeMs) {
      this.memoryCache.delete(key);
      try {
        sessionStorage.removeItem(`admin_swr:${key}`);
      } catch {}
      return null;
    }

    return entry.data as T;
  }

  /**
   * Get cached data for initial optimistic UI paint regardless of age,
   * but caller MUST follow up with a live revalidation fetch.
   */
  peek<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    this.memoryCache.set(key, entry);
    try {
      sessionStorage.setItem(`admin_swr:${key}`, JSON.stringify(entry));
    } catch {}
  }

  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      this.memoryCache.clear();
      try {
        const keys = Object.keys(sessionStorage);
        for (const k of keys) {
          if (k.startsWith('admin_swr:')) sessionStorage.removeItem(k);
        }
      } catch {}
      this.notifyListeners();
      return;
    }

    for (const k of Array.from(this.memoryCache.keys())) {
      if (k.startsWith(keyOrPrefix)) {
        this.memoryCache.delete(k);
        try {
          sessionStorage.removeItem(`admin_swr:${k}`);
        } catch {}
      }
    }
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  /**
   * Prefetch a URL into cache in the background (used on sidebar hover)
   */
  async prefetch(url: string, params?: Record<string, any>): Promise<void> {
    const cacheKey = params ? `${url}?${JSON.stringify(params)}` : url;
    // Don't refetch if already cached within last 5s
    const entry = this.memoryCache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < DEFAULT_CACHE_MAX_AGE_MS) return;

    try {
      const res = await adminApiClient.get(url, { params });
      if (res.data?.data) {
        this.set(cacheKey, res.data.data);
      }
    } catch {}
  }
}

export const adminFrontendCache = new AdminFrontendCache();

