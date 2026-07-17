import type { IToolValidator } from './ai-tool.interfaces';
import type { IAiTool } from './ai-tool.interfaces';
import { ValidationFailure } from './ai-tool.errors';

export class ToolValidator implements IToolValidator {
  public validateInput(tool: IAiTool, params: Record<string, unknown>): Record<string, unknown> {
    // 1. Enforce payload size protection (HIPAA/SOC2 protection)
    const jsonStr = JSON.stringify(params);
    if (jsonStr.length > 50000) {
      throw new ValidationFailure('Request parameter payload size exceeded maximum limit of 50KB.');
    }

    // 2. Parse parameters using the tool Zod input schema
    try {
      const result = tool.metadata.inputSchema.parse(params);
      return result;
    } catch (err: any) {
      throw new ValidationFailure(`Input schema validation failed: ${err.message}`, { errors: err.errors });
    }
  }

  public validateOutput(tool: IAiTool, result: Record<string, unknown>): Record<string, unknown> {
    try {
      const parsed = tool.metadata.outputSchema.parse(result);
      return parsed;
    } catch (err: any) {
      throw new ValidationFailure(`Output schema validation failed: ${err.message}`, { errors: err.errors });
    }
  }
}
