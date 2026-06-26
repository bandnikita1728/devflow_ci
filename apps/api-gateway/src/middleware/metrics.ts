import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Enable default metrics collection for API Gateway
client.collectDefaultMetrics({ prefix: 'api_gateway_' });

// Whitelist of valid routes to prevent high-cardinality label values (e.g. from user IDs, dynamic IDs)
const ROUTE_WHITELIST = new Set([
  '/health',
  '/health/circuit',
  '/metrics',
  '/webhooks/github',
  '/api/stats',
  '/api/reviews',
  '/api/reviews/:id',
  '/api/repos',
  '/api/repos/:id',
  '/auth/login',
  '/auth/callback',
  '/auth/logout',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/logout'
]);

// ── Metrics ──────────────────────────────────────────────────────────────────

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

export const webhookEventsReceived = new client.Counter({
  name: 'webhook_events_received_total',
  help: 'Total number of webhook events received',
  labelNames: ['event_type', 'validation_status']
});

export const webhookDuplicatesSkipped = new client.Counter({
  name: 'webhook_duplicates_skipped_total',
  help: 'Total number of duplicate webhooks skipped'
});

export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active HTTP connections'
});

// ── Middleware ───────────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Exclude /metrics endpoint request details from logging/metrics to avoid feedback loops or logs noise
  if (req.path === '/metrics') {
    next();
    return;
  }

  activeConnections.inc();
  const startTime = process.hrtime();
  let finished = false;

  const recordDuration = () => {
    if (finished) return;
    finished = true;
    activeConnections.dec();

    const diff = process.hrtime(startTime);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    // Build matched Express route pattern (e.g. "/api/reviews/:id") to avoid dynamic params
    let route = 'other';
    const matchedPath = req.route
      ? (req.baseUrl + req.route.path)
      : req.path;

    if (ROUTE_WHITELIST.has(matchedPath)) {
      route = matchedPath;
    }

    const method = req.method.toUpperCase();
    const statusCode = String(res.statusCode);

    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode
      },
      durationInSeconds
    );
  };

  // Listen to both finish and close events
  res.on('finish', recordDuration);
  res.on('close', recordDuration);

  next();
}
