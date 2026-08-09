/**
 * Voice Server — Production Entry Point
 *
 * composition root: sets up Twilio HTTP webhook endpoints and the WebSocket media stream gateway.
 * Implements health checks, basic Prometheus metrics, and graceful shutdown per ADR-0026.
 *
 * Port: process.env.PORT ?? 5000
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadTwilioConfig } from './providers/twilio/twilio.config';
import { TwilioSecurityValidator } from './providers/twilio/twilio.security.validator';
import { TwilioVoiceSessionManager } from './providers/twilio/twilio.voice-session.manager';
import { TwilioWebhookController } from './providers/twilio/twilio.webhook.controller';
import { createTwilioWebhookRoutes } from './providers/twilio/twilio.webhook.routes';
import { TwilioWebsocketGateway } from './providers/twilio/twilio.websocket.gateway';
import { TwilioMediaStreamHandler } from './providers/twilio/twilio.media-stream.handler';
import { TwilioMetricsCollector } from './providers/twilio/twilio.metrics.collector';
import { TwilioAuditLogger } from './providers/twilio/twilio.audit.logger';
import { VoiceSessionManager } from './sessions/voice-session.manager';
import { VoiceConnectionManager } from './services/voice-connection.manager';
import { DEFAULT_VOICE_SERVER_CONFIG } from './config/voice-server.config';
import { validateEnv } from './config/env.validator';
import { setupLogRedaction } from './utils/redactor';

async function bootstrap(): Promise<void> {
  // ── Global log redaction and environment checks ───────────────────────────
  setupLogRedaction();
  validateEnv();

  const PORT = parseInt(process.env['PORT'] ?? '5000', 10);

  // 1. Configurations
  const twilioConfig = loadTwilioConfig({
    mediaStreamUrl: process.env['TWILIO_MEDIA_STREAM_URL'] ?? 'wss://localhost/voice-stream',
  });

  // 2. Shared Core Infrastructure Services
  const voiceSessionManager = new VoiceSessionManager({
    rateLimitSessionsPerMinute: DEFAULT_VOICE_SERVER_CONFIG.rateLimitSessionsPerMinute,
  });

  // 3. Twilio Specific Services
  const twilioSessionManager = new TwilioVoiceSessionManager();
  const securityValidator = new TwilioSecurityValidator(twilioConfig.authToken);
  const metricsCollector = new TwilioMetricsCollector();
  const auditLogger = new TwilioAuditLogger();

  const voiceConnectionManager = new VoiceConnectionManager(
    {
      heartbeatIntervalMs: DEFAULT_VOICE_SERVER_CONFIG.heartbeatIntervalMs,
      idleTimeoutMs: DEFAULT_VOICE_SERVER_CONFIG.idleTimeoutMs,
    },
    (sessionId, error) => {
      console.warn(`[voice-server] Connection timeout for session ${sessionId}:`, error.message);
      const twilioSession = twilioSessionManager.getSession(sessionId);
      if (twilioSession) {
        voiceSessionManager.endSession(sessionId, twilioSession.tenantId, {
          code: 'CONNECTION_TIMEOUT',
          message: error.message,
        }).catch(() => {});
        twilioSessionManager.removeSession(sessionId);
      }
    }
  );

  const mediaHandlerFactory = (streamSid: string) => {
    return new TwilioMediaStreamHandler(
      {
        silenceThresholdDb: twilioConfig.silenceThresholdDb,
        silenceDurationMs: twilioConfig.silenceDurationMs,
      },
      voiceSessionManager,
      twilioSessionManager,
      metricsCollector,
      auditLogger,
      (normalizedEvent) => {
        // Here we handle incoming events from the stream (VAD silence, DTMF, media frame)
        // In a complete architecture, these would be dispatched via events / Kafka / Redis pubsub
        // or directly invoked against the Realtime AI Adapter/Conversation Orchestrator.
        console.debug(`[voice-server] Event ${normalizedEvent.type} for session ${normalizedEvent.sessionId}`);
      }
    );
  };

  const websocketGateway = new TwilioWebsocketGateway(
    twilioSessionManager,
    voiceConnectionManager,
    mediaHandlerFactory
  );

  const webhookController = new TwilioWebhookController(
    twilioConfig,
    securityValidator,
    voiceSessionManager,
    twilioSessionManager
  );

  // 4. Express HTTP setup
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic request logger
  app.use((req, _res, next) => {
    console.log(`[voice-server] HTTP ${req.method} ${req.url}`);
    next();
  });

  // Health and Readiness probes
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'voice-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ready' });
  });

  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    const snapshot = metricsCollector.getSnapshot();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send([
      '# HELP voice_active_calls Total active call streams',
      '# TYPE voice_active_calls gauge',
      `voice_active_calls ${twilioSessionManager.activeCount()}`,
      '',
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime().toFixed(3)}`,
    ].join('\n'));
  });

  // Twilio HTTP routes
  app.use(createTwilioWebhookRoutes(webhookController));

  // Global HTTP error handler for Twilio webhooks
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[voice-server] Unhandled webhook error:', err);
    res.status(500).type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>`
    );
  });

  // 5. Create HTTP Server
  const server = http.createServer(app);

  // 6. Setup WebSocket Server for Media Streams
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '', `http://${request.headers.host}`).pathname;

    if (pathname === '/voice-stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
    console.log('[voice-server] WebSocket connection established');
    websocketGateway.handleConnection(ws, request);
  });

  // 7. Start listening
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[voice-server] Listening on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);

  // 8. Graceful shutdown handling per ADR-0026
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[voice-server] Received ${signal}. Initiating graceful shutdown…`);

    // Stop accepting upgrades and connections
    server.close(async () => {
      console.log('[voice-server] HTTP/WS server closed. Tearing down active connections…');
      
      // Close all WebSocket gateway sessions cleanly
      websocketGateway.shutdownGracefully();
      await voiceConnectionManager.shutdownGracefully();
      
      console.log('[voice-server] Shutdown complete.');
      process.exit(0);
    });

    // Timeout fallback after 30 seconds
    setTimeout(() => {
      console.error('[voice-server] Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 30_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[voice-server] Fatal startup error:', err);
  process.exit(1);
});
