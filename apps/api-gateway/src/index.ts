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

// ── App ───────────────────────────────────────────────────────────────────────

const app: Application = express();

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

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/webhooks', webhookRoutes);

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

  const server = app.listen(config.port, () => {
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
