/**
 * webhookHandler.test.ts — Unit tests for POST /webhooks/github
 *
 * Tests the webhook route + HMAC-SHA256 verification middleware end-to-end
 * using supertest against a minimal Express app. All external I/O (Redis,
 * BullMQ Queue) is mocked.
 */

import crypto from 'node:crypto';
import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';

// ── Test constants ─────────────────────────────────────────────────────────────
const WEBHOOK_SECRET = 'test-webhook-secret-32chars!!';
const TEST_DELIVERY_ID = 'abc123-delivery-uuid';

// ── Mock: prom-client metrics ──────────────────────────────────────────────────
// Must be defined before importing anything that imports metrics.ts
const noopCounter = { inc: jest.fn() };
jest.mock('../middleware/metrics', () => ({
  webhookEventsReceived: noopCounter,
  webhookDuplicatesSkipped: { inc: jest.fn() },
  httpRequestDuration: { observe: jest.fn() },
  activeConnections: { inc: jest.fn(), dec: jest.fn() },
  metricsMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// ── Mock: config ───────────────────────────────────────────────────────────────
jest.mock('../config', () => ({
  config: {
    github: { webhookSecret: WEBHOOK_SECRET },
    redisQueue: { host: 'localhost', port: 6379 },
    redisCache: { host: 'localhost', port: 6379 },
    queues: { prReview: 'pr-review-queue' },
    port: 3000,
    nodeEnv: 'test',
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
  },
}));

// ── Mock: Redis ────────────────────────────────────────────────────────────────
const mockRedisSet = jest.fn();
const mockRedisInstance = {
  set: mockRedisSet,
  on: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('../redis', () => ({
  getRedisClient: () => mockRedisInstance,
}));

// ── Mock: BullMQ Queue ─────────────────────────────────────────────────────────
const mockQueueAdd = jest.fn();
jest.mock('../queue', () => ({
  getPrReviewQueue: () => ({
    add: mockQueueAdd,
    on: jest.fn(),
    close: jest.fn(),
  }),
  PrReviewJobData: {},
}));

// ── Imports (AFTER mocks) ──────────────────────────────────────────────────────
import webhookRoutes from '../routes/webhooks';

// ── Test app builder ───────────────────────────────────────────────────────────
function buildTestApp(): express.Application {
  const app = express();
  // Do NOT apply express.json() globally — the webhook middleware reads raw body
  app.use('/webhooks', webhookRoutes);
  return app;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function signPayload(body: string, secret: string = WEBHOOK_SECRET): string {
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(body, 'utf8'))
    .digest('hex')}`;
}

function buildPrPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'opened',
    pull_request: {
      number: 42,
      html_url: 'https://github.com/test/repo/pull/42',
      head: { sha: 'abc123deadbeef' },
      ...((overrides['pull_request'] as Record<string, unknown>) || {}),
    },
    repository: {
      full_name: 'test-owner/test-repo',
      owner: { login: 'test-owner' },
      name: 'test-repo',
      ...((overrides['repository'] as Record<string, unknown>) || {}),
    },
    installation: {
      id: 999,
    },
    ...overrides,
  };
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('POST /webhooks/github', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildTestApp();

    // Default: Redis SET NX succeeds (first-ever delivery)
    mockRedisSet.mockResolvedValue('OK');

    // Default: Queue add succeeds
    mockQueueAdd.mockResolvedValue({ id: TEST_DELIVERY_ID });
  });

  // ── 1. Valid HMAC signature → 202, job enqueued ──────────────────────────

  it('should return 202 and enqueue job when HMAC is valid', async () => {
    const payload = buildPrPayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('accepted');
    expect(res.body.jobId).toBe(TEST_DELIVERY_ID);
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'review',
      expect.objectContaining({
        deliveryId: TEST_DELIVERY_ID,
        pullRequestNumber: 42,
        repositoryFullName: 'test-owner/test-repo',
        installationId: 999,
        repoOwner: 'test-owner',
        repoName: 'test-repo',
        prNumber: 42,
      }),
      expect.objectContaining({ jobId: TEST_DELIVERY_ID }),
    );
  });

  // ── 2. Invalid HMAC signature → 401, no job, no leak ────────────────────

  it('should return 401 and NOT enqueue job when HMAC is invalid', async () => {
    const payload = buildPrPayload();
    const body = JSON.stringify(payload);
    const badSignature = signPayload(body, 'wrong-secret-that-does-not-match');

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', badSignature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    // Security: no stack traces, no internal details
    expect(JSON.stringify(res.body)).not.toContain('stack');
    expect(JSON.stringify(res.body)).not.toContain('Error');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 3. Missing signature header → 401 ───────────────────────────────────

  it('should return 401 when X-Hub-Signature-256 header is missing', async () => {
    const payload = buildPrPayload();
    const body = JSON.stringify(payload);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      // Deliberately omit X-Hub-Signature-256
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    // Security: response body has NO extra fields
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 4. Duplicate webhook (Redis NX returns null) → 202, no enqueue ──────

  it('should return 202 with duplicate_skipped when delivery ID already processed', async () => {
    // Simulate Redis NX returning null (key already exists)
    mockRedisSet.mockResolvedValue(null);

    const payload = buildPrPayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body.note).toBe('duplicate_skipped');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 5. Unsupported event type → 202, event_ignored ──────────────────────

  it('should return 202 and ignore non-pull_request events', async () => {
    const payload = { action: 'completed', check_suite: {} };
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'check_suite')
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body.note).toBe('event_ignored');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 6. Malformed JSON body → 400 ────────────────────────────────────────

  it('should return 400 when body is valid HMAC but not valid JSON', async () => {
    const body = 'this is not json {{{';
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON payload' });
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 7. Missing X-GitHub-Delivery header → 400 ──────────────────────────

  it('should return 400 when X-GitHub-Delivery header is missing', async () => {
    const payload = buildPrPayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      // Deliberately omit X-GitHub-Delivery
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 8. Missing X-GitHub-Event header → 400 ─────────────────────────────

  it('should return 400 when X-GitHub-Event header is missing', async () => {
    const payload = buildPrPayload();
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      // Deliberately omit X-GitHub-Event
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // ── 9. Malformed pull_request payload → 422 ────────────────────────────

  it('should return 422 when pull_request event has no PR object', async () => {
    const payload = { action: 'opened', repository: { full_name: 'a/b' } };
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const res = await supertest(app)
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', TEST_DELIVERY_ID)
      .set('X-GitHub-Event', 'pull_request')
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Malformed payload');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
