/**
 * reviewProcessor.test.ts — Unit tests for BullMQ Worker review processor
 *
 * Tests the worker's processing pipeline:
 *   - Idempotency check (skipping if PR headSha is already reviewed)
 *   - Fetching diff from GitHub
 *   - Filtering diff files (>50KB, lockfiles, etc.)
 *   - Invoking circuit breaker wrapped Gemini call
 *   - Parsing structured JSON and posting inline and general reviews
 *   - Falling back to general PR comment if JSON is malformed
 *   - Handling circuit breaker fallback and database record persistence
 *   - Propagating errors when DB save fails so BullMQ retries
 */

import { Job } from 'bullmq';

// ── Mock environment variables ──────────────────────────────────────────────────
process.env.GITHUB_APP_PRIVATE_KEY = 'mock-private-key-so-fs-read-is-skipped';
process.env.GITHUB_APP_ID = '12345';
process.env.REDIS_URL = 'redis://localhost:6379';

// ── Mock Octokit and App ────────────────────────────────────────────────────────
const mockGetPulls = jest.fn();
const mockCreateReview = jest.fn();
const mockCreateComment = jest.fn();

const mockOctokitInstance = {
  pulls: {
    get: mockGetPulls,
    createReview: mockCreateReview,
  },
  issues: {
    createComment: mockCreateComment,
  },
};

const mockRequest = jest.fn();
const mockGetInstallationOctokit = jest.fn();

jest.mock('@octokit/app', () => {
  return {
    App: jest.fn().mockImplementation(() => {
      return {
        octokit: {
          request: mockRequest,
        },
        getInstallationOctokit: mockGetInstallationOctokit,
      };
    }),
  };
});

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => mockOctokitInstance),
  };
});

// ── Mock Prisma ────────────────────────────────────────────────────────────────
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockCreate = jest.fn();
const mockCreateMany = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        pullRequest: {
          findUnique: mockFindUnique,
          upsert: mockUpsert,
        },
        reviewJob: {
          create: mockCreate,
        },
        reviewComment: {
          createMany: mockCreateMany,
        },
      };
    }),
  };
});

// ── Mock Redis ─────────────────────────────────────────────────────────────────
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    };
  });
});

// ── Mock BullMQ ────────────────────────────────────────────────────────────────
jest.mock('bullmq', () => {
  return {
    Worker: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        close: jest.fn(),
      };
    }),
    Job: jest.fn(),
  };
});

// ── Mock Circuit Breaker ───────────────────────────────────────────────────────
const mockCallGeminiWithBreaker = jest.fn();
jest.mock('../services/circuitBreaker', () => {
  return {
    callGeminiWithBreaker: mockCallGeminiWithBreaker,
  };
});

// ── Mock Metrics ───────────────────────────────────────────────────────────────
const mockInc = jest.fn();
const mockObserve = jest.fn();
jest.mock('../services/workerMetrics', () => {
  return {
    startQueueDepthPoller: jest.fn(),
    startMetricsServer: jest.fn(),
    reviewJobsProcessed: { inc: mockInc },
    reviewJobDuration: { observe: mockObserve },
  };
});

// ── Import processReviewJob AFTER mocks are registered ─────────────────────────
import { processReviewJob } from '../worker';

