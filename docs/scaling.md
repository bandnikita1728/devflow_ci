# Horizontal Scaling Guide — DevFlow CI Worker

## Architecture Overview

DevFlow CI uses **BullMQ** (backed by Redis) for job queue processing. The worker service that processes PR review jobs is designed to run **multiple instances in parallel** without any code changes.

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ GitHub   │────▶│ API      │────▶│ Redis Queue  │
│ Webhook  │     │ Gateway  │     │ (BullMQ)     │
└──────────┘     └──────────┘     └──────┬───────┘
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
                  ┌──────────┐    ┌──────────┐    ┌──────────┐
                  │ Worker 1 │    │ Worker 2 │    │ Worker 3 │
                  │ (5 jobs) │    │ (5 jobs) │    │ (5 jobs) │
                  └──────────┘    └──────────┘    └──────────┘
                        │                │                │
                        └────────────────┼────────────────┘
                                         ▼
                                  ┌──────────────┐
                                  │ PostgreSQL   │
                                  │ (via         │
                                  │  PgBouncer)  │
                                  └──────────────┘
```

## Why It's Safe: Atomic Job Claiming

BullMQ uses Redis `BRPOPLPUSH` (blocking pop + push) to atomically move a job from the "waiting" list to the "active" list. This is a **single Redis command** — it cannot be interrupted or duplicated. When 3 worker instances are all listening on the same queue:

- Redis delivers each job to **exactly one** worker
- No locks, no coordination, no race conditions at the queue level
- This is the foundational guarantee that makes horizontal scaling safe

## Safety Layers

### 1. BullMQ Atomic Claiming (Redis)
Each job is delivered to exactly one worker instance via `BRPOPLPUSH`.

### 2. Idempotency Guard (PostgreSQL)
Before processing a job, the worker checks:

```sql
SELECT headSha, status FROM "PullRequest"
WHERE repoFullName = ? AND prNumber = ?
```

If `headSha` matches **and** `status = 'reviewed'`, the job is skipped. This prevents duplicate reviews when:
- The same webhook event is enqueued more than once
- A job is retried after another instance already completed it

### 3. Lock Duration (60s)
Each job is locked to its worker for 60 seconds. If the worker crashes mid-job, the lock expires and BullMQ reassigns the job to another healthy worker.

### 4. Stalled Job Detection (30s)
Workers check for stalled jobs (whose owning worker stopped sending heartbeats) every 30 seconds. Stalled jobs are moved back to "waiting" for reprocessing.

### 5. Graceful Shutdown (30s Drain)
On `SIGTERM`:
1. Worker immediately stops accepting new jobs
2. Waits up to 30 seconds for in-flight jobs to complete
3. Force-exits after 30s to prevent SIGKILL from leaving stalled jobs

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WORKER_CONCURRENCY` | `5` | Number of parallel jobs per worker instance |
| `REDIS_URL` | — | Redis connection string (required in production) |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |

**Total parallel capacity** = `WORKER_CONCURRENCY × number_of_instances`

Example: 3 instances × 5 concurrency = 15 jobs processed simultaneously.

### Tuning Guidelines

| Scenario | Instances | Concurrency | Total Capacity |
|---|---|---|---|
| Low traffic (<50 PRs/day) | 1 | 5 | 5 |
| Medium traffic (50–200 PRs/day) | 2 | 5 | 10 |
| High traffic (200+ PRs/day) | 3–5 | 5 | 15–25 |

**Note:** Each job uses ~50MB RSS (Gemini API response buffering). Monitor memory per instance and scale horizontally (more instances) rather than vertically (higher concurrency) when hitting memory limits.

## Scaling on Docker Compose

```bash
# Start with 3 worker replicas (default)
docker compose up -d

# Scale to 5 workers at runtime
docker compose up -d --scale worker=5

# Scale back down
docker compose up -d --scale worker=1
```

The `docker-compose.yml` defaults to 3 replicas via `deploy.replicas`. Override with the `WORKER_REPLICAS` env var:

```bash
WORKER_REPLICAS=5 docker compose up -d
```

### Verify scaling

```bash
# Check running instances
docker compose ps worker

# Watch logs across all instances
docker compose logs -f worker

# Each instance logs its concurrency on startup:
# [Worker] Background processing engine active (concurrency=5). Listening for PRs.
```

## Scaling on Render

1. Deploy the worker service via `render.yaml` or the Render Dashboard
2. In the Dashboard, select the `devflow-ci-worker` service
3. Go to **Settings → Manual Scale** and set the instance count
4. Set `WORKER_CONCURRENCY` in the Environment tab (default: 5)

Each Render instance is an independent process. BullMQ handles all coordination via Redis.

## Monitoring Scaled Workers

All worker instances push metrics to Prometheus/Grafana via the Pushgateway. Key metrics to watch:

| Metric | Description | Alert Threshold |
|---|---|---|
| `bullmq_queue_depth` | Jobs waiting to be processed | > 50 for 5 min |
| `review_jobs_processed_total{status="failed"}` | Failed job count | Rate > 5/min |
| `review_job_duration_seconds` | Processing latency | p95 > 60s |
| `gemini_api_call_duration_seconds` | AI API latency | p95 > 15s |

### Diagnosing Issues

**Queue depth growing?** → Scale up instances or increase `WORKER_CONCURRENCY`.

**High failure rate?** → Check circuit breaker status. If Gemini API is down, the circuit opens and jobs complete with a fallback comment.

**Stalled jobs?** → A worker likely crashed. BullMQ auto-recovers within `stalledInterval` (30s). Check logs for OOM kills.

## Database Connection Pooling

When running multiple worker instances, use **PgBouncer** in front of PostgreSQL to pool connections:

- Each worker instance opens `CONCURRENCY` connections to Postgres
- 3 instances × 5 concurrency = 15 connections (fine without pooling)
- 10 instances × 5 concurrency = 50 connections (PgBouncer recommended)

Docker Compose includes PgBouncer by default. On Render, configure the connection pooler in the PostgreSQL service settings.
