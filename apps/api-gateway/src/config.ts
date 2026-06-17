/**
 * apps/api-gateway/src/config.ts
 *
 * Validates all required environment variables on process boot and exports
 * them as a strongly-typed, immutable configuration object.
 *
 * Fail-fast: If any required variable is absent, the process throws before
 * Express or Redis ever initialise, surfacing misconfiguration immediately.
 */

import 'dotenv/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[Config] FATAL — required environment variable "${key}" is missing or empty. ` +
      `Check your .env file.`,
    );
  }
  return value.trim();
}

function requireEnvInt(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (!raw || raw.trim() === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `[Config] FATAL — required integer environment variable "${key}" is missing.`,
    );
  }
  const parsed = parseInt(raw.trim(), 10);
  if (isNaN(parsed)) {
    throw new Error(
      `[Config] FATAL — environment variable "${key}" must be a valid integer, got "${raw}".`,
    );
  }
  return parsed;
}

// ── Validated Config Object ───────────────────────────────────────────────────

export const config = {
  /** HTTP port the Express server listens on. */
  port: requireEnvInt('PORT', 3000),

  /** Deployment environment — controls logging verbosity, etc. */
  nodeEnv: (process.env['NODE_ENV'] ?? 'development').trim() as
    | 'development'
    | 'staging'
    | 'production',

  /** GitHub webhook settings. */
  github: {
    /** HMAC-SHA256 secret configured in the GitHub repo webhook settings. */
    webhookSecret: requireEnv('GITHUB_WEBHOOK_SECRET'),
  },

  /**
   * Redis connection for the BullMQ job queue.
   * Uses a dedicated IORedis connection — NEVER shared with the cache client.
   */
  redisQueue: {
    host: (process.env['REDIS_QUEUE_HOST'] ?? '127.0.0.1').trim(),
    port: requireEnvInt('REDIS_QUEUE_PORT', 6379),
    password: process.env['REDIS_QUEUE_PASSWORD']?.trim() || undefined,
  },

  /**
   * Redis connection for general application caching
   * (e.g. idempotency locks, rate-limiting counters).
   */
  redisCache: {
    host: (process.env['REDIS_CACHE_HOST'] ?? '127.0.0.1').trim(),
    port: requireEnvInt('REDIS_CACHE_PORT', 6379),
    password: process.env['REDIS_CACHE_PASSWORD']?.trim() || undefined,
  },

  /** BullMQ queue names. */
  queues: {
    prReview: (process.env['PR_REVIEW_QUEUE_NAME'] ?? 'pr-review-queue').trim(),
  },

  /** PostgreSQL connection string (available for future Phase 2 usage). */
  databaseUrl: requireEnv('DATABASE_URL'),

  /** Single Redis URL from Render (if provided) */
  redisUrl: process.env['REDIS_URL']?.trim() || undefined,
} as const;

// Log validated config (redact secrets) on startup
console.info('[Config] Environment validated successfully:');
console.info(`  NODE_ENV           = ${config.nodeEnv}`);
console.info(`  PORT               = ${config.port}`);
console.info(`  REDIS_QUEUE        = ${config.redisQueue.host}:${config.redisQueue.port}`);
console.info(`  REDIS_CACHE        = ${config.redisCache.host}:${config.redisCache.port}`);
console.info(`  QUEUE_NAME         = ${config.queues.prReview}`);
console.info(`  GITHUB_SECRET      = [SET]`);
