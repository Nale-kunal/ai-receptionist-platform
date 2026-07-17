import type { IToolResultNormalizer } from './ai-tool.interfaces';
import type { ToolResult } from './ai-tool.types';
import { AiToolError } from './ai-tool.errors';

export class ToolResultNormalizer implements IToolResultNormalizer {
  public normalizeSuccess(
    toolId: string,
    version: string,
    executionTimeMs: number,
    correlationId: string,
    result: Record<string, unknown>
  ): ToolResult {
    return {
      status: 'success',
      toolId,
      version,
      executionTimeMs,
      correlationId,
      result,
      error: null,
      warnings: [],
    };
  }

  public normalizeFailure(
    toolId: string,
    version: string,
    executionTimeMs: number,
    correlationId: string,
    error: Error
  ): ToolResult {
    let code = 'INTERNAL_ERROR';
    let failureClass = 'PermanentFailure';

    if (error instanceof AiToolError) {
      code = error.code;
      failureClass = error.failureClass;
    }

    return {
      status: 'failure',
      toolId,
      version,
      executionTimeMs,
      correlationId,
      result: null,
      error: {
        code,
        message: error.message,
        failureClass,
      },
      warnings: [],
    };
  }
}
