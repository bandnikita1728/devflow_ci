import { Router, Request, Response } from 'express';
import { verifyGitHubSignature } from '../middleware/verifyGitHubSignature';
import { getRedisClient } from '../redis';
import { getPrReviewQueue, PrReviewJobData } from '../queue';
import { webhookEventsReceived, webhookDuplicatesSkipped } from '../middleware/metrics';

const router = Router();

const WEBHOOK_LOCK_TTL_SECONDS = 300;

/**
 * POST /webhooks/github
 *
 * Security:    HMAC-SHA256 verified at stream level (no pre-parse)
 * Idempotency: Atomic SET NX in Redis keyed on X-GitHub-Delivery header
 * Latency:     Enqueue + respond in < 50 ms (no blocking work done here)
 */
router.post(
  '/github',
  verifyGitHubSignature,  // <-- raw body captured & HMAC verified BEFORE this proceeds
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    // ── 1. Extract required GitHub headers ──────────────────────────────────
    const deliveryId = req.headers['x-github-delivery'];
    const eventName  = req.headers['x-github-event'];

    if (!deliveryId || typeof deliveryId !== 'string') {
      res.status(400).json({ error: 'Missing X-GitHub-Delivery header' });
      return;
    }

    if (!eventName || typeof eventName !== 'string') {
      res.status(400).json({ error: 'Missing X-GitHub-Event header' });
      return;
    }

    // ── 2. Idempotency check — atomic SET NX (Redis "lock") ─────────────────
    //   SET webhook:lock:{deliveryId} "1" NX EX 300
    //   Returns "OK" on first-ever set, null if key already exists.
    const lockKey = `webhook:lock:${deliveryId}`;
    const redis   = getRedisClient();

    const lockAcquired = await redis.set(
      lockKey,
      '1',
      'EX',
      WEBHOOK_LOCK_TTL_SECONDS,
      'NX',
    );

    if (lockAcquired === null) {
      // Duplicate delivery — already processed or currently in-flight
      console.info(
        `[Webhook] Duplicate delivery detected, skipping. id=${deliveryId}`,
      );
      webhookDuplicatesSkipped.inc();
      res.status(202).json({ status: 'accepted', note: 'duplicate_skipped' });
      return;
    }

    // ── 3. Validate this is a pull_request event we care about ───────────────
    const payload = req.body as Record<string, unknown>;

    if (eventName !== 'pull_request') {
      console.info(`[Webhook] Ignoring non-PR event: ${eventName}`);
      webhookEventsReceived.inc({ event_type: eventName, validation_status: 'ignored' });
      res.status(202).json({ status: 'accepted', note: 'event_ignored' });
      return;
    }

    const action = (payload['action'] as string) ?? 'unknown';
    const pr     = payload['pull_request'] as Record<string, unknown> | undefined;
    const repo   = payload['repository']   as Record<string, unknown> | undefined;

    if (!pr || !repo) {
      console.warn('[Webhook] Malformed pull_request payload — missing pr or repo object');
      res.status(422).json({ error: 'Malformed payload' });
      return;
    }

    // ── 4. Enqueue into BullMQ pr-review-queue ───────────────────────────────
    const jobData: PrReviewJobData = {
      deliveryId,
      event:               eventName,
      action,
      repositoryFullName:  (repo['full_name'] as string) ?? '',
      pullRequestNumber:   (pr['number'] as number) ?? 0,
      pullRequestUrl:      (pr['html_url'] as string) ?? '',
      headSha:             ((pr['head'] as Record<string, unknown>)?.['sha'] as string) ?? '',
      enqueuedAt:          new Date().toISOString(),
      rawPayload:          payload,
    };

    const queue = getPrReviewQueue();

    const job = await queue.add(
      `pr-review:${deliveryId}`,
      jobData,
      {
        jobId: deliveryId, // Deduplicate at BullMQ layer too
      },
    );

    webhookEventsReceived.inc({ event_type: eventName, validation_status: 'success' });

    const elapsed = Date.now() - startTime;
    console.info(
      `[Webhook] Enqueued job id=${job.id} for PR #${jobData.pullRequestNumber} ` +
      `in repo "${jobData.repositoryFullName}" — elapsed ${elapsed}ms`,
    );

    // ── 5. Return 202 Accepted immediately ───────────────────────────────────
    res.status(202).json({
      status:  'accepted',
      jobId:   job.id,
      elapsed: `${elapsed}ms`,
    });
  },
);

export default router;
