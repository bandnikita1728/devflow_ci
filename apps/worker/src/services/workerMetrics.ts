import http from 'http';
import client from 'prom-client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Enable default metrics collection for Worker
client.collectDefaultMetrics({ prefix: 'worker_' });

// ── Metrics ──────────────────────────────────────────────────────────────────

export const reviewJobsProcessed = new client.Counter({
  name: 'review_jobs_processed_total',
  help: 'Total number of pull request review jobs processed',
  labelNames: ['status'] // 'success' | 'failed' | 'circuit_open'
});

export const reviewJobDuration = new client.Histogram({
  name: 'review_job_duration_seconds',
  help: 'Duration of review jobs in seconds',
  buckets: [1, 5, 10, 30, 60, 120]
});

export const geminiApiCallDuration = new client.Histogram({
  name: 'gemini_api_call_duration_seconds',
  help: 'Duration of Gemini AI service calls in seconds',
  buckets: [0.5, 1, 2, 5, 10, 15]
});

export const bullmqQueueDepth = new client.Gauge({
  name: 'bullmq_queue_depth',
  help: 'Number of active, waiting, and delayed jobs in BullMQ'
});

export const bullmqDeadLetterQueueDepth = new client.Gauge({
  name: 'bullmq_dead_letter_queue_depth',
  help: 'Number of failed jobs (dead letter queue depth) in BullMQ'
});

// ── Background Queue Depth Poller ───────────────────────────────────────────

let prQueue: Queue | null = null;

export function startQueueDepthPoller(): void {
  const connection: any = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : {
        host:                 process.env.REDIS_QUEUE_HOST || 'localhost',
        port:                 Number(process.env.REDIS_QUEUE_PORT) || 6379,
        maxRetriesPerRequest: null,
      };

  prQueue = new Queue('pr-review-queue', { connection });

  // Poll job counts every 15 seconds
  setInterval(async () => {
    if (!prQueue) return;
    try {
      const counts = await prQueue.getJobCounts();
      // Queue depth: wait + active + delayed
      bullmqQueueDepth.set((counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0));
      bullmqDeadLetterQueueDepth.set(counts.failed || 0);
    } catch (err: any) {
      console.error('[Worker:Metrics:Poller] Failed to update queue metrics:', err.message);
    }
  }, 15000).unref();

  console.log('[Worker:Metrics] Queue depth polling started (every 15s)');
}

// ── Metrics HTTP Scraper Server ──────────────────────────────────────────────

export function startMetricsServer(): void {
  const metricsPort = process.env.WORKER_METRICS_PORT ? Number(process.env.WORKER_METRICS_PORT) : 3002;
  const metricsSecret = process.env.METRICS_SECRET;

  if (!metricsSecret) {
    console.warn('[Worker:Metrics] WARNING: METRICS_SECRET is not configured. Metrics endpoint will block all external requests.');
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/metrics') {
      const authHeader = req.headers['x-metrics-secret'];

      if (!metricsSecret || authHeader !== metricsSecret) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      try {
        res.writeHead(200, { 'Content-Type': client.register.contentType });
        res.end(await client.register.metrics());
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message || 'Internal Metrics Error');
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(metricsPort, '0.0.0.0', () => {
    console.log(`[Worker:Metrics] Metrics scraper server listening on http://0.0.0.0:${metricsPort}/metrics`);
  });

  // ── Pushgateway Periodical Push (Render Sidecar alternative) ───────────────
  const pushgatewayUrl = process.env.PUSHGATEWAY_URL;
  if (pushgatewayUrl) {
    const gateway = new client.Pushgateway(pushgatewayUrl, { timeout: 5000 });
    
    setInterval(() => {
      gateway.push({ jobName: 'devflow-worker' })
        .catch((err: any) => {
          console.error('[Worker:Metrics:Push] Failed to push to Pushgateway:', err.message);
        });
    }, 15000).unref();
    console.log(`[Worker:Metrics] Periodic Pushgateway exporter active (pushing to ${pushgatewayUrl} every 15s)`);
  }
}
