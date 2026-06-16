import { Worker } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { GoogleGenAI } from '@google/genai';

// Initialize external clients
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ✅ FIX 1: Pass a plain ConnectionOptions object instead of a manually instantiated IORedis client
const connection = {
  host: process.env.REDIS_QUEUE_HOST || 'localhost',
  port: Number(process.env.REDIS_QUEUE_PORT) || 6379,
  maxRetriesPerRequest: null,
};

console.log('[Worker] Background processing engine active... Listening for PRs.');

// Listen for incoming jobs on the "pr-review-queue"
const prWorker = new Worker('pr-review-queue', async (job) => {
  const { pullRequestNumber, repositoryFullName } = job.data;
  const [owner, repo] = repositoryFullName.split('/');
  const number = pullRequestNumber;
  console.log(`[Worker] Processing Job ID: ${job.id} for PR #${number}`);

  try {
    // 1. Fetch the PR Diff from GitHub
    console.log(`[Worker] Fetching diff for ${owner}/${repo}#${number}...`);
    const { data: diff } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: number,
      mediaType: { format: 'diff' }
    });

    // 2. Analyze code with Gemini
    console.log(`[Worker] Analyzing code with Gemini 2.5 Flash...`);
    const prompt = `You are a senior backend engineer doing a code review. Review the following git diff. Provide concise, actionable, and professional feedback. Highlight bugs, security flaws, or poor practices. If the code looks perfect, just say 'LGTM!'\n\n${diff}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const reviewComment = response.text || 'Error: Could not generate AI response.';

    // 3. Post the Review Comment back to GitHub
    console.log(`[Worker] Posting review to GitHub PR #${number}...`);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: `### 🤖 Gemini Code Review\n\n${reviewComment}`
    });

    console.log(`[Worker] Successfully completed review for PR #${number}`);


  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[Worker] Failed to process PR #${number}:`, errorMessage);
    throw error;
  }
}, { connection });

prWorker.on('failed', (job, err) => {
  console.error(`[Worker] Critical failure on Job ${job?.id}:`, err.message);
});

prWorker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} stalled!`);
});
