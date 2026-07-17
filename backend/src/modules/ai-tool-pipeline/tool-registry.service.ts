import type { IToolRegistry, IAiTool } from './ai-tool.interfaces';

export class ToolRegistry implements IToolRegistry {
  private readonly toolsMap: Map<string, IAiTool> = new Map();

  public registerTool(tool: IAiTool): void {
    const key = this.buildKey(tool.metadata.toolId, tool.metadata.version);
    this.toolsMap.set(key, tool);
  }

  public deregisterTool(toolId: string, version: string): void {
    const key = this.buildKey(toolId, version);
    this.toolsMap.delete(key);
  }

  public getTool(toolId: string, version: string): IAiTool | null {
    const key = this.buildKey(toolId, version);
    return this.toolsMap.get(key) ?? null;
  }

  public listAllTools(): IAiTool[] {
    return Array.from(this.toolsMap.values());
  }

  private buildKey(toolId: string, version: string): string {
    return `${toolId}:${version}`;
  }
}
