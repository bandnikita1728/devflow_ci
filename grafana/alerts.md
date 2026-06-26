# Prometheus & Grafana Alerts Definition

This document outlines the standard Prometheus Alerting Rules for DevFlow CI.

---

## 1. Dead-Letter Queue Alert (High Priority)
* **Description**: Triggers if any jobs are failing and stuck in the BullMQ dead-letter queue (failed jobs state) for more than 5 minutes.
* **Notification Target**: PagerDuty, Email.

```yaml
groups:
  - name: DevFlowQueueAlerts
    rules:
      - alert: BullMQDeadLetterQueueNotEmpty
        expr: bullmq_dead_letter_queue_depth > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "BullMQ Dead-Letter Queue contains failed jobs"
          description: "There are {{ $value }} failed jobs in the BullMQ dead-letter queue for over 5 minutes. Active intervention required."
```

---

## 2. API Gateway Latency Alert (Medium Priority)
* **Description**: Triggers if the 95th percentile latency of HTTP API gateway requests exceeds 5 seconds for a sustained 10-minute window.
* **Notification Target**: Slack Webhook, Email.

```yaml
groups:
  - name: DevFlowLatencyAlerts
    rules:
      - alert: HighAPILatencyP95
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "95th percentile latency of route {{ $labels.route }} is high"
          description: "API gateway route {{ $labels.route }} is exhibiting high P95 latency ({{ $value }}s) for more than 10 minutes."
```

---

## 3. Circuit Breaker Tripped Alert (Immediate Priority)
* **Description**: Triggers if the Gemini AI Circuit Breaker stays open for more than 2 minutes, indicating persistent Gemini downtime.
* **Notification Target**: Slack Webhook, PagerDuty, Email.

```yaml
groups:
  - name: DevFlowCircuitAlerts
    rules:
      - alert: GeminiCircuitBreakerOpen
        expr: rate(review_jobs_processed_total{status="circuit_open"}[5m]) > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Gemini AI Circuit Breaker is OPEN"
          description: "AI Review fallback has been actively triggering for over 2 minutes. The Gemini API call circuit is currently tripped."
```

---

## 4. Review Processing Failure Rate Alert (High Priority)
* **Description**: Triggers if more than 20% of code review jobs fail over a rolling 5-minute window.
* **Notification Target**: Slack Webhook, Email.

```yaml
groups:
  - name: DevFlowJobAlerts
    rules:
      - alert: ReviewJobsHighFailureRate
        expr: |
          sum(rate(review_jobs_processed_total{status="failed"}[5m]))
          /
          sum(rate(review_jobs_processed_total[5m])) * 100 > 20
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High failure rate in code review processing"
          description: "More than 20% of BullMQ review jobs are failing (current: {{ $value | printf \"%.2f\" }}%) over the last 5 minutes."
```
