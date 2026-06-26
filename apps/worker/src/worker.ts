import 'dotenv/config';
import http from 'http';
import { readFileSync } from 'fs';
import { Worker, Job } from 'bullmq';
import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { generateCodeReview } from './services/geminiService';
import { formatComment, limitCommentLength } from './services/commentFormatter';
import {
  startQueueDepthPoller,
  startMetricsServer,
  reviewJobsProcessed,
  reviewJobDuration
} from './services/workerMetrics';

// ── External clients ──────────────────────────────────────────────────────────
console.log('[Worker] GITHUB_APP_PRIVATE_KEY set:', !!process.env.GITHUB_APP_PRIVATE_KEY);
console.log('[Worker] Key length:', process.env.GITHUB_APP_PRIVATE_KEY?.length || 0);

// Read private key from env var (Render) or file (local)
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY ||
  readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH || './devflow-ci.2026-06-17.private-key.pem', 'utf8');

const app = new App({
  appId: process.env.GITHUB_APP_ID || '',
  privateKey,
  Octokit: Octokit as any,
});
const prisma  = new PrismaClient();

// ── BullMQ Redis connection ───────────────────────────────────────────────────
// Passing a plain object — BullMQ v5 manages its own IORedis instance internally.
const connection: any = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : {
      host:                 process.env.REDIS_QUEUE_HOST || 'localhost',
      port:                 Number(process.env.REDIS_QUEUE_PORT) || 6379,
      maxRetriesPerRequest: null,
    };

if (process.env.NODE_ENV !== 'test') {
  startQueueDepthPoller();
  startMetricsServer();
}

// ── Horizontal scaling: concurrency config ────────────────────────────────────
// WORKER_CONCURRENCY controls how many jobs this instance processes in parallel.
// Default 5 — tune based on memory/CPU budget per instance.
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 5;
console.log(`[Worker] Background processing engine active (concurrency=${CONCURRENCY}). Listening for PRs.`);

// ── Idempotency guard ─────────────────────────────────────────────────────────
/**
 * Returns true if this exact (repo, prNumber, headSha) has already been
 * successfully reviewed. Used by all worker instances to avoid duplicate work
 * when the same webhook fires multiple times or when a job is retried after
 * another instance already completed it.
 */
async function isAlreadyReviewed(
  repoFullName: string,
  prNumber: number,
  headSha: string,
): Promise<boolean> {
  const existing = await prisma.pullRequest.findUnique({
    where: {
      repoFullName_prNumber: { repoFullName, prNumber },
    },
    select: { headSha: true, status: true },
  });
  return existing?.headSha === headSha && existing?.status === 'reviewed';
}

// ── Job processor ─────────────────────────────────────────────────────────────
/**
 * BullMQ guarantees atomic job claiming via Redis BRPOPLPUSH — when multiple
 * worker instances are running in parallel, each job is delivered to exactly ONE
 * worker. This is the foundational guarantee that makes horizontal scaling safe.
 *
 * Additional safety layers:
 *   1. Idempotency check (Postgres) — prevents duplicate reviews if the same
 *      webhook event is enqueued more than once.
 *   2. lockDuration (60s) — if a worker crashes mid-job, the lock expires and
 *      BullMQ reassigns the job to another healthy worker.
 *   3. stalledInterval (30s) — BullMQ actively checks for stalled jobs (ones
 *      whose workers stopped sending heartbeats) and moves them back to waiting.
 */
