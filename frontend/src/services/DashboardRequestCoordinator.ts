import { axiosClient } from './axiosClient';
import { telemetry } from './telemetry';
import { tokenManager } from '../auth/tokenManager';

export interface RequestCoordinatorOptions {
  cacheTtlMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  signal?: AbortSignal;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

export class DashboardRequestCoordinator {
  private static instance: DashboardRequestCoordinator;
  private inFlightMap = new Map<string, Promise<any>>();
  private cacheMap = new Map<string, CacheEntry<any>>();

  private constructor() {}

  public static getInstance(): DashboardRequestCoordinator {
    if (!DashboardRequestCoordinator.instance) {
      DashboardRequestCoordinator.instance = new DashboardRequestCoordinator();
    }
    return DashboardRequestCoordinator.instance;
  }

  /**
   * Invalidate specific key or all entries in the coordinator cache
   */
  public invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cacheMap.clear();
      return;
    }
    for (const key of this.cacheMap.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cacheMap.delete(key);
      }
    }
  }

  /**
   * Deduplicated, lifecycle-aware widget data fetching with ETag cache revalidation
   */
  public async fetchWidgetData<T>(
    key: string,
    endpointUrl: string,
    options: RequestCoordinatorOptions = {}
  ): Promise<T> {
    const { cacheTtlMs = 5000, signal } = options;

    // Check short-lived client memory cache
    const now = Date.now();
    const cached = this.cacheMap.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // Deduplicate in-flight requests for the exact same key
    if (this.inFlightMap.has(key)) {
      return this.inFlightMap.get(key)!;
    }

    const fetchPromise = (async (): Promise<T> => {
      try {
        const headers: Record<string, string> = {};
        if (cached?.etag) {
          headers['If-None-Match'] = cached.etag;
        }

        const res = await axiosClient.get(endpointUrl, {
          headers,
          signal,
        });

        // HTTP 304 Not Modified — return cached data and refresh TTL
        if (res.status === 304 && cached) {
          cached.expiresAt = Date.now() + cacheTtlMs;
          return cached.data;
        }

        const rawData = res.data?.data || res.data;
        const etag = res.headers['etag'] as string | undefined;

        this.cacheMap.set(key, {
          data: rawData,
          expiresAt: Date.now() + cacheTtlMs,
          etag,
        });

        telemetry.track('widget_loaded', {
          module: 'request_coordinator',
          action: endpointUrl,
          result: 'success',
          httpStatus: res.status,
        });

        return rawData;
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          throw err;
        }

        // On 304 or network error with stale cache, fallback gracefully
        if (cached?.data) {
          console.warn(`[RequestCoordinator] Serving stale cache for ${key} after error:`, err);
          return cached.data;
        }

        telemetry.track('widget_failed', {
          module: 'request_coordinator',
          action: endpointUrl,
          result: 'failure',
          errorCode: err.code || err.name || 'FETCH_ERROR',
        });

        throw err;
      } finally {
        this.inFlightMap.delete(key);
      }
    })();

    this.inFlightMap.set(key, fetchPromise);
    return fetchPromise;
  }
}

export const requestCoordinator = DashboardRequestCoordinator.getInstance();