describe('Worker processReviewJob', () => {
  let mockJob: Job;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: 'job-123',
      data: {
        pullRequestNumber: 42,
        repositoryFullName: 'test-owner/test-repo',
        headSha: 'abc123headsha',
        title: 'Fix critical bug in auth flow',
      },
    } as unknown as Job;

    // Default mocks behavior
    mockFindUnique.mockResolvedValue(null); // Not already reviewed
    mockRequest.mockResolvedValue({ data: { id: 999 } }); // Installation ID
    mockGetInstallationOctokit.mockResolvedValue(mockOctokitInstance);
    mockGetPulls.mockResolvedValue({
      data: 'diff --git a/src/auth.ts b/src/auth.ts\n+const token = "secure";',
    });
    mockCallGeminiWithBreaker.mockResolvedValue({
      text: JSON.stringify([
        {
          file: 'src/auth.ts',
          line: 1,
          severity: 'high',
          category: 'security',
          title: 'Hardcoded credentials',
          explanation: 'Hardcoded credentials found. This is dangerous because it exposes keys in plain text.',
          owasp_ref: 'A02:2021',
          owasp_url: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
          fix_description: 'Load the token from environment variables instead.',
          fix_code: 'const token = process.env.TOKEN;',
          fix_language: 'typescript',
        },
      ]),
    });
    mockUpsert.mockResolvedValue({ id: 'pr-id-123' });
    mockCreate.mockResolvedValue({ id: 'job-record-id' });
    mockCreateMany.mockResolvedValue({ count: 1 });
  });

  // ── 1. Happy path ───────────────────────────────────────────────────────────
  it('should successfully fetch diff, call Gemini, post GitHub review, and persist to DB', async () => {
    await processReviewJob(mockJob);

    // Verify idempotency check
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        repoFullName_prNumber: {
          repoFullName: 'test-owner/test-repo',
          prNumber: 42,
        },
      },
      select: { headSha: true, status: true },
    });

    // Verify GitHub calls
    expect(mockRequest).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/installation', {
      owner: 'test-owner',
      repo: 'test-repo',
    });
    expect(mockGetInstallationOctokit).toHaveBeenCalledWith(999);
    expect(mockGetPulls).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 42,
      mediaType: { format: 'diff' },
    });

    // Verify Gemini prompt contains Diff
    expect(mockCallGeminiWithBreaker).toHaveBeenCalledWith(
      expect.stringContaining('Fix critical bug in auth flow'),
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        pullRequestNumber: 42,
        headSha: 'abc123headsha',
        repositoryFullName: 'test-owner/test-repo',
        bullmqJobId: 'job-123',
      }),
    );

    // Verify GitHub review posting
    expect(mockCreateReview).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 42,
      commit_id: 'abc123headsha',
      event: 'COMMENT',
      body: expect.stringContaining('Found 1 issue(s)'),
      comments: [
        {
          path: 'src/auth.ts',
          line: 1,
          body: expect.stringContaining('### ⚠️ DevFlow CI: Hardcoded credentials'),
        },
      ],
    });

    // Verify DB persistence
    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        repoFullName_prNumber: {
          repoFullName: 'test-owner/test-repo',
          prNumber: 42,
        },
      },
      update: {
        headSha: 'abc123headsha',
        status: 'reviewed',
      },
      create: {
        repoFullName: 'test-owner/test-repo',
        prNumber: 42,
        headSha: 'abc123headsha',
        status: 'reviewed',
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        pullRequestId: 'pr-id-123',
        bullmqJobId: 'job-123',
        status: 'completed',
        completedAt: expect.any(Date),
      },
    });

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          reviewJobId: 'job-record-id',
          filePath: 'src/auth.ts',
          lineNumber: 1,
          commentType: 'security',
          severity: 'high',
          commentBody: 'Hardcoded credentials found. This is dangerous because it exposes keys in plain text.',
          category: 'security',
          title: 'Hardcoded credentials',
          explanation: 'Hardcoded credentials found. This is dangerous because it exposes keys in plain text.',
          owaspRef: 'A02:2021',
          owaspUrl: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
          fixDescription: 'Load the token from environment variables instead.',
          fixCode: 'const token = process.env.TOKEN;',
          fixLanguage: 'typescript',
        },
      ],
    });

    // Verify metrics
    expect(mockInc).toHaveBeenCalledWith({ status: 'success' });
    expect(mockObserve).toHaveBeenCalled();
  });

  // ── 2. Idempotency Check ────────────────────────────────────────────────────
  it('should skip processing and return immediately if PR has already been reviewed with same headSha', async () => {
    mockFindUnique.mockResolvedValue({
      headSha: 'abc123headsha',
      status: 'reviewed',
    });

    await processReviewJob(mockJob);

    // Check we stopped processing
    expect(mockGetPulls).not.toHaveBeenCalled();
    expect(mockCallGeminiWithBreaker).not.toHaveBeenCalled();
    expect(mockCreateReview).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();

    expect(mockInc).toHaveBeenCalledWith({ status: 'success' });
  });

  // ── 3. Diff Filtering ───────────────────────────────────────────────────────
  it('should skip lockfiles, node_modules, minified files, and files >50KB from diff', async () => {
    const rawDiff = `
diff --git a/package-lock.json b/package-lock.json
+ "some-dep": "1.0.0"
diff --git a/src/app.ts b/src/app.ts
+ console.log("hello");
diff --git a/dist/bundle.js b/dist/bundle.js
+ eval("minify code");
diff --git a/src/large.ts b/src/large.ts
${'a'.repeat(50001)}
    `;

    mockGetPulls.mockResolvedValue({ data: rawDiff });

    await processReviewJob(mockJob);

    // Verify that the prompt only contains src/app.ts and not lockfiles or huge files
    const calledPrompt = mockCallGeminiWithBreaker.mock.calls[0][0];
    expect(calledPrompt).toContain('src/app.ts');
    expect(calledPrompt).not.toContain('package-lock.json');
    expect(calledPrompt).not.toContain('dist/bundle.js');
    expect(calledPrompt).not.toContain('src/large.ts');
  });

  // ── 4. Gemini returns malformed/unparseable JSON ────────────────────────────
  it('should fall back to general comment if Gemini returns malformed or non-JSON text', async () => {
    mockCallGeminiWithBreaker.mockResolvedValue({
      text: 'Sorry, this is just plain text explanation and not JSON.',
    });

    await processReviewJob(mockJob);

    expect(mockCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: undefined,
      }),
    );
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 42,
      body: expect.stringContaining('### ⚠️ DevFlow CI: Review Summary'),
    });

    // DB record should still be created
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          reviewJobId: 'job-record-id',
          filePath: 'general',
          lineNumber: null,
          commentType: 'style',
          severity: 'info',
          commentBody: 'DevFlow CI review completed. Gemini was unable to return structured JSON format.',
          category: 'style',
          title: 'Review Summary',
          explanation: 'DevFlow CI review completed. Gemini was unable to return structured JSON format.',
          owaspRef: null,
          owaspUrl: null,
          fixDescription: 'Please review code changes manually.',
          fixCode: null,
          fixLanguage: null,
        },
      ],
    });

    expect(mockInc).toHaveBeenCalledWith({ status: 'success' });
  });

  // ── 5. Circuit Breaker Fallback ─────────────────────────────────────────────
  it('should exit job successfully and log fallback if circuit breaker returns fallback: true', async () => {
    mockCallGeminiWithBreaker.mockResolvedValue({ fallback: true });

    await processReviewJob(mockJob);

    // If fallback is executed, worker.ts does:
    // jobStatus = 'circuit_open'; return;
    // So it should NOT post comments, NOT save to DB
    expect(mockCreateReview).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();

    // Verify metrics show circuit_open
    expect(mockInc).toHaveBeenCalledWith({ status: 'circuit_open' });
  });

  // ── 6. DB Save Fails ────────────────────────────────────────────────────────
  it('should propagate error and mark job as failed if database saving throws', async () => {
    mockUpsert.mockRejectedValue(new Error('Postgres connection lost'));

    await expect(processReviewJob(mockJob)).rejects.toThrow('Postgres connection lost');

    // Metrics should show failed
    expect(mockInc).toHaveBeenCalledWith({ status: 'failed' });
  });
});
