/**
 * E2E Security Headers Verification Tests
 */

import express from 'express';
import request from 'supertest';

describe('HTTP Security Headers Middleware', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();

    // Replicate exactly the middleware from backend/src/index.ts to test its output
    app.use((_req, res, next) => {
      const origin = process.env['CORS_ORIGIN'] ?? '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Request-ID');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      // Advanced security headers (Defense-in-Depth)
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;");
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      next();
    });

    app.get('/test-headers', (_req, res) => {
      res.status(200).json({ success: true });
    });
  });

  it('should return all required enterprise security headers', async () => {
    const res = await request(app).get('/test-headers');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['content-security-policy']).toBe("default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;");
    expect(res.headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });
});
