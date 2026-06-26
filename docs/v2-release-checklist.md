# DevFlow CI V2 Release Checklist

### Render Environment Variables
- [ ] METRICS_SECRET added to api-gateway service (random 32-char hex)
- [ ] METRICS_SECRET added to worker service (same value)
- [ ] INTERNAL_API_SECRET added to api-gateway service (random 32-char hex, different from METRICS_SECRET)
- [ ] WORKER_CONCURRENCY added to worker service (start with 5)
- [ ] GRAFANA_CLOUD_URL added to worker service
- [ ] GRAFANA_CLOUD_USER added to worker service
- [ ] GRAFANA_CLOUD_API_KEY added to worker service
- [ ] Verify all existing env vars still present (DATABASE_URL, REDIS_URL, GEMINI_API_KEY, etc.)

### CI/CD Verification
- [ ] Push a test commit to v2-development — confirm ci.yml passes all jobs (lint, typecheck, test, build)
- [ ] Confirm deploy.yml does NOT trigger on v2-development (only triggers on main)
- [ ] Confirm all GitHub Secrets are set: RENDER_API_GATEWAY_HOOK, RENDER_WORKER_HOOK, RENDER_DASHBOARD_HOOK
- [ ] Confirm test coverage thresholds pass (branches 70%, functions 80%, lines 80%)

### Database
- [ ] Prisma migration for new ReviewComment columns (severity, category, owasp_ref, fix_code, etc.) is committed
- [ ] Run npx prisma migrate deploy manually on production DB before merge OR confirm it runs in deploy step
- [ ] Verify unique constraint on (repo_id, pr_number, head_sha) exists in schema

### Security
- [ ] /metrics endpoint returns 403 without METRICS_SECRET header — verified in staging
- [ ] /health/circuit endpoint returns 403 without INTERNAL_API_SECRET header — verified in staging
- [ ] No secrets or stack traces appear in any API error response body — manual spot check
- [ ] Redis has requirepass set in production

### Monitoring
- [ ] Grafana Cloud dashboard is live and receiving metrics from staging worker
- [ ] At least one alert rule is active (dead-letter queue > 0)
- [ ] Circuit breaker state visible in /health/circuit response

### README + Docs
- [ ] CI badge renders correctly on GitHub
- [ ] Mermaid diagram renders correctly on GitHub
- [ ] All V2 roadmap items marked ✅
- [ ] New env vars documented in README table
- [ ] /docs/monitoring.md, /docs/scaling.md, /docs/testing.md all committed

### Final Merge Steps
Run these in order:
```bash
# 1. Make sure local is up to date
git checkout v2-development
git pull origin v2-development

# 2. Run full test suite one final time
npm run test:all

# 3. Merge
git checkout main
git merge v2-development
git push origin main

# 4. Watch GitHub Actions — confirm ci.yml then deploy.yml both go green
# 5. Verify live site: open a test PR and confirm bot posts a structured comment
```
