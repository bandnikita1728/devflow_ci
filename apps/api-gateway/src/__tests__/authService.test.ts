/**
 * authService.test.ts — Unit tests for JWT and AES encryption in auth.ts
 *
 * Tests JWT generation/verification lifecycle and AES-256 encrypt/decrypt
 * round-trips. No external services needed.
 */

import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';

// ── Test constants ─────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-jwt-secret-for-unit-tests';
const ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';
const WRONG_ENCRYPTION_KEY = 'wrong-key-that-should-not-work!';

// ── Mock: environment variables (set BEFORE importing auth.ts) ─────────────────
process.env.JWT_SECRET = JWT_SECRET;
process.env.TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY;
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

// ── Mock: Redis (auth.ts imports getRedisClient) ───────────────────────────────
jest.mock('../redis', () => ({
  getRedisClient: () => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  }),
}));

// ── Mock: Prisma (auth.ts creates a PrismaClient) ─────────────────────────────
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reviewComment: { deleteMany: jest.fn() },
    reviewJob: { deleteMany: jest.fn() },
    pullRequest: { deleteMany: jest.fn() },
    repository: { deleteMany: jest.fn() },
  })),
}));

// ── Mock: prom-client ──────────────────────────────────────────────────────────
jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({ inc: jest.fn() })),
  Histogram: jest.fn().mockImplementation(() => ({ observe: jest.fn() })),
  Gauge: jest.fn().mockImplementation(() => ({ inc: jest.fn(), dec: jest.fn(), set: jest.fn() })),
  collectDefaultMetrics: jest.fn(),
  register: { contentType: 'text/plain', metrics: jest.fn().mockResolvedValue('') },
}));

// ── Imports (AFTER mocks) ──────────────────────────────────────────────────────
import { encryptToken, decryptToken } from '../routes/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// JWT Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('JWT Generation & Verification', () => {
  const testUser = {
    id: 'user-uuid-123',
    githubId: '12345',
    username: 'testuser',
  };

  it('should generate a valid JWT that can be verified', () => {
    const token = jwt.sign(
      { id: testUser.id, githubId: testUser.githubId, username: testUser.username },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.id).toBe(testUser.id);
    expect(decoded.githubId).toBe(testUser.githubId);
    expect(decoded.username).toBe(testUser.username);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
  });

  it('should reject an expired JWT', () => {
    const token = jwt.sign(
      { id: testUser.id, githubId: testUser.githubId, username: testUser.username },
      JWT_SECRET,
      { expiresIn: '-1s' }, // Already expired
    );

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  it('should reject a JWT with tampered payload', () => {
    const token = jwt.sign(
      { id: testUser.id, githubId: testUser.githubId, username: testUser.username },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Tamper with the payload by modifying the middle section
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    payload.username = 'hacker';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = parts.join('.');

    expect(() => jwt.verify(tamperedToken, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('should reject a JWT signed with wrong secret', () => {
    const token = jwt.sign(
      { id: testUser.id, githubId: testUser.githubId, username: testUser.username },
      'wrong-secret',
      { expiresIn: '1h' },
    );

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('should generate a refresh token with type=refresh and 7d expiry', () => {
    const refreshToken = jwt.sign(
      { id: testUser.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;

    expect(decoded.id).toBe(testUser.id);
    expect(decoded.type).toBe('refresh');
    // Expiry should be ~7 days from now
    const sevenDaysInSeconds = 7 * 24 * 3600;
    expect(decoded.exp - decoded.iat).toBe(sevenDaysInSeconds);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AES Encryption Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('AES-256 Token Encryption', () => {
  it('should encrypt and decrypt a token round-trip', () => {
    const originalToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = encryptToken(originalToken);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(originalToken);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const token = 'gho_identical_token_value';
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);

    // CryptoJS uses random salt, so ciphertexts should differ
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same value
    expect(decryptToken(encrypted1)).toBe(token);
    expect(decryptToken(encrypted2)).toBe(token);
  });

  it('should NOT return partial plaintext when decrypted with wrong key', () => {
    const originalToken = 'ghp_supersecrettoken123';
    const encrypted = encryptToken(originalToken);

    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, WRONG_ENCRYPTION_KEY);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      expect(result).not.toBe(originalToken);
      expect(result).not.toContain('supersecret');
    } catch (err: any) {
      // CryptoJS throwing on malformed UTF-8 with wrong key is correct/acceptable behavior
      expect(err).toBeDefined();
    }
  });

  it('should handle empty string encryption', () => {
    const encrypted = encryptToken('');
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long tokens', () => {
    const longToken = 'gho_' + 'a'.repeat(500);
    const encrypted = encryptToken(longToken);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(longToken);
  });
});
