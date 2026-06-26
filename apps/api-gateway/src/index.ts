/**
 * apps/api-gateway/src/index.ts
 *
 * DevFlow CI — API Gateway entry point.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *  GitHub ──► POST /webhooks/github ──► verifyGitHubSignature (HMAC-SHA256)
 *                                              │
 *                                              ▼
 *                                      webhooks router
 *                                              │
 *                                  ┌───────────┴──────────┐
 *                                  │                      │
 *                            Idempotency             BullMQ Queue
 *                            (Redis SET NX)         "pr-review-queue"
 *                                                         │
 *                                                         ▼
 *                                                  202 Accepted
 *
 * Body parsing strategy:
 *   express.json() is NOT applied globally. The /webhooks/* subtree reads the
 *   raw stream for HMAC verification; JSON parsing happens inside the
 *   verifyGitHubSignature middleware AFTER the signature is validated.
 *   All other routes receive the standard JSON body parser.
 */

import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import { config } from './config';
import { getRedisClient, closeRedisClient } from './redis';
import { getPrReviewQueue, closePrReviewQueue } from './queue';
import webhookRoutes from './routes/webhooks';
import apiRoutes from './routes/api';
import authRoutes from './routes/auth';
import { requireAuth } from './middleware/requireAuth';
import { internalOnly } from './middleware/internalOnly';
import { metricsMiddleware } from './middleware/metrics';
import client from 'prom-client';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ── App ───────────────────────────────────────────────────────────────────────

const app: Application = express();
app.set('trust proxy', 1);
app.use(metricsMiddleware);

// ── Global Middleware ─────────────────────────────────────────────────────────

/**
 * Selective JSON body parsing.
 *
 * Webhook routes need the raw stream for HMAC verification, so we skip the
 * global JSON middleware for the /webhooks/* prefix. The verifyGitHubSignature
 * middleware handles JSON parsing internally after signature validation.
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/webhooks/')) {
    // Deliberately bypass — raw stream will be consumed in the middleware chain.
    next();
    return;
  }
  express.json({ limit: '1mb' })(req, res, next);
});

app.use(cookieParser());

const allowedOrigins = ['http://localhost:5173', 'http://172.31.245.4:5173'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(helmet());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, try again later' }
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests' }
});

app.use('/auth', authLimiter);
app.use('/api/auth', authLimiter);
app.use('/webhooks', webhookLimiter);

// ── Health Check ──────────────────────────────────────────────────────────────

/**
 * GET /health
 * Used by load balancers, Kubernetes liveness probes, and uptime monitors.
 * Returns 200 as long as the process is alive and config is loaded.
 */
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status:    'ok',
    service:   'devflow-ci-api-gateway',
    version:   process.env['npm_package_version'] ?? 'unknown',
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

/**
 * GET /health/circuit
 * Internal health check to retrieve the current state and stats of the Gemini AI circuit breaker.
 */
app.get('/health/circuit', internalOnly, async (_req: Request, res: Response): Promise<void> => {
  try {
    const redis = getRedisClient();
    const data = await redis.get('circuit:gemini:status');
    if (!data) {
      res.status(200).json({
        state: 'closed',
        stats: {
          fires: 0,
          failures: 0,
          successes: 0,
          timeouts: 0,
        },
      });
      return;
    }
    const parsed = JSON.parse(data);
    res.status(200).json({
      state: parsed.state,
      stats: parsed.stats,
    });
  } catch (error: any) {
    console.error('[API-Gateway:CircuitHealth] Error reading circuit status:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /metrics
 * Exposes Prometheus metrics collected from the API Gateway.
 */
app.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error: any) {
    console.error('[API-Gateway:Metrics] Error generating metrics:', error.message);
    res.status(500).end(error);
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/webhooks', webhookRoutes);
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, apiRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────

// Express 4/5 requires the 4-argument signature for error middleware — keep all params.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[Server] Unhandled error:', err.message, '\n', err.stack);
  res
    .status(500)
    .json({ error: 'Internal Server Error' });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Eagerly initialise shared clients so connection errors surface at boot,
  // not on the first request.
  getRedisClient();
  getPrReviewQueue();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.info('');
    console.info('═'.repeat(60));
    console.info('  DevFlow CI — API Gateway');
    console.info('═'.repeat(60));
    console.info(`  Listening on:   http://localhost:${config.port}`);
    console.info(`  Environment:    ${config.nodeEnv}`);
    console.info(`  Webhook URL:    POST http://localhost:${config.port}/webhooks/github`);
    console.info(`  Health check:   GET  http://localhost:${config.port}/health`);
    console.info('═'.repeat(60));
    console.info('');
  });

  // ── Graceful Shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`\n[Server] Received ${signal} — initiating graceful shutdown...`);

    server.close(async () => {
      console.info('[Server] HTTP server closed — draining connections...');
      try {
        await Promise.all([
          closeRedisClient(),
          closePrReviewQueue(),
        ]);
        console.info('[Server] All connections drained. Exiting cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during shutdown:', (err as Error).message);
        process.exit(1);
      }
    });

    // Force-kill if graceful shutdown exceeds 10 seconds (prevents hang).
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out after 10s — forcing exit.');
      process.exit(1);
    }, 10_000).unref(); // .unref() prevents this timer from keeping the event loop alive.
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  // ── Process-level safety nets ─────────────────────────────────────────────

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[Server] Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Do NOT exit — let the error handler report it without crashing the gateway.
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('[Server] Uncaught Exception:', err.message, '\n', err.stack);
    // Uncaught exceptions leave the process in an undefined state — exit and let
    // the process manager (PM2, Docker, systemd) restart it.
    process.exit(1);
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

start().catch((err: Error) => {
  console.error('[Server] Fatal: failed to start:', err.message, '\n', err.stack);
  process.exit(1);
});
