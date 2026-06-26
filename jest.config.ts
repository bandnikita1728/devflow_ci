import type { Config } from 'jest';

/**
 * jest.config.ts — Multi-project Jest configuration for DevFlow CI.
 *
 * Projects:
 *   1. "unit"        — Fast unit tests, no Docker/DB/Redis required.
 *   2. "integration" — Testcontainers (real Postgres + Redis), 60s timeout.
 *
 * Usage:
 *   npm run test:unit         # Unit tests only
 *   npm run test:integration  # Integration tests only (requires Docker)
 *   npm run test:all          # Both
 *   npm run test:coverage     # Both + coverage report
 */
const config: Config = {
  projects: [
    // ── Unit Tests ─────────────────────────────────────────────────────────
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/apps/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '\\.integration\\.test\\.ts$',
      ],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    },
    // ── Integration Tests ──────────────────────────────────────────────────
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/apps/**/*.integration.test.ts',
      ],
      testTimeout: 60_000, // Container startup can take time
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    },
  ],

  // ── Coverage ───────────────────────────────────────────────────────────
  collectCoverageFrom: [
    'apps/api-gateway/src/**/*.ts',
    'apps/worker/src/**/*.ts',
    '!apps/**/dist/**',
    '!apps/**/__tests__/**',
    '!apps/**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],
};

export default config;
