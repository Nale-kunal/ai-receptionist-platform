import type { IToolIdempotencyService } from './ai-tool.interfaces';
import type { ToolRequest, ToolResult } from './ai-tool.types';
import * as crypto from 'crypto';

export class ToolIdempotencyService implements IToolIdempotencyService {
  private readonly cache: Map<string, ToolResult> = new Map();

  public async checkIdempotency(request: ToolRequest): Promise<ToolResult | null> {
    const hash = this.calculateHash(request);
    const existing = this.cache.get(hash);
    if (existing) {
      // Return clone of result adjusting correlationId
      return {
        ...existing,
        correlationId: request.context.correlationId,
      };
    }
    return null;
  }

  public async saveExecutionResult(request: ToolRequest, result: ToolResult): Promise<void> {
    const hash = this.calculateHash(request);
    this.cache.set(hash, result);
  }

  private calculateHash(request: ToolRequest): string {
    const payload = {
      toolId: request.toolId,
      version: request.version,
      tenantId: request.context.tenantId,
      parameters: request.parameters,
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
