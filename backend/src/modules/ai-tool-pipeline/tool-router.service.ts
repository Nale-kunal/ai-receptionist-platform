import type { IToolRouter, IToolRegistry, IToolVersionManager, IAiTool } from './ai-tool.interfaces';
import type { ToolRequest } from './ai-tool.types';
import { ToolUnavailable } from './ai-tool.errors';

export class ToolRouter implements IToolRouter {
  constructor(
    private readonly registry: IToolRegistry,
    private readonly versionManager: IToolVersionManager
  ) {}

  public async route(request: ToolRequest): Promise<IAiTool> {
    const resolvedVersion = this.versionManager.resolveVersion(request.toolId, request.version);
    const tool = this.registry.getTool(request.toolId, resolvedVersion);
    
    if (!tool) {
      throw new ToolUnavailable(`Requested tool handler '${request.toolId}' at version '${resolvedVersion}' is unavailable.`);
    }

    return tool;
  }
}
