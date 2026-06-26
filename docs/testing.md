# Testing Guide for DevFlow CI

DevFlow CI employs a complete, multi-tiered test suite to guarantee reliability, correctness, security, and performance.

The testing setup is split into three main parts:
1. **Unit Tests** (Jest): Located in `apps/api-gateway/src/__tests__` and `apps/worker/src/__tests__`. They mock all database, network, and API gateway routes, and execute in milliseconds without external dependencies.
2. **Integration Tests** (Jest + Testcontainers): Located in `apps/api-gateway/src/__tests__/integration`. They spin up real, isolated PostgreSQL and Redis containers using Docker to test database queries and queues end-to-end.
3. **Dashboard Tests** (Vitest + JSDOM): Located in `apps/dashboard/src` (e.g. `__tests__` directories). They test React frontend components.

---

## Prerequisites

To run the entire test suite locally:
- **Node.js** v18+ & **npm** installed.
- **Docker** daemon running (required for Integration Tests using `testcontainers`).
  *If Docker is not running, integration tests will gracefully skip and log warnings instead of failing the build.*

---

## Test Command Reference

Run these commands from the root of the repository:

### 1. Run Unit Tests Only
Fast unit tests (no Docker/Redis/Postgres required).
```bash
npm run test:unit
```

### 2. Run Integration Tests Only
Requires Docker running. Starts up Postgres and Redis containers, pushes the Prisma schema, and runs pipeline tests.
```bash
npm run test:integration
```

### 3. Run All Jest Tests
Runs both unit and integration tests.
```bash
npm run test:all
```

### 4. Run Coverage Reports
Runs all tests and aggregates coverage.
```bash
npm run test:coverage
```
*Configured Coverage Thresholds (Strictly Enforced):*
- **Branches:** >= 70%
- **Functions:** >= 80%
- **Lines:** >= 80%
- **Statements:** >= 80%

### 5. Run Dashboard Tests (Vitest)
Runs Vitest unit/component tests for the dashboard UI.
```bash
# To run in apps/dashboard:
npm --prefix apps/dashboard run test
```

### 6. Run TypeScript Typechecking
```bash
npm run typecheck
```

---

## Test Directory Structure

```
.
├── apps/
│   ├── api-gateway/
│   │   └── src/
│   │       ├── middleware/
│   │       │   └── verifyGitHubSignature.ts   # Webhook HMAC validation
│   │       ├── routes/
│   │       │   └── auth.ts                     # Auth handlers (JWT + AES)
│   │       └── __tests__/
│   │           ├── authService.test.ts        # Unit: JWT & AES
│   │           ├── webhookHandler.test.ts     # Unit: HMAC & event router
│   │           └── integration/
│   │               ├── security.integration.test.ts    # Int: Security controls & SQLi
│   │               └── webhookPipeline.integration.test.ts # Int: E2E webhook + cascades
│   └── worker/
│       └── src/
│           ├── worker.ts                      # BullMQ processing logic
│           └── __tests__/
│               └── reviewProcessor.test.ts    # Unit: Diff parsing & Gemini logic
│   └── dashboard/
│       ├── vitest.config.ts                   # Vitest layout config
│       └── src/
│           ├── test/
│           │   └── setup.ts                   # React Testing Library setup
│           └── pages/
│               └── __tests__/
│                   └── PrivacyPage.test.tsx   # Vitest component unit test
├── jest.config.ts                             # Root Jest Multi-Project Configuration
└── docs/
    └── testing.md                             # This guide
```

---

## CI/CD Pipeline Integration

To configure this suite in your CI pipeline (e.g. GitHub Actions), ensure that Docker is running in the runner. Below is a sample `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      # Testcontainers dynamically spins up Redis & Postgres on the runner's Docker daemon.
      # No need to configure service containers manually, just ensure Docker is running!

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Typecheck TypeScript
        run: npm run typecheck

      - name: Run Unit Tests
        run: npm run test:unit

      - name: Run Integration Tests (Requires Docker)
        run: npm run test:integration

      - name: Run Coverage Check
        run: npm run test:coverage
```
