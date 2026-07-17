import type { IToolDiscovery, IToolRegistry, IAiTool } from './ai-tool.interfaces';

export class ToolDiscovery implements IToolDiscovery {
  constructor(private readonly registry: IToolRegistry) {}

  public discoverByName(name: string): IAiTool[] {
    const list = this.registry.listAllTools();
    return list.filter((t) => t.metadata.toolName.toLowerCase().includes(name.toLowerCase()));
  }

  public discoverByCategory(category: string): IAiTool[] {
    const list = this.registry.listAllTools();
    return list.filter((t) => t.metadata.category.toLowerCase() === category.toLowerCase());
  }

  public discoverByTag(tag: string): IAiTool[] {
    const list = this.registry.listAllTools();
    return list.filter((t) => t.metadata.tags.some((tg) => tg.toLowerCase() === tag.toLowerCase()));
  }

  public discoverByCapability(capability: string): IAiTool[] {
    const list = this.registry.listAllTools();
    return list.filter((t) => t.metadata.description.toLowerCase().includes(capability.toLowerCase()));
  }
}
