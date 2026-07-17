import type { IToolVersionManager } from './ai-tool.interfaces';
import { ValidationFailure } from './ai-tool.errors';

export class ToolVersionManager implements IToolVersionManager {
  public resolveVersion(toolId: string, requestedVersion: string): string {
    if (!requestedVersion) {
      return '1.0.0';
    }

    const versionPattern = /^\d+(\.\d+){0,2}$/;
    if (!versionPattern.test(requestedVersion)) {
      throw new ValidationFailure(`Invalid semantic version query: '${requestedVersion}'`);
    }

    // Default mapping logic, e.g. mapping simple '1' or '2' to standard '1.0.0' or '2.0.0'
    const parts = requestedVersion.split('.');
    if (parts.length === 1) {
      return `${parts[0]}.0.0`;
    }
    if (parts.length === 2) {
      return `${parts[0]}.${parts[1]}.0`;
    }
    return requestedVersion;
  }
}
