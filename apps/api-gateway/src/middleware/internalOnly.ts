import { Request, Response, NextFunction } from 'express';

/**
 * Checks if an IP address is an internal/private address.
 * Covers loopback, RFC 1918 private IPv4 ranges, link-local, and IPv6 unique local/link-local ranges.
 */
export function isInternalIp(ip: string): boolean {
  if (!ip) return false;

  // Normalize IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1)
  let normalizedIp = ip;
  if (ip.startsWith('::ffff:')) {
    normalizedIp = ip.substring(7);
  }

  // IPv4 Loopback & Private Ranges (RFC 1918)
  if (/^(127\.0\.0\.1|localhost)$/.test(normalizedIp)) return true;
  if (/^10\./.test(normalizedIp)) return true;
  if (/^192\.168\./.test(normalizedIp)) return true;
  if (/^169\.254\./.test(normalizedIp)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalizedIp)) return true;

  // IPv6 Loopback & Local Ranges
  if (normalizedIp === '::1') return true;
  if (normalizedIp.toLowerCase().startsWith('fe80:')) return true;
  if (/^[fF][cCdD]/.test(normalizedIp)) return true; // fc00::/7

  return false;
}

/**
 * Express middleware to restrict route access to internal clients.
 * Pass if the request originates from an internal IP range OR contains
 * the INTERNAL_API_SECRET in designated headers.
 */
export function internalOnly(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || '';
  if (isInternalIp(ip)) {
    next();
    return;
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const internalSecretHeader = req.headers['x-internal-secret'];
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    const hasValidSecret =
      internalSecretHeader === secret ||
      apiKeyHeader === secret ||
      authHeader === secret ||
      (authHeader &&
        authHeader.toString().startsWith('Bearer ') &&
        authHeader.toString().substring(7) === secret);

    if (hasValidSecret) {
      next();
      return;
    }
  }

  console.warn(`[API-Gateway:InternalOnly] Forbidden access attempt from IP: ${ip}`);
  res.status(403).json({ error: 'Forbidden' });
}
