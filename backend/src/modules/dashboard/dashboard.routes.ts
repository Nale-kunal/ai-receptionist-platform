import { Router, type RequestHandler } from 'express';
import type { DashboardController } from './dashboard.controller';

export interface DashboardRouterDeps {
  controller: DashboardController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
}

export function createDashboardRoutes(deps: DashboardRouterDeps): Router {
  const router = Router();
  router.get('/summary', deps.authenticate, deps.resolveTenant, deps.controller.getSummary);
  router.get('/kpi', deps.authenticate, deps.resolveTenant, deps.controller.getKpiMetrics);
  router.get('/conversations', deps.authenticate, deps.resolveTenant, deps.controller.getConversationsWidget);
  return router;
}
