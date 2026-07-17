/**
 * End-to-End Call Flow — Context Manager
 */

import type { E2eCallContext } from './end-to-end.types';

export class CallContextManager {
  private readonly contexts = new Map<string, E2eCallContext>();

  public create(
    sessionId: string,
    params: {
      tenantId: string;
      clinicId: string | null;
      conversationId: string;
      callerNumber: string;
      calledNumber: string;
    },
  ): E2eCallContext {
    const context: E2eCallContext = {
      ...params,
      startTime: Date.now(),
      endTime: null,
      variables: {},
      metadata: {},
    };

    this.contexts.set(sessionId, context);
    return context;
  }

  public get(sessionId: string): E2eCallContext | undefined {
    return this.contexts.get(sessionId);
  }

  public updateVariables(sessionId: string, variables: Record<string, string>): void {
    const ctx = this.contexts.get(sessionId);
    if (ctx) {
      ctx.variables = { ...ctx.variables, ...variables };
    }
  }

  public updateMetadata(sessionId: string, metadata: Record<string, unknown>): void {
    const ctx = this.contexts.get(sessionId);
    if (ctx) {
      ctx.metadata = { ...ctx.metadata, ...metadata };
    }
  }

  public delete(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}
export const callContextManager = new CallContextManager();
