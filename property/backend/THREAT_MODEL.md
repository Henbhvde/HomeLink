# Threat model and abuse cases

Protected assets: tenant data, identities, invoices, payments, attachments, and audit history. Trust boundaries are browser/API, API/IdP, API/database, Redis, and object storage.

Key abuse cases and controls:

- Cross-tenant reads/writes: tenant-scoped queries, permission middleware, IDOR tests.
- Credential/session theft: TLS, short access tokens, HttpOnly rotated refresh tokens, revoke-all.
- Duplicate/replayed payments: tenant-scoped unique reference plus canonical request hash; identical retries return the original payment, conflicting retries fail atomically.
- Invoice/payment tampering: strict schemas, serializable transactions, locked tenant-owned invoices, immutable ledger entries.
- Upload abuse: MIME/size/count validation and malware scan hook.
- OAuth/login abuse: state, nonce, PKCE, issuer/audience validation, disabled-account checks.

Residual risks are reviewed when adding a new role, external integration, sensitive field, or money-moving workflow.
