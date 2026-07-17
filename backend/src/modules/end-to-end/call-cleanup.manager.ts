/**
 * End-to-End Call Flow — Resource Cleanup Manager
 */

import type { ICallCleanupManager, ICallSessionManager, ICallTimeoutManager } from './end-to-end.interfaces';
import { CallSessionManager, callSessionManager } from './call-session.manager';
import { CallContextManager, callContextManager } from './call-context.manager';
import { CallTimeoutManager, callTimeoutManager } from './call-timeout.manager';
import { CallRetryManager, callRetryManager } from './call-retry.manager';

export class CallCleanupManager implements ICallCleanupManager {
  constructor(
    private readonly sessionManager: CallSessionManager,
    private readonly contextManager: CallContextManager,
    private readonly timeoutManager: CallTimeoutManager,
    private readonly retryManager: CallRetryManager,
  ) {}

  public async cleanupSession(sessionId: string): Promise<number> {
    const start = Date.now();

    // 1. Clear timeout timers
    this.timeoutManager.clearAll(sessionId);

    // 2. Clear reconnect retry limits
    this.retryManager.reset(sessionId);

    // 3. Clear context references
    this.contextManager.delete(sessionId);

    // 4. Remove E2E Call session entry
    this.sessionManager.removeSession(sessionId);

    return Date.now() - start;
  }
}
export const callCleanupManager = new CallCleanupManager(
  callSessionManager,
  callContextManager,
  callTimeoutManager,
  callRetryManager,
);
