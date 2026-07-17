import type { ToolResult } from './ai-tool.types';

export interface ExecuteToolRequest {
  toolId: string;
  version?: string;
  parameters: Record<string, unknown>;
}

export interface ExecuteToolResponse {
  success: boolean;
  data: ToolResult;
}

export interface DiscoverToolsResponse {
  success: boolean;
  data: {
    tools: Array<{
      toolId: string;
      toolName: string;
      description: string;
      category: string;
      version: string;
      tags: string[];
    }>;
  };
}
