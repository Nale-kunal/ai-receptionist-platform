/**
 * Prompt Cache Service
 *
 * In-memory cache for published PromptTemplate records.
 * No TTL — invalidated explicitly on publish (same pattern as ConfigurationCacheService).
 */

import type { IPromptCacheService } from '../interfaces/prompt-engine.interfaces';
import type { SafePromptTemplate } from '../types/prompt-engine.types';
import type { PromptType } from '../constants/prompt-engine.constants';

export class PromptCacheService implements IPromptCacheService {
  private readonly store: Map<string, SafePromptTemplate>;

  constructor() {
    this.store = new Map();
  }

  public buildKey(tenantId: string, clinicId: string | null, promptType: PromptType): string {
    return `${tenantId}:${clinicId ?? 'null'}:${promptType}`;
  }

  public get(key: string): SafePromptTemplate | undefined {
    return this.store.get(key);
  }

  public set(key: string, value: SafePromptTemplate): void {
    this.store.set(key, value);
  }

  public invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidates all entries matching tenantId + clinicId + promptType (partial key match) */
  public invalidateByScope(tenantId: string, clinicId: string | null, promptType: PromptType): void {
    const key = this.buildKey(tenantId, clinicId, promptType);
    this.invalidate(key);
  }

  public size(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }
}
