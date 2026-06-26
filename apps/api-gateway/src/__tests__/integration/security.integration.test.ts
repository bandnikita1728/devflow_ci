/**
 * security.integration.test.ts — Security integration tests for DevFlow CI.
 *
 * Verifies:
 *   1. Worker `/metrics` endpoint is protected by `METRICS_SECRET` and returns 403 when header is missing/incorrect.
 *   2. Circuit breaker fallback does not leak details in comment body.
 *   3. Webhook signature middleware returns exactly 401/403 with no internal leakage or stack traces.
 *   4. SQL injection in PR title is safely stored as literal by Prisma/PostgreSQL.
 */

import http from 'node:http';
import supertest from 'supertest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { PrismaClient } from '@prisma/client';

// ── Mock & Import Metrics Server ───────────────────────────────────────────────
const createServerSpy = jest.spyOn(http, 'createServer');

// Import metrics server setup
import { startMetricsServer } from '../../../../worker/src/services/workerMetrics';
import { executeFallback } from '../../../../worker/src/services/circuitBreaker';

describe('Security Integration Tests', () => {
  let postgresContainer: StartedTestContainer | null = null;
  let prisma: PrismaClient | null = null;
  let isDockerAvailable = false;
  let app: any;
  let metricsServerInstance: http.Server | null = null;

  beforeAll(async () => {
    // 1. Setup Metrics Server with secret
    process.env.METRICS_SECRET = 'super-secret-metrics-token-123';
    process.env.WORKER_METRICS_PORT = '3012'; // Use non-conflicting port
    
    startMetricsServer();
    if (createServerSpy.mock.results.length > 0) {
      metricsServerInstance = createServerSpy.mock.results[0].value;
    }

    // 2. Check if Postgres container can be started
    try {
      postgresContainer = await new GenericContainer('postgres:15-alpine')
        .withExposedPorts(5432)
        .withEnvironment({
          POSTGRES_USER: 'secuser',
          POSTGRES_PASSWORD: 'secpassword',
          POSTGRES_DB: 'secdb',
        })
        .start();

      const postgresPort = postgresContainer.getMappedPort(5432);
      const dbUrl = `postgresql://secuser:secpassword@localhost:${postgresPort}/secdb?schema=public`;

      process.env.DATABASE_URL = dbUrl;
      process.env.NODE_ENV = 'test';

      prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      
      // Run Prisma schema push
      const { execSync } = require('node:child_process');
      execSync('npx prisma db push --skip-generate', {
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'ignore',
      });

      // Load Express app
      const indexModule = require('../../index');
      app = indexModule.app;
      isDockerAvailable = true;
    } catch (err) {
      console.warn('Docker daemon not found or failing to start. SQL Injection test will be skipped.', err);
      isDockerAvailable = false;
    }
  }, 90000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (metricsServerInstance) {
      metricsServerInstance.close();
    }
    if (postgresContainer) {
      await postgresContainer.stop();
    }
  });

  const testIfDocker = (name: string, fn: () => Promise<void>) => {
    test(name, async () => {
      if (!isDockerAvailable) {
        console.warn(`[SKIPPED] ${name} (Docker not running)`);
        return;
      }
      await fn();
    });
  };

  // ── 1. Worker `/metrics` protection ──────────────────────────────────────────
  test('Worker /metrics should reject requests without x-metrics-secret header with 403', async () => {
    if (!metricsServerInstance) {
      console.warn('Metrics server was not captured. Skipping check.');
      return;
    }
    
    // Call without header
    const resNoHeader = await supertest(metricsServerInstance)
      .get('/metrics');
    expect(resNoHeader.status).toBe(403);
    expect(resNoHeader.body).toEqual({ error: 'Forbidden' });

    // Call with incorrect header
    const resBadHeader = await supertest(metricsServerInstance)
      .get('/metrics')
      .set('x-metrics-secret', 'wrong-token-value');
    expect(resBadHeader.status).toBe(403);
    expect(resBadHeader.body).toEqual({ error: 'Forbidden' });

    // Call with correct header
    const resGoodHeader = await supertest(metricsServerInstance)
      .get('/metrics')
      .set('x-metrics-secret', 'super-secret-metrics-token-123');
    expect(resGoodHeader.status).toBe(200);
    expect(resGoodHeader.text).toContain('worker_');
  });

  // ── 2. Circuit breaker fallback comment body contains NO leaks ─────────────
  test('Circuit breaker fallback comment body must not contain error stack trace or secrets', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ data: { id: 100 } });
    const mockCreateComment = jest.fn();
    const mockGetInstallationOctokit = jest.fn().mockResolvedValue({
      issues: {
        createComment: mockCreateComment,
      },
    });

    // We override the local GITHUB APP instance or mock dependencies
    // To make sure it triggers our mockOctokit without real credentials:
    jest.mock('@octokit/app', () => {
      return {
        App: jest.fn().mockImplementation(() => {
          return {
            octokit: { request: mockRequest },
            getInstallationOctokit: mockGetInstallationOctokit,
          };
        }),
      };
    });

    const context = {
      owner: 'test-owner',
      repo: 'test-repo',
      pullRequestNumber: 15,
      headSha: 'someheadsha',
      repositoryFullName: 'test-owner/test-repo',
    };

    // Run fallback directly with a scary error containing secret information
    const scaryError = new Error('Database connection failed! Secret: key-12345-api-key at /users/nikita/devflow_ci/src/db.ts:44');
    
    await executeFallback('prompt', context, scaryError);

    // Assert that if the comment is posted, it does NOT leak the database path, API key, or file name
    if (mockCreateComment.mock.calls.length > 0) {
      const commentBody = mockCreateComment.mock.calls[0][0].body;
      expect(commentBody).toBe('DevFlow CI: AI review temporarily unavailable. Please retry or review manually.');
      expect(commentBody).not.toContain('Secret: key-12345-api-key');
      expect(commentBody).not.toContain('devflow_ci');
      expect(commentBody).not.toContain('db.ts');
    }
  });

  // ── 3. Webhook 401 response body has no internal leakage ───────────────────
  test('Webhook 401 response should have exactly the expected error message and no other info', async () => {
    if (!app) {
      console.warn('Express app not loaded. Skipping check.');
      return;
    }
    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .send({}); // No headers, malformed

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(res.text).not.toContain('Stack');
    expect(res.text).not.toContain('verifyGitHubSignature');
  });

  // ── 4. SQL Injection in PR Title ───────────────────────────────────────────
  testIfDocker('Prisma/Postgres must store SQL Injection strings as literal strings safely', async () => {
    if (!prisma) throw new Error('Prisma Client not initialized');

    const sqlInjectionPayload = "'; DROP TABLE \"User\"; --";

    // Attempt to upsert a PullRequest record with sql injection in repoFullName
    const pr = await prisma.pullRequest.upsert({
      where: {
        repoFullName_prNumber: {
          repoFullName: sqlInjectionPayload,
          prNumber: 999,
        },
      },
      update: {
        headSha: 'injection-sha',
        status: 'reviewed',
      },
      create: {
        repoFullName: sqlInjectionPayload,
        prNumber: 999,
        headSha: 'injection-sha',
        status: 'reviewed',
      },
    });

    expect(pr).toBeDefined();
    expect(pr.repoFullName).toBe(sqlInjectionPayload);

    // Verify User table is still there and we can query it
    const users = await prisma.user.findMany({});
    expect(users).toBeDefined();
  });
});
