/**
 * apps/api-gateway/src/queue.ts
 *
 * Initialises the BullMQ "pr-review-queue" Queue instance with its own
 * dedicated IORedis connection.
 *
 * ARCHITECTURE RULE:
 *   BullMQ requires exclusive ownership of its Redis connection.
 *   This file creates a private IORedis instance via ConnectionOptions —
 *   it is NEVER shared with the cache client in redis.ts.
 *
 * BullMQ Connection Contract:
 *   When passing a plain ConnectionOptions object (not a pre-built IORedis
 *   instance), BullMQ internally constructs its own Redis client and sets
 *   maxRetriesPerRequest to null automatically. This is the recommended
 *   approach per BullMQ v5 docs to avoid "ERR_USE_AFTER_CLOSE" errors.
 */

import { Queue, ConnectionOptions } from 'bullmq';
import { config } from './config';

// ── Job Data Contract ─────────────────────────────────────────────────────────

/**
 * Strongly-typed payload stored in each BullMQ job.
 * Mirrored in worker.ts — keep both in sync.
 */
export interface PrReviewJobData {
  /** UUID assigned by GitHub to uniquely identify this webhook delivery. */
  deliveryId: string;

  /** The GitHub event name, e.g. "pull_request". */
  event: string;

  /** The action within the event, e.g. "opened", "synchronize". */
  action: string;

  /** Full repo name in "owner/repo" format. */
  repositoryFullName: string;

  /** PR number (integer). */
  pullRequestNumber: number;

  /** Full HTML URL to the pull request. */
  pullRequestUrl: string;

  /** The HEAD commit SHA of the PR's source branch. */
  headSha: string;

  /** ISO-8601 timestamp of when the job was enqueued. */
  enqueuedAt: string;

  /** Full decoded JSON payload from GitHub for audit / debugging. */
  rawPayload: Record<string, unknown>;
}

// ── BullMQ Connection ─────────────────────────────────────────────────────────

/**
 * Plain connection options handed to BullMQ.
 * BullMQ will create its own managed IORedis client from these options,
 * setting maxRetriesPerRequest: null internally as required.
 */
const bullMqConnection: ConnectionOptions = {
  host:     config.redisQueue.host,
  port:     config.redisQueue.port,
  password: config.redisQueue.password,
  // enableReadyCheck: false is BullMQ's default and must stay false
  // to avoid blocking on first connection before the server is ready.
};

// ── Singleton state ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrReviewQueue = Queue<PrReviewJobData, any, string>;
let prReviewQueue: PrReviewQueue | null = null;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the lazily-initialised singleton BullMQ Queue.
 * Called at startup in index.ts to eagerly surface connection errors.
 */
export function getPrReviewQueue(): PrReviewQueue {
  if (prReviewQueue) return prReviewQueue;

  prReviewQueue = new Queue<PrReviewJobData>(config.queues.prReview, {
    connection: bullMqConnection,

    defaultJobOptions: {
      /**
       * Retry up to 3 times on transient failures (network blips, Redis hiccups).
       * The worker controls retry logic; we only set the ceiling here.
       */
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 2_000, // 2s, 4s, 8s
      },

      /**
       * Keep the 100 most recent completed jobs for debugging.
       * Keeps Redis memory bounded in production.
       */
      removeOnComplete: { count: 100 },

      /** Keep the 500 most recent failed jobs for post-mortem analysis. */
      removeOnFail: { count: 500 },
    },
  });

  // ── Queue lifecycle events ─────────────────────────────────────────────────
  prReviewQueue.on('error', (err: Error) => {
    console.error(`[Queue] "${config.queues.prReview}" error:`, err.message);
  });

  console.info(`[Queue] "${config.queues.prReview}" initialised`);
  console.info(`[Queue] Redis: ${config.redisQueue.host}:${config.redisQueue.port}`);

  return prReviewQueue;
}

// ── Graceful teardown ─────────────────────────────────────────────────────────

/**
 * Drains the queue's internal connection and releases resources.
 * Called during graceful shutdown in index.ts.
 */
export async function closePrReviewQueue(): Promise<void> {
  if (prReviewQueue) {
    try {
      await prReviewQueue.close();
      console.info(`[Queue] "${config.queues.prReview}" closed gracefully`);
    } catch (err) {
      console.error('[Queue] Error closing queue:', (err as Error).message);
    } finally {
      prReviewQueue = null;
    }
  }
}
