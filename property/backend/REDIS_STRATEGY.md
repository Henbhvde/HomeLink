# Redis strategy

- Redis is disposable infrastructure; Postgres remains the source of truth.
- Sessions: refresh-token hashes/revocation stay in Postgres. Cache only non-sensitive session metadata for 5 minutes and invalidate it on rotate, revoke, logout, or role/status change. Never store raw tokens.
- Rate limits: hashed IP/email keys use endpoint-specific TTLs. Production fails closed if Redis is unavailable; monitor rejected requests and memory pressure.
- Queues: payloads live in namespaced lists, status metadata expires after 24 hours, failed jobs move to dead-letter lists after 3 attempts. Workers use a 60-second distributed lock and jobs must be idempotent.
- All keys use `homelink:v1:*`; tenant/user ownership is retained in metadata and checked before returning job status.
- Production: TLS Redis URL, authentication/ACL, encryption at rest, private network, `noeviction`, persistence/replica for queues, memory/latency/connection alerts. Do not mix production and staging databases.
- Recovery: rate limits and metadata may be rebuilt. Pause workers during Redis recovery, inspect/replay dead letters, and reconcile durable billing/notification state from Postgres.
