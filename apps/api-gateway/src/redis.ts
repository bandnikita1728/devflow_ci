/**
 * apps/api-gateway/src/redis.ts
 *
 * Singleton IORedis client for general-purpose application caching.
 * Connects to the REDIS_CACHE_* server (separate from the BullMQ queue connection).
 *
 * IMPORTANT BullMQ contract:
 *   BullMQ manages its own dedicated IORedis connection internally via queue.ts.
 *   This client is used ONLY for app-level operations (idempotency locks, etc.)
 *   and must NOT be passed to BullMQ's Queue or Worker constructors.
 */

import Redis from 'ioredis';
import { config } from './config';

// ── Singleton state ───────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the lazily-initialised singleton IORedis cache client.
 * Creates the client on first call; returns the existing instance thereafter.
 */
export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const retryStrategy = (times: number): number | null => {
    const delay = Math.min(times * 500, 30_000);
    console.warn(`[Redis:Cache] Retrying connection (attempt ${times}) in ${delay}ms...`);
    return delay;
  };

  if (config.redisUrl) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy,
    });
  } else {
    redisClient = new Redis({
      host:     config.redisCache.host,
      port:     config.redisCache.port,
      password: config.redisCache.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy,
    });
  }

  // ── Lifecycle events ───────────────────────────────────────────────────────

  redisClient.on('connect', () => {
    console.info(
      `[Redis:Cache] Connected to ${config.redisCache.host}:${config.redisCache.port}`,
    );
  });

  redisClient.on('ready', () => {
    console.info('[Redis:Cache] Client is ready to accept commands');
  });

  redisClient.on('error', (err: Error) => {
    // Errors are logged but NOT thrown — IORedis handles reconnection automatically.
    console.error('[Redis:Cache] Connection error:', err.message);
  });

  redisClient.on('reconnecting', () => {
    console.warn('[Redis:Cache] Reconnecting...');
  });

  redisClient.on('close', () => {
    console.info('[Redis:Cache] Connection closed');
  });

  return redisClient;
}

// ── Graceful teardown ─────────────────────────────────────────────────────────

/**
 * Cleanly flushes pending commands and disconnects the cache client.
 * Called during graceful shutdown in index.ts.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.info('[Redis:Cache] Disconnected gracefully');
    } catch (err) {
      console.error('[Redis:Cache] Error during disconnect:', (err as Error).message);
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}
