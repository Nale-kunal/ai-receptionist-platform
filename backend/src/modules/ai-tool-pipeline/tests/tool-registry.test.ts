import { ToolRegistry } from '../tool-registry.service';
import { ToolDiscovery } from '../tool-discovery.service';
import { ToolVersionManager } from '../tool-version.manager';
import type { IAiTool } from '../ai-tool.interfaces';
import { z } from 'zod';

describe('ToolRegistry & Discovery & VersionManager', () => {
  let registry: ToolRegistry;
  let discovery: ToolDiscovery;
  let versionManager: ToolVersionManager;
  let mockTool: IAiTool;

  beforeEach(() => {
    registry = new ToolRegistry();
    discovery = new ToolDiscovery(registry);
    versionManager = new ToolVersionManager();

    mockTool = {
      metadata: {
        toolId: 'test.tool',
        toolName: 'Test Tool Description',
        description: 'Capability test matching FAQ lookup policy.',
        category: 'general' as const,
        version: '1.0.0',
        requiredPermissions: [],
        requiredTenantScope: true,
        inputSchema: z.object({ param: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        idempotent: true,
        auditLevel: 'low',
        deprecated: false,
        tags: ['custom-tag'],
      },
      execute: async () => ({ result: 'ok' }),
    };
  });

  it('registers and retrieves tool handlers', () => {
    registry.registerTool(mockTool);
    const retrieved = registry.getTool('test.tool', '1.0.0');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.metadata.toolName).toBe('Test Tool Description');
  });

  it('deregisters handlers correctly', () => {
    registry.registerTool(mockTool);
    registry.deregisterTool('test.tool', '1.0.0');
    expect(registry.getTool('test.tool', '1.0.0')).toBeNull();
  });

  it('discovers tools by name, category, tag, and capability', () => {
    registry.registerTool(mockTool);

    expect(discovery.discoverByName('Test').length).toBe(1);
    expect(discovery.discoverByCategory('general').length).toBe(1);
    expect(discovery.discoverByTag('custom-tag').length).toBe(1);
    expect(discovery.discoverByCapability('FAQ').length).toBe(1);
  });

  it('resolves semantic versions correctly', () => {
    expect(versionManager.resolveVersion('t', '1')).toBe('1.0.0');
    expect(versionManager.resolveVersion('t', '1.2')).toBe('1.2.0');
    expect(versionManager.resolveVersion('t', '1.2.3')).toBe('1.2.3');
  });
});
