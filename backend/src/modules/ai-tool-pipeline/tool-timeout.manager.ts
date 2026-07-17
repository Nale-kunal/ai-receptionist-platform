import type { IToolTimeoutManager } from './ai-tool.interfaces';
import { PermanentFailure } from './ai-tool.errors';

export class ToolTimeoutManager implements IToolTimeoutManager {
  public async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new PermanentFailure(`Execution timeout triggered: exceeded ${timeoutMs}ms limit.`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
