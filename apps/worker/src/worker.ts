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
    const prompt = `You are a senior software engineer doing a thorough code review.

Analyze the following git diff and return a JSON array of review comments.

Rules:
- Only comment on real issues — bugs, security flaws, performance problems, bad practices
- Be specific and actionable
- If the code is good, return an empty array []
- Maximum 10 comments per review

Return ONLY a valid JSON array with this exact structure, no markdown, no explanation:
[
  {
    "file": "relative/path/to/file.ts",
    "line": 42,
    "severity": "critical" | "warning" | "suggestion",
    "category": "security" | "performance" | "bug" | "style" | "architecture",
    "comment": "Clear explanation of the issue and how to fix it"
  }
]

Git diff to review:
${filteredDiff}`;

    const response = await ai.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: prompt,
    });

    // Parse Gemini response as JSON
    let reviewComments: any[] = [];
    try {
      const rawText = response.text || '[]';
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      reviewComments = JSON.parse(cleaned);
      if (!Array.isArray(reviewComments)) reviewComments = [];
    } catch (e) {
      console.warn('[Worker] Failed to parse structured response, falling back to single comment');
      reviewComments = [{
        file: 'general',
        line: null,
        severity: 'suggestion',
        category: 'style',
        comment: response.text || 'Review completed'
      }];
    }

    // ── Step 3: Post the review comment back to GitHub ────────────────────
    console.log(`[Worker] Posting review to GitHub PR #${number}...`);
    try {
      // Post individual inline comments
      const inlineComments = reviewComments
        .filter(c => c.file !== 'general' && c.line)
        .map(c => ({
          path: c.file,
          line: c.line,
          body: `**[${c.severity.toUpperCase()}] ${c.category}**\n\n${c.comment}`
        }));

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
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: `**[${gc.severity.toUpperCase()}]** ${gc.comment}`
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
        filePath: c.file,
        lineNumber: c.line || null,
        commentType: c.category,
        severity: c.severity,
        commentBody: c.comment,
      }))
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
