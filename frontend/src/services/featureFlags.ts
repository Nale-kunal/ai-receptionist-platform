/**
 * Enterprise Feature Flag Manager
 *
 * Provides runtime configuration, progressive rollout toggles,
 * and emergency kill-switches for critical frontend architectural subsystems.
 */

export interface FeatureFlags {
  useRequestCoordinator: boolean;
  useCircuitBreaker: boolean;
  useRealTimeUpdates: boolean;
  useReadReplicas: boolean;
  useCursorPagination: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useRequestCoordinator: true,
  useCircuitBreaker: true,
  useRealTimeUpdates: false,
  useReadReplicas: false,
  useCursorPagination: false,
};

class FeatureFlagService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.loadOverrides();
  }

  private loadOverrides(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('app_feature_flags');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.flags = { ...DEFAULT_FLAGS, ...parsed };
      }
    } catch (e) {
      console.warn('[FeatureFlags] Failed to parse local storage overrides:', e);
    }
  }

  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] ?? false;
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public setFlag(flag: keyof FeatureFlags, value: boolean): void {
    this.flags[flag] = value;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('app_feature_flags', JSON.stringify(this.flags));
      } catch (e) {
        console.warn('[FeatureFlags] Failed to persist feature flag override:', e);
      }
    }
  }

  public resetToDefaults(): void {
    this.flags = { ...DEFAULT_FLAGS };
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_feature_flags');
    }
  }
}

export const featureFlags = new FeatureFlagService();