export async function processReviewJob(job: Job): Promise<void> {
  const { pullRequestNumber, repositoryFullName, headSha, title: prTitle, installationId } = job.data as any;
  const [owner, repo] = (repositoryFullName as string).split('/');
  const number = pullRequestNumber as number;

  console.log(`[Worker] Processing Job ID: ${job.id} for PR #${number}`);
  const startTime = process.hrtime();
  let jobStatus: 'success' | 'failed' | 'circuit_open' = 'success';

  try {
    if (installationId === undefined || installationId === null) {
      throw new Error('Missing installationId');
    }
    const parsedInstallationId = parseInt(installationId as any, 10);
    if (isNaN(parsedInstallationId)) {
      throw new Error('Invalid installationId: NaN');
    }

    // ── Idempotency gate: skip if this headSha is already reviewed ────────
    if (await isAlreadyReviewed(repositoryFullName, number, headSha)) {
      console.info(
        `[Worker] Idempotent skip: PR #${number} @ ${headSha} already reviewed. Job ${job.id} marked complete.`,
      );
      return; // BullMQ marks completed; no duplicate GitHub comments
    }

    // ── Step 1: Fetch the PR Diff from GitHub ─────────────────────────────
    console.log(`[Worker] Fetching diff for ${owner}/${repo}#${number}...`);
    
    // Get authenticated Octokit for this installation dynamically
    let octokit: Octokit;
    try {
      octokit = (await app.getInstallationOctokit(parsedInstallationId)) as unknown as Octokit;
    } catch (err: any) {
      const isRevoked = err.message && (
        err.message.includes('not found') || 
        err.message.includes('revoked') || 
        err.message.includes('installation') ||
        err.status === 404
      );
      if (isRevoked) {
        console.warn(`[Worker] GitHub App installation revoked or not found: ${err.message}`);
        
        const pr = await prisma.pullRequest.upsert({
          where: {
            repoFullName_prNumber: {
              repoFullName: repositoryFullName as string,
              prNumber: number,
            },
          },
          update: {
            headSha: (headSha as string) || '',
            status: 'failed',
          },
          create: {
            repoFullName: repositoryFullName as string,
            prNumber: number,
            headSha: (headSha as string) || '',
            status: 'failed',
          },
        });

        await prisma.reviewJob.create({
          data: {
            pullRequestId: pr.id,
            bullmqJobId: job.id ?? null,
            status: 'INSTALLATION_REVOKED',
            errorMessage: err.message,
            completedAt: new Date(),
          }
        });
        return; // Resolve successfully so BullMQ doesn't retry
      }
      throw err;
    }

    const { data: diff } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: number,
      mediaType: { format: 'diff' },
    });

    // Split diff by file, skip files > 50KB or binary/generated files
    const skipPatterns = [
      'package-lock.json', 'yarn.lock', 'node_modules',
      '.min.js', '.min.css', 'dist/', 'build/'
    ];
    const filteredDiff = (diff as any)
      .split('diff --git')
      .filter((chunk: string) => {
        if (!chunk.trim()) return false;
        if (skipPatterns.some(p => chunk.includes(p))) return false;
        if (chunk.length > 50000) return false; // 50KB per file
        return true;
      })
      .join('diff --git');

    // ── Step 2: Analyze code with Gemini ─────────────────────────────────
    console.log(`[Worker] Analyzing code with Gemini 2.5 Flash...`);
    const { comments: reviewComments, fallback } = await generateCodeReview(
      filteredDiff,
      prTitle || '',
      {
        owner,
        repo,
        pullRequestNumber: number,
        headSha,
        repositoryFullName,
        bullmqJobId: job.id,
      }
    );

    if (fallback) {
      console.info(`[Worker] Fallback executed for PR #${number}. Circuit breaker handled the failure. Exiting job.`);
      jobStatus = 'circuit_open';
      return;
    }

    // ── Step 3: Post the review comment back to GitHub ────────────────────
    console.log(`[Worker] Posting review to GitHub PR #${number}...`);
    try {
      // Post individual inline comments
      const inlineComments = reviewComments
        .filter(c => c.file !== 'general' && c.line)
        .map(c => {
          const body = formatComment(c);
          return {
            path: c.file.replace(/^[ab]\//, ''),
            line: c.line as number,
            body: limitCommentLength(body),
          };
        });

      // Submit as a proper GitHub PR review
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: number,
        commit_id: headSha,
        event: 'COMMENT',
        body: `### 🤖 DevFlow CI Review\n\nFound ${reviewComments.length} issue(s). See inline comments below.`,
        comments: inlineComments.length > 0 ? inlineComments : undefined
      });

      // If any general comments, post them separately
      const generalComments = reviewComments.filter(c => c.file === 'general' || !c.line);
      for (const gc of generalComments) {
        const body = formatComment(gc);
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: limitCommentLength(body),
        });
      }
    } catch (e) {
      console.warn(`[Worker] Could not post to GitHub (maybe invalid credentials):`, e);
    }

    // ── Step 4: Save the review to PostgreSQL via Prisma ─────────────────
    console.log(`[Worker] Saving review to database...`);
    const pr = await prisma.pullRequest.upsert({
      where: {
        repoFullName_prNumber: {
          repoFullName: repositoryFullName as string,
          prNumber: number,
        },
      },
      update: {
        headSha: (headSha as string) || '',
        status: 'reviewed',
      },
      create: {
        repoFullName: repositoryFullName as string,
        prNumber: number,
        headSha: (headSha as string) || '',
        status: 'reviewed',
      },
    });

    const reviewJob = await prisma.reviewJob.create({
      data: {
        pullRequestId: pr.id,
        bullmqJobId: job.id ?? null,
        status: 'completed',
        completedAt: new Date(),
      }
    });

    await prisma.reviewComment.createMany({
      data: reviewComments.map(c => ({
        reviewJobId: reviewJob.id,
        filePath: c.file.replace(/^[ab]\//, ''),
        lineNumber: c.line || null,
        commentType: c.category,
        severity: c.severity,
        commentBody: c.explanation, // for backward compatibility
        category: c.category,
        title: c.title,
        explanation: c.explanation,
        owaspRef: c.owasp_ref,
        owaspUrl: c.owasp_url,
        fixDescription: c.fix_description,
        fixCode: c.fix_code,
        fixLanguage: c.fix_language,
      }))
    });
    console.log(`[Worker] Database save successful!`);

    console.log(`[Worker] Successfully completed review for PR #${number}`);

  } catch (error: unknown) {
    jobStatus = 'failed';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[Worker] Failed to process PR #${number}:`, errorMessage);
    throw error; // Re-throw so BullMQ marks the job as failed and retries
  } finally {
    const diff = process.hrtime(startTime);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    reviewJobDuration.observe(durationInSeconds);
    reviewJobsProcessed.inc({ status: jobStatus });
  }
}

