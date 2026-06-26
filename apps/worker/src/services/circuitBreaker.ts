import 'dotenv/config';
import { readFileSync } from 'fs';
import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { GoogleGenAI } from '@google/genai';
import CircuitBreaker from 'opossum';
import { geminiApiCallDuration } from './workerMetrics';

// ── GitHub App & Database Initialisation ────────────────────────────────────
let app: App;
try {
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY ||
    readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH || './devflow-ci.2026-06-17.private-key.pem', 'utf8');

  app = new App({
    appId: process.env.GITHUB_APP_ID || '',
    privateKey,
    Octokit: Octokit as any,
  });
} catch (e: any) {
  console.error('[CircuitBreaker] Failed to initialize GitHub App:', e.message);
}

const prisma = new PrismaClient();

// ── Redis Connection Singleton ───────────────────────────────────────────────
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;
  const connectionString = process.env.REDIS_URL;
  if (connectionString) {
    redisClient = new Redis(connectionString, { maxRetriesPerRequest: null });
  } else {
    redisClient = new Redis({
      host: process.env.REDIS_QUEUE_HOST || 'localhost',
      port: Number(process.env.REDIS_QUEUE_PORT) || 6379,
      maxRetriesPerRequest: null,
    });
  }

  redisClient.on('error', (err) => {
    // Log error locally, do not crash as per instructions
    console.error('[Worker:CircuitBreaker:Redis] Error:', err.message);
  });

  return redisClient;
}

// ── Gemini AI client ─────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Context Interface ────────────────────────────────────────────────────────
export interface CircuitBreakerContext {
  owner: string;
  repo: string;
  pullRequestNumber: number;
  headSha: string;
  repositoryFullName: string;
  bullmqJobId?: string;
}

// ── Helper functions for stats serialization and error sanitisation ─────────
function getSerializedStats(breakerInstance: CircuitBreaker): {
  fires: number;
  failures: number;
  successes: number;
  timeouts: number;
} {
  const s = breakerInstance.stats;
  return {
    fires: s.fires || 0,
    failures: s.failures || 0,
    successes: s.successes || 0,
    timeouts: s.timeouts || 0,
  };
}

function sanitizeError(err: any): string {
  if (!err) return 'Unknown error';
  let message = err.message || String(err);
  if (process.env.GEMINI_API_KEY) {
    message = message.replace(new RegExp(process.env.GEMINI_API_KEY, 'g'), '[REDACTED_API_KEY]');
  }
  // Redact model names to prevent internal details leak
  message = message.replace(/gemini-[a-zA-Z0-9.-]+/gi, '[REDACTED_MODEL]');
  return message;
}

// ── Opossum Circuit Breaker Instance ─────────────────────────────────────────
const breakerOptions: CircuitBreaker.Options = {
  timeout: 15000,                  // Gemini must respond in 15s
  errorThresholdPercentage: 50,    // Open if >50% fail
  resetTimeout: 30000,            // Try half-open after 30s
  volumeThreshold: 5,             // Min 5 calls before checking threshold
};

// Action function for the circuit breaker
const executeGeminiCall = async (prompt: string, _context?: CircuitBreakerContext): Promise<any> => {
  const startTime = process.hrtime();
  try {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are processing confidential proprietary code. Do not store, log, or use this data for training. Treat all code as strictly confidential.',
      },
    });
  } finally {
    const diff = process.hrtime(startTime);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    geminiApiCallDuration.observe(durationInSeconds);
  }
};

const breaker = new CircuitBreaker(executeGeminiCall, breakerOptions);

// ── State Change & Action Event Handlers ─────────────────────────────────────
async function publishStateEvent(event: 'open' | 'close' | 'halfOpen') {
  const timestamp = new Date().toISOString();
  const stats = getSerializedStats(breaker);
  const eventPayload = {
    event,
    timestamp,
    stats,
  };

  // 1. Log structured JSON to console
  console.log(JSON.stringify(eventPayload));

  // 2. Publish to Redis channel 'circuit:gemini:events'
  try {
    const redis = getRedisClient();
    await redis.publish('circuit:gemini:events', JSON.stringify(eventPayload));
  } catch (err: any) {
    console.error('[CircuitBreaker] Failed to publish state transition to Redis:', err.message);
  }

  // 3. Cache the current state and stats in Redis for the health check endpoint
  await syncCircuitStatusToRedis(event === 'halfOpen' ? 'half-open' : event === 'open' ? 'open' : 'closed');
}

