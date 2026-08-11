# Observability runbook

- Scrape authenticated `/metrics` every 30 seconds; alert on 5xx rate, p95 latency, process restarts, Redis/DB health, queue dead letters, and missed background runs.
- Probe `/health` externally every minute from two regions. Alert after 3 failures and track monthly availability/SLO.
- Forward JSON logs to the log platform. `X-Request-Id` and W3C `traceparent` correlate frontend, API, and provider calls.
- Set `ERROR_MONITOR_URL`/token for error ingestion; alert on new errors and spikes. Never send passwords, tokens, request bodies, or personal data.
- Dashboard: request rate/error/latency, uptime, DB/Redis dependency status, payment webhook failures, notification retries. Keep metrics 13 months and logs 30–90 days per policy.
- Incident: use error ID → request/trace ID → logs, confirm impact, assign owner, mitigate, then record timeline and follow-up.
