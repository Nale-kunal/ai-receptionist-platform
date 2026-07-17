import type { IToolRateLimiter } from './ai-tool.interfaces';

export class ToolRateLimiter implements IToolRateLimiter {
  private readonly tenantWindows: Map<string, number[]> = new Map();
  private readonly clinicWindows: Map<string, number[]> = new Map();
  private readonly convWindows: Map<string, number[]> = new Map();
  private readonly toolWindows: Map<string, number[]> = new Map();

  constructor(
    private readonly config: {
      maxPerTenant: number;
      maxPerClinic: number;
      maxPerConv: number;
      maxPerTool: number;
      windowMs: number;
    }
  ) {}

  public async checkRateLimit(
    tenantId: string,
    clinicId: string | null,
    conversationId: string,
    toolId: string
  ): Promise<boolean> {
    const now = Date.now();

    // 1. Tenant Check
    if (!this.evaluateWindow(this.tenantWindows, tenantId, now, this.config.maxPerTenant)) {
      return false;
    }

    // 2. Clinic Check
    if (clinicId) {
      if (!this.evaluateWindow(this.clinicWindows, clinicId, now, this.config.maxPerClinic)) {
        return false;
      }
    }

    // 3. Conversation Check
    if (!this.evaluateWindow(this.convWindows, conversationId, now, this.config.maxPerConv)) {
      return false;
    }

    // 4. Tool Check
    const toolKey = `${tenantId}:${toolId}`;
    if (!this.evaluateWindow(this.toolWindows, toolKey, now, this.config.maxPerTool)) {
      return false;
    }

    return true;
  }

  private evaluateWindow(
    store: Map<string, number[]>,
    key: string,
    now: number,
    limit: number
  ): boolean {
    const timestamps = store.get(key) ?? [];
    const active = timestamps.filter((t) => now - t < this.config.windowMs);
    
    if (active.length >= limit) {
      store.set(key, active);
      return false;
    }

    active.push(now);
    store.set(key, active);
    return true;
  }
}
