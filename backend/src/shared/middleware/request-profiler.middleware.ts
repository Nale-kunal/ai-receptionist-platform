/**
 * Request Lifecycle Profiler Middleware
 *
 * High-precision performance measurement for incoming HTTP requests.
 * Tracks timestamps across 10 critical lifecycle stages:
 *   T0  - Request received
 *   T1  - Auth complete
 *   T2  - Tenant resolution complete
 *   T3  - RBAC complete
 *   T4  - Controller entered
 *   T5  - Service entered
 *   T6  - Repository entered
 *   T7  - Prisma query start
 *   T8  - Prisma query end
 *   T9  - Response serialization
 *   T10 - Response sent
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { performance } from 'perf_hooks';

export class RequestProfiler {
  public readonly t0_request_received: number;
  public t1_auth_complete?: number;
  public t2_tenant_resolution_complete?: number;
  public t3_rbac_complete?: number;
  public t4_controller_entered?: number;
  public t5_service_entered?: number;
  public t6_repository_entered?: number;
  public t7_prisma_query_start?: number;
  public t8_prisma_query_end?: number;
  public t9_response_serialization?: number;
  public t10_response_sent?: number;
  public dbQueriesCount = 0;
  public totalDbTimeMs = 0;

  constructor() {
    this.t0_request_received = performance.now();
  }

  public markAuthComplete(): void {
    this.t1_auth_complete = performance.now();
  }

  public markTenantComplete(): void {
    this.t2_tenant_resolution_complete = performance.now();
  }

  public markRbacComplete(): void {
    this.t3_rbac_complete = performance.now();
  }

  public markControllerEntered(): void {
    this.t4_controller_entered = performance.now();
  }

  public markServiceEntered(): void {
    this.t5_service_entered = performance.now();
  }

  public markRepositoryEntered(): void {
    this.t6_repository_entered = performance.now();
  }

  public markPrismaStart(): void {
    this.t7_prisma_query_start = performance.now();
  }

  public markPrismaEnd(durationMs?: number): void {
    this.t8_prisma_query_end = performance.now();
    this.dbQueriesCount++;
    if (durationMs !== undefined) {
      this.totalDbTimeMs += durationMs;
    }
  }

  public markSerializationStart(): void {
    this.t9_response_serialization = performance.now();
  }

  public markResponseSent(): void {
    this.t10_response_sent = performance.now();
  }

  public getBreakdown(): Record<string, string> {
    const t0 = this.t0_request_received;
    const authMs = this.t1_auth_complete !== undefined ? (this.t1_auth_complete - t0).toFixed(2) : 'N/A';
    const tenantMs =
      this.t2_tenant_resolution_complete !== undefined && this.t1_auth_complete !== undefined
        ? (this.t2_tenant_resolution_complete - this.t1_auth_complete).toFixed(2)
        : 'N/A';
    const rbacMs =
      this.t3_rbac_complete !== undefined && this.t2_tenant_resolution_complete !== undefined
        ? (this.t3_rbac_complete - this.t2_tenant_resolution_complete).toFixed(2)
        : 'N/A';
    const totalMs = this.t10_response_sent !== undefined ? (this.t10_response_sent - t0).toFixed(2) : (performance.now() - t0).toFixed(2);

    return {
      total: `${totalMs} ms`,
      auth: `${authMs} ms`,
      tenant: `${tenantMs} ms`,
      rbac: `${rbacMs} ms`,
      dbCount: `${this.dbQueriesCount}`,
      dbTotal: `${this.totalDbTimeMs.toFixed(2)} ms`,
    };
  }

  public logBreakdown(path: string, method: string): void {
    const b = this.getBreakdown();
    console.log(
      `[PROFILER] ${method} ${path} -> Total: ${b['total']} | Auth: ${b['auth']} | Tenant: ${b['tenant']} | RBAC: ${b['rbac']} | DB Queries: ${b['dbCount']} (${b['dbTotal']})`
    );
  }
}

declare global {
  namespace Express {
    interface Request {
      profiler?: RequestProfiler;
    }
  }
}

export function createRequestProfilerMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const profiler = new RequestProfiler();
    req.profiler = profiler;

    const originalSend = res.send.bind(res);
    res.send = function (body: any): Response {
      profiler.markResponseSent();

      // Format Server-Timing headers
      const b = profiler.getBreakdown();
      const serverTimingHeader = [
        `total;dur=${parseFloat(b['total']) || 0};desc="Total Time"`,
        `auth;dur=${parseFloat(b['auth']) || 0};desc="Auth"`,
        `tenant;dur=${parseFloat(b['tenant']) || 0};desc="Tenant Resolution"`,
        `rbac;dur=${parseFloat(b['rbac']) || 0};desc="RBAC"`,
        `db;dur=${parseFloat(b['dbTotal']) || 0};desc="DB Queries (${profiler.dbQueriesCount})"`
      ].join(', ');

      res.setHeader('Server-Timing', serverTimingHeader);

      if (process.env['ENABLE_PROFILER_LOGS'] === 'true') {
        profiler.logBreakdown(req.originalUrl || req.url, req.method);
      }

      return originalSend(body);
    };

    next();
  };
}
