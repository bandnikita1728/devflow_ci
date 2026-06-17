import 'dotenv/config';
import { Worker } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// ── External clients ──────────────────────────────────────────────────────────
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const ai      = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

console.log('[Worker] Background processing engine active... Listening for PRs.');

// ── Job processor ─────────────────────────────────────────────────────────────
const prWorker = new Worker('pr-review-queue', async (job) => {
  const { pullRequestNumber, repositoryFullName, headSha } = job.data as any;
  const [owner, repo] = (repositoryFullName as string).split('/');
  const number = pullRequestNumber as number;

  console.log(`[Worker] Processing Job ID: ${job.id} for PR #${number}`);

  try {
    // ── Step 1: Fetch the PR Diff from GitHub ─────────────────────────────
    console.log(`[Worker] Fetching diff for ${owner}/${repo}#${number}...`);
    const { data: diff } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: number,
      mediaType: { format: 'diff' },
    });

    // ── Step 2: Analyze code with Gemini ─────────────────────────────────
    console.log(`[Worker] Analyzing code with Gemini 2.5 Flash...`);
    const prompt =
      `You are a senior backend engineer doing a code review. ` +
      `Review the following git diff. Provide concise, actionable, and professional feedback. ` +
      `Highlight bugs, security flaws, or poor practices. ` +
      `If the code looks perfect, just say 'LGTM!'\n\n${diff}`;

    const response = await ai.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: prompt,
    });
    const reviewComment = response.text ?? 'Error: Could not generate AI response.';

    // ── Step 3: Post the review comment back to GitHub ────────────────────
    console.log(`[Worker] Posting review to GitHub PR #${number}...`);
    let githubCommentId: string | null = null;
    try {
      const { data: comment } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body:         `### 🤖 Gemini Code Review\n\n${reviewComment}`,
      });
      githubCommentId = comment.id.toString();
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

    await prisma.reviewJob.create({
      data: {
        pullRequestId: pr.id,
        bullmqJobId: job.id ?? null,
        status: 'completed',
        completedAt: new Date(),
        comments: {
          create: {
            filePath: 'global',
            commentType: 'summary',
            severity: 'info',
            commentBody: reviewComment,
            githubCommentId: githubCommentId,
          }
        }
      }
    });
    console.log(`[Worker] Database save successful!`);

    console.log(`[Worker] Successfully completed review for PR #${number}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[Worker] Failed to process PR #${number}:`, errorMessage);
    throw error; // Re-throw so BullMQ marks the job as failed and retries
  }
}, { connection });

// ── Worker event listeners ────────────────────────────────────────────────────

prWorker.on('failed', (job, err) => {
  console.error(`[Worker] Critical failure on Job ${job?.id}:`, err.message);
});

prWorker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled!`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  console.info(`\n[Worker] Received ${signal} — closing gracefully...`);
  await prWorker.close();
  await prisma.$disconnect();
  console.info('[Worker] Shutdown complete.');
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));
