import { Router } from 'express';
import { ToolController } from './tool.controller';
import { createToolContextMiddleware } from './tool.middleware';
import type { IToolExecutor, IToolDiscovery } from './ai-tool.interfaces';

export function createToolRouter(
  executor: IToolExecutor,
  discovery: IToolDiscovery
): Router {
  const router = Router();
  const controller = new ToolController(executor, discovery);
  const contextMiddleware = createToolContextMiddleware();

  router.post('/execute', contextMiddleware, controller.executeTool);
  router.get('/discover', controller.discoverTools);

  return router;
}