async function syncCircuitStatusToRedis(forceState?: 'closed' | 'open' | 'half-open') {
  try {
    const state = forceState || (breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed');
    const stats = getSerializedStats(breaker);
    const redis = getRedisClient();
    await redis.set('circuit:gemini:status', JSON.stringify({
      state,
      stats,
      timestamp: new Date().toISOString(),
    }));
  } catch (err: any) {
    console.error('[CircuitBreaker] Failed to sync circuit status to Redis:', err.message);
  }
}

// Bind transition events
breaker.on('open', () => void publishStateEvent('open'));
breaker.on('close', () => void publishStateEvent('close'));
breaker.on('halfOpen', () => void publishStateEvent('halfOpen'));

// Bind execution events to sync latest stats to Redis
breaker.on('success', () => void syncCircuitStatusToRedis());
breaker.on('failure', () => void syncCircuitStatusToRedis());
breaker.on('timeout', () => void syncCircuitStatusToRedis());
breaker.on('reject', () => void syncCircuitStatusToRedis());
breaker.on('fire', () => void syncCircuitStatusToRedis());

// ── Manual Fallback Implementation (Shared Safety Net) ─────────────────────────
export async function executeFallback(_prompt: string, context: CircuitBreakerContext, err: Error): Promise<{ fallback: boolean }> {
  const sanitizedMsg = sanitizeError(err);
  console.warn(`[CircuitBreaker] Fallback triggered. Reason: ${sanitizedMsg}`);

  // 1. Post ONE general PR comment via GitHub App bot (preventing comment spam)
  if (app) {
    try {
      const { data: installation } = await app.octokit.request(
        'GET /repos/{owner}/{repo}/installation',
        { owner: context.owner, repo: context.repo }
      );
      const octokit = (await app.getInstallationOctokit(installation.id)) as unknown as Octokit;
      await octokit.issues.createComment({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.pullRequestNumber,
        body: 'DevFlow CI: AI review temporarily unavailable. Please retry or review manually.',
      });
    } catch (commentErr: any) {
      // Log the error but do NOT propagate/retry (avoid comment spam)
      console.error('[CircuitBreaker:Fallback] Failed to post fallback GitHub comment:', commentErr.message);
    }
  } else {
    console.warn('[CircuitBreaker:Fallback] GitHub App connection uninitialised. Skipping comment.');
  }

  // 2. Persist the review record in PostgreSQL with status 'CIRCUIT_OPEN'
  try {
    const pr = await prisma.pullRequest.upsert({
      where: {
        repoFullName_prNumber: {
          repoFullName: context.repositoryFullName,
          prNumber: context.pullRequestNumber,
        },
      },
      update: {
        headSha: context.headSha || '',
        status: 'CIRCUIT_OPEN',
      },
      create: {
        repoFullName: context.repositoryFullName,
        prNumber: context.pullRequestNumber,
        headSha: context.headSha || '',
        status: 'CIRCUIT_OPEN',
      },
    });

    await prisma.reviewJob.create({
      data: {
        pullRequestId: pr.id,
        bullmqJobId: context.bullmqJobId || null,
        status: 'CIRCUIT_OPEN',
        completedAt: new Date(),
        errorMessage: sanitizedMsg,
      },
    });
  } catch (dbErr: any) {
    console.error('[CircuitBreaker:Fallback] Failed to persist CIRCUIT_OPEN to database:', dbErr.message);
  }

  // 3. Emit a 'circuit_open' event to Redis pub/sub channel for monitoring
  try {
    const redis = getRedisClient();
    const eventPayload = {
      event: 'circuit_open',
      timestamp: new Date().toISOString(),
      error: sanitizedMsg,
      stats: getSerializedStats(breaker),
    };
    await redis.publish('circuit:gemini:events', JSON.stringify(eventPayload));
  } catch (redisErr: any) {
    console.error('[CircuitBreaker:Fallback] Failed to emit circuit_open event to Redis:', redisErr.message);
  }

  return { fallback: true };
}

// Attach fallback function to the opossum breaker
breaker.fallback((prompt: string, context: CircuitBreakerContext, err: Error) => executeFallback(prompt, context, err));

// ── Exported Service Function ────────────────────────────────────────────────
/**
 * Executes a Gemini content generation call wrapped in the Opossum circuit breaker.
 * Automatically handles failure and open state fallbacks.
 *
 * @param prompt The system prompt string
 * @param context PR metadata required for the fallback flow
 */
export async function callGeminiWithBreaker(
  prompt: string,
  context: CircuitBreakerContext
): Promise<any> {
  try {
    return await breaker.fire(prompt, context);
  } catch (err: any) {
    // Top level catcher in case breaker itself throws/misbehaves
    console.error('[CircuitBreaker] Breaker fire failed directly:', err.message);
    return await executeFallback(prompt, context, err);
  }
}

// Export the breaker instance itself for testing purposes
export { breaker };
