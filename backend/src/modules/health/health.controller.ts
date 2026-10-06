import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { MailQueueService } from '../../shared/email/queue/MailQueueService';
import type { IEmailProvider } from '../../shared/email/interfaces/IEmailProvider';
import { appConfig } from '../../config/app-config.service';

export class HealthController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mailQueueService?: MailQueueService,
    private readonly emailProvider?: IEmailProvider,
  ) {}

  public getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = performance.now();
      let dbHealthy = false;
      let dbLatencyMs = 0;

      try {
        const dbStart = performance.now();
        await this.prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Math.round(performance.now() - dbStart);
        dbHealthy = true;
      } catch (dbErr) {
        dbHealthy = false;
      }

      const mem = process.memoryUsage();
      const status = dbHealthy ? 'healthy' : 'degraded';
      const totalLatencyMs = Math.round(performance.now() - startTime);

      const emailMetrics = this.mailQueueService ? await this.mailQueueService.getMetrics() : null;

      const healthData = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env['APP_VERSION'] || '1.0.0',
        environment: process.env['NODE_ENV'] || 'production',
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: totalLatencyMs,
        services: {
          database: {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            latencyMs: dbLatencyMs,
          },
          email: {
            status: emailMetrics ? (emailMetrics.workerAlive ? 'healthy' : 'degraded') : 'configured',
            provider: this.emailProvider ? this.emailProvider.getProviderName() : appConfig.email.provider,
            fromName: appConfig.email.fromName,
            fromEmail: appConfig.email.fromEmail,
            workerAlive: emailMetrics ? emailMetrics.workerAlive : true,
            queueDepth: emailMetrics ? emailMetrics.queueDepth : 0,
            pendingJobs: emailMetrics ? emailMetrics.pendingJobs : 0,
            failedJobs: emailMetrics ? emailMetrics.failedJobs : 0,
            deliveredJobs: emailMetrics ? emailMetrics.deliveredJobs : 0,
            averageLatencyMs: emailMetrics ? emailMetrics.averageLatencyMs : 0,
            lastSuccessfulDeliveryAt: emailMetrics ? emailMetrics.lastSuccessfulDeliveryAt : null,
            lastFailureAt: emailMetrics ? emailMetrics.lastFailureAt : null,
          },
          voiceServer: {
            status: 'healthy',
          },
          aiEngine: {
            status: 'healthy',
          },
          authEngine: {
            status: 'healthy',
          },
          whatsapp: {
            status: (process.env['WHATSAPP_ACCESS_TOKEN'] && process.env['WHATSAPP_APP_SECRET'] && process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'])
              ? 'configured'
              : 'missing',
            provider: (process.env['NODE_ENV'] === 'production' || process.env['WHATSAPP_ACCESS_TOKEN'])
              ? 'meta-cloud'
              : 'dev-no-op',
          },
        },
        memory: {
          heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        },
      };

      const statusCode = dbHealthy ? 200 : 503;
      res.status(statusCode).json({
        success: dbHealthy,
        data: healthData,
        requestId: req.requestId || '',
      });
    } catch (err) {
      next(err);
    }
  };

  public getWhatsAppHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'];
      const appSecret = process.env['WHATSAPP_APP_SECRET'];
      const verifyToken = process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
      const apiVersion = process.env['WHATSAPP_API_VERSION'] || 'v21.0';

      const isConfigured = Boolean(accessToken && appSecret && verifyToken);
      const isProd = process.env['NODE_ENV'] === 'production';
      const provider = (isProd || accessToken) ? 'meta-cloud' : 'dev-no-op';

      let connectivity: 'healthy' | 'failed' | 'unknown' = 'unknown';

      if (accessToken) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/me`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (metaRes.ok) {
            connectivity = 'healthy';
          } else {
            connectivity = 'failed';
          }
        } catch {
          connectivity = 'failed';
        }
      }

      res.status(200).json({
        success: true,
        data: {
          configuration: isConfigured ? 'configured' : 'missing',
          provider,
          connectivity,
          apiVersion,
        },
        requestId: req.requestId || '',
      });
    } catch (err) {
      next(err);
    }
  };
}
