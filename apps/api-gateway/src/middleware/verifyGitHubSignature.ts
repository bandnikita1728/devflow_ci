/**
 * apps/api-gateway/src/middleware/verifyGitHubSignature.ts
 *
 * Stream-level HMAC-SHA256 webhook signature verification middleware.
 *
 * ── Security Design ──────────────────────────────────────────────────────────
 *
 * 1. RAW BODY CAPTURE:
 *    Raw bytes are read directly from the request stream BEFORE any body
 *    parser runs. This prevents payload-smuggling attacks where a malicious
 *    actor crafts a body that parses differently than it was hashed.
 *
 * 2. TIMING-SAFE COMPARISON:
 *    crypto.timingSafeEqual() compares signatures in constant time, preventing
 *    timing oracle attacks that allow byte-by-byte secret recovery.
 *
 *    NOTE: timingSafeEqual() requires both Buffers to be the same length.
 *    We achieve this by comparing the hex digests of BOTH signatures,
 *    ensuring the comparison is always over a fixed-length 71-byte string
 *    ("sha256=" + 64 hex chars). We do NOT exit early on length mismatch
 *    to avoid leaking which length is correct.
 *
 * 3. MANDATORY HEADER:
 *    Absence of X-Hub-Signature-256 results in a 401 — the request is
 *    treated as unauthenticated, not as a bad signature.
 *
 * ── Express Integration ───────────────────────────────────────────────────────
 *
 * This middleware MUST be mounted BEFORE any body-parsing middleware on the
 * /webhooks route. express.json() must NOT run on the raw webhook stream.
 * After successful verification, req.body is populated by this middleware.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from '../config';
import { webhookEventsReceived } from './metrics';

// ── Module-level type augmentation ───────────────────────────────────────────

/**
 * Extends Express's Request type to include the verified raw body buffer.
 * Downstream handlers can read req.rawBody for logging or re-hashing.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function verifyGitHubSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const signatureHeader = req.headers['x-hub-signature-256'];

  // ── Step 1: Require the signature header ─────────────────────────────────
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    console.warn('[Webhook] Rejected: missing X-Hub-Signature-256 header');
    webhookEventsReceived.inc({
      event_type: (req.headers['x-github-event'] as string) || 'unknown',
      validation_status: 'missing_signature'
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // ── Step 2: Accumulate raw body bytes from stream ────────────────────────
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('error', (err: Error) => {
    console.error('[Webhook] Request stream error:', err.message);
    res.status(500).json({ error: 'Failed to read request body' });
  });

  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);

    // Attach verified raw bytes for downstream access (logging, auditing).
    req.rawBody = rawBody;

    // ── Step 3: Compute expected HMAC-SHA256 signature ─────────────────────
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', config.github.webhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    // ── Step 4: Timing-safe comparison ─────────────────────────────────────
    // Both strings are hex-encoded and thus always 71 bytes ("sha256=" + 64).
    // If the incoming signature is a different length (malformed), we pad
    // it to prevent an early exit that could leak length information.
    // We still reject below — the rejection is just done in constant time.
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    let incomingBuf: Buffer;

    if (signatureHeader.length !== expectedSignature.length) {
      // Pad/truncate to the same length for constant-time comparison.
      // The result will never match — this path always leads to rejection.
      incomingBuf = Buffer.alloc(expectedBuf.length, 0);
    } else {
      incomingBuf = Buffer.from(signatureHeader, 'utf8');
    }

    const isValid = crypto.timingSafeEqual(expectedBuf, incomingBuf);

    if (!isValid) {
      console.warn(
        `[Webhook] Rejected: HMAC-SHA256 signature mismatch ` +
        `(delivery=${req.headers['x-github-delivery'] ?? 'unknown'})`,
      );
      webhookEventsReceived.inc({
        event_type: (req.headers['x-github-event'] as string) || 'unknown',
        validation_status: 'invalid_signature'
      });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // ── Step 5: Parse verified body as JSON and attach to req.body ─────────
    try {
      req.body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      console.error(
        '[Webhook] Rejected: JSON parse failure after successful signature verification. ' +
        'Payload may be non-JSON or malformed.',
      );
      webhookEventsReceived.inc({
        event_type: (req.headers['x-github-event'] as string) || 'unknown',
        validation_status: 'malformed_json'
      });
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }

    // ── Step 6: All checks passed — hand off to the route handler ──────────
    next();
  });
}
