import type { Request, Response, NextFunction } from 'express';
import type { IToolExecutor, IToolDiscovery, IAiTool } from './ai-tool.interfaces';
import { ExecuteToolRequestSchema, DiscoverToolsQuerySchema } from './tool.validators';

export class ToolController {
  constructor(
    private readonly executor: IToolExecutor,
    private readonly discovery: IToolDiscovery
  ) {}

  public executeTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = ExecuteToolRequestSchema.parse(req.body);
      const context = (req as any).toolContext;

      if (!context || !context.tenantId) {
        res.status(400).json({ success: false, error: 'x-tenant-id header is required.' });
        return;
      }

      const outcome = await this.executor.execute({
        toolId: body.toolId,
        version: body.version,
        parameters: body.parameters,
        context,
      });

      const statusCode = outcome.status === 'success' ? 200 : 400;
      res.status(statusCode).json({ success: outcome.status === 'success', data: outcome });
    } catch (err) {
      next(err);
    }
  };

  public discoverTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = DiscoverToolsQuerySchema.parse(req.query);
      let list: IAiTool[] = [];

      if (query.name) {
        list = this.discovery.discoverByName(query.name);
      } else if (query.category) {
        list = this.discovery.discoverByCategory(query.category);
      } else if (query.tag) {
        list = this.discovery.discoverByTag(query.tag);
      } else if (query.capability) {
        list = this.discovery.discoverByCapability(query.capability);
      } else {
        // Find all
        const registry = (this.discovery as any).registry;
        list = registry.listAllTools();
      }

      res.status(200).json({
        success: true,
        data: {
          tools: list.map((t) => ({
            toolId: t.metadata.toolId,
            toolName: t.metadata.toolName,
            description: t.metadata.description,
            category: t.metadata.category,
            version: t.metadata.version,
            tags: t.metadata.tags,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
