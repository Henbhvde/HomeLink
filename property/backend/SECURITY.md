# Sensitive data encryption policy

- Production traffic is TLS-only; the trusted proxy must set `X-Forwarded-Proto: https`.
- Secrets come from environment variables or secret-manager mounted `*_FILE` paths and must never be committed.
- Passwords use scrypt; refresh/reset tokens are stored only as SHA-256 hashes with expiry and revocation.
- Database, backups, and object storage must enable provider-managed encryption at rest; highly sensitive fields require application-level envelope encryption with a KMS-managed key.
- Keys are least-privilege, audited, rotated regularly, and rotation supports the previous key during migration.