const prWorker = new Worker('pr-review-queue', processReviewJob, {
  connection,
  // ── Horizontal scaling: BullMQ tuning ─────────────────────────────────────
  // concurrency: number of parallel jobs this single worker instance will pick
  // up. Each instance runs CONCURRENCY jobs simultaneously. Scaling out is done
  // by running N instances × CONCURRENCY = total parallel capacity.
  concurrency: CONCURRENCY,

  // lockDuration: how long (ms) a job is locked to this worker. If the worker
  // crashes or freezes, the lock expires and BullMQ moves the job back to
  // "waiting" so another instance picks it up. Set to 60s because Gemini API
  // calls can take 15s + GitHub API calls + Prisma writes.
  lockDuration: 60_000,

  // stalledInterval: how often (ms) this worker checks for stalled jobs — jobs
  // whose owning worker stopped sending lock-renewal heartbeats. 30s provides
  // a good balance between detection speed and Redis load.
  stalledInterval: 30_000,
});

// ── Worker event listeners ────────────────────────────────────────────────────

prWorker.on('failed', (job, err) => {
  console.error(`[Worker] Critical failure on Job ${job?.id}:`, err.message);
});

prWorker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled — will be retried by this or another worker instance.`);
});

// ── Graceful shutdown with drain ──────────────────────────────────────────────
// On SIGTERM (Render/k8s sends this before killing the process):
// 1. Stop accepting new jobs immediately.
// 2. Wait up to 30s for in-flight jobs to finish.
// 3. If jobs are still running after 30s, force-exit so the container isn't
//    killed by SIGKILL (which would leave jobs in a stalled state).

const DRAIN_TIMEOUT_MS = 30_000;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return; // Prevent double-shutdown from SIGTERM + SIGINT
  isShuttingDown = true;

  console.info(`\n[Worker] Received ${signal} — draining in-flight jobs (${DRAIN_TIMEOUT_MS / 1000}s timeout)...`);

  // Force-exit timer — safety net if Worker.close() hangs
  const forceExitTimer = setTimeout(() => {
    console.error('[Worker] Drain timeout exceeded — forcing exit.');
    process.exit(1);
  }, DRAIN_TIMEOUT_MS);
  // Don't let this timer keep the process alive if everything else finishes
  forceExitTimer.unref();

  try {
    // Worker.close() stops picking new jobs and waits for running jobs to finish
    await prWorker.close();
    console.info('[Worker] All in-flight jobs drained.');
  } catch (err) {
    console.error('[Worker] Error during worker drain:', err);
  }

  try {
    await prisma.$disconnect();
  } catch (_) { /* best-effort */ }

  clearTimeout(forceExitTimer);
  console.info('[Worker] Shutdown complete.');
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  // ── Render Free Tier Health Check ─────────────────────────────────────────────
  // Dummy HTTP server to satisfy Render's Web Service port binding requirement
  // Render requires you to listen on '0.0.0.0' (all network interfaces), not just localhost.
  // It also injects a specific PORT variable that you MUST use.
  const port = process.env.PORT ? Number(process.env.PORT) : 10000; 

  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      concurrency: CONCURRENCY,
      shuttingDown: isShuttingDown,
    }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Worker] Health-check server listening on port ${port}`);
  });
}
