# Observability and Monitoring Guide

This guide details how to configure production observability for DevFlow CI using Prometheus metrics and Grafana Cloud.

---

## 1. Creating a Grafana Cloud Account
1. Visit [Grafana Cloud](https://grafana.com/products/cloud/) and sign up for a free account.
2. Once logged into the Grafana Portal, locate the **Prometheus** service card.
3. Click on **Details** to see the connection endpoints:
   - **Remote Write Endpoint**: The URL where metrics will be pushed.
   - **Username / Instance ID**: A numeric identifier.
   - **Password / API Token**: Create a Grafana Cloud access token with `metrics:write` permissions.

---

## 2. Ingestion Architectures for Render
Because Render does not allow inbound scraping of services (unless they are publicly exposed, which is unsafe for internal monitoring endpoints), we support two ingestion paths:

### Option A: Prometheus Pushgateway (Recommended)
DevFlow CI implements direct Pushgateway publishing. If the `PUSHGATEWAY_URL` environment variable is defined, the worker will periodically push all Prometheus metrics asynchronously.

1. Deploy a Prometheus Pushgateway service on Render or use the Grafana Cloud Pushgateway endpoint.
2. Provide the `PUSHGATEWAY_URL` to the DevFlow CI services.
3. Configure the Grafana Cloud Prometheus instance to scrape your Pushgateway.

### Option B: Prometheus Sidecar Scraper
Alternatively, run a lightweight Prometheus agent as a sidecar container in your Render deployment. The sidecar scrapes `/metrics` locally and pushes data to Grafana Cloud via `remote_write`.

Add the following configuration block to your sidecar's `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:3000'] # Port of Express API gateway

  - job_name: 'worker'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3002'] # Worker metrics port
    headers:
      X-Metrics-Secret: "${METRICS_SECRET}" # Authenticates access to the worker scraper endpoint

remote_write:
  - url: <GRAFANA_CLOUD_URL>
    basic_auth:
      username: <GRAFANA_CLOUD_USER>
      password: <GRAFANA_CLOUD_API_KEY> # Must match the API token created in Grafana Portal
```

---

## 3. Environment Variables Configuration

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `METRICS_SECRET` | Gateway + Worker | Internal API secret key required in request headers to scrape worker `/metrics`. |
| `PUSHGATEWAY_URL` | Worker | Optional. URL to push metrics directly to a Prometheus Pushgateway. |
| `WORKER_METRICS_PORT` | Worker | Optional. Port for the worker scraper server (defaults to `3002`). |
| `INTERNAL_API_SECRET` | Gateway | Secret verifying internal API status endpoint access. |

---

## 4. Security & Privacy Controls
- **Scraper Authentication**: The worker `/metrics` endpoint is protected by a mandatory header check: requests are rejected with `403 Forbidden` if `x-metrics-secret` is absent or mismatching.
- **Card-bomb Protection**: Whitelisted route paths are enforced. Dynamic URL segments containing potential user IDs or database primary keys are stripped or categorized as `other` to keep metric label cardinality low.
- **No PII**: No repository names, diff details, PR titles, or usernames are logged or used as label values.
- **Async Metrics**: External Pushgateway exports run as async fire-and-forget loops with a 5-second timeout to prevent slowing down application code execution.
