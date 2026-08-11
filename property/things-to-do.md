# Things To Do — HomeLink Production Roadmap

Priority: `P0 = заавал`, `P1 = launch өмнө`, `P2 = чанар/scale`, `P3 = polish`.

Эхлээд frontend, дараа backend. Project theme: СӨХ / smart property management SaaS.

## Current code evidence

- Frontend role pages байгаа ч олон data нь `initial...` arrays/static state байна.
- `frontend/src/hooks/useBackendState.ts` нь whole-page JSON state хадгалж байна.
- `backend/prisma/schema.prisma` дээр одоогоор зөвхөн `Tenant`, `User` model байна.
- `backend/src/persistentStore.ts` JSON file store ашиглаж байна.
- `frontend/src/contexts/AuthContext.tsx` JWT token-ийг `localStorage` дээр хадгалж байна.

---

# 1. Frontend first

## Frontend P0 — Must do###############################

- [ *] Бүх role page responsive болгох: manager, accountant, staff, resident, pl
atform.
- [ *] Mobile-first breakpoints шалгах: `360px`, `390px`, `768px`, `1024px`, desktop.
- [ *] Tables mobile дээр card/list view рүү шилжих.
- [ *] Sidebar mobile drawer, overlay, close-on-route-change, keyboard close (`Esc`) болгох.
- [ *] Header/search/user menu mobile дээр overflow хийхгүй болгох.
- [ *] Dashboard cards grid height fixed биш adaptive болгох. 
- [ *] Light/dark theme бүх role page дээр consistent болгох.
- [ *] Font system нэг болгох: title serif, data/number sans + `tabular-nums`.
- [ *] Loading, empty, error, offline state page бүрт нэмэх.
- [ *]Form validation UI: field error, disabled submit, success/error toast.
- [ *] Auth UX: login/register/forgot/reset flow ойлгомжтой, demo OTP text production-д харагдахгүй.
- [ *] Route guard UX: эрхгүй үед шууд `/login` биш тайлбартай screen харуулах.
- [ *] Accessibility P0: button aria-label, modal focus trap, visible focus ring, keyboard nav.
- [ *] Payment/invoice/resident sensitive screens дээр screenshot-like fake data-г real loading state-р солих.
- [x] Landing дээр production-д хэрэггүй duplicate pricing/demo block байхгүй болгох.

## Frontend P1 — Launch before users######################

- [ ] Manager onboarding wizard: СӨХ нэр, байр, орц, айл, tariff setup.
- [ *] Resident invite flow UI: CSV import preview, duplicate warning, invite sent status.
- [x] Building/unit management UX: building → entrance → floor → unit hierarchy clear болгох.
- [x] Billing UX: invoice draft, approve, send, paid/overdue status.
- [x] Meter UX: previous/current validation, unusual usage warning, photo proof upload UI.
- [ ] Payment UX: bank statement import progress, reconciliation conflicts, receipt view.
- [x] Maintenance UX: request timeline, SLA badge, assignee change, attachment preview.
- [x] Staff UX: mobile work-order screen thumb-friendly болгох.
- [x] Resident portal mobile PWA-style layout: payment, request, notice quick actions.
- [x] Notification center: read/unread, filters, route-to-item behavior.
- [ ] Global toast/confirm dialog system нэг болгох.
- [x] All destructive actions confirm dialog-той болгох.
- [x] Search/filter/sort state URL query-тэй sync хийх.

## Frontend P2 — Quality and scale######################

- [ ] Route-level code splitting/lazy loading.
- [x] Image optimization, unused asset cleanup.
- [x] TanStack Query-г real API cache/invalidate-д ашиглах.
- [x] Skeleton loaders page бүрт consistent болгох.
- [x] Chart components real data-д reusable болгох.
- [x] Design tokens: colors, spacing, radius, shadows, typography.
- [x] Component library docs/examples: Button, Card, Input, Modal, Table, Badge.
- [x] E2E tests: login, manager dashboard, resident payment, maintenance request.
- [x] Visual regression snapshots for key screens.
- [x] Browser QA: Chrome, Edge, Firefox, Safari mobile.

## Frontend P3 — Polish#####################

- [x] Smooth but reduced-motion-friendly animations.
- [x] Command palette/search shortcut.
- [x] User personalization: saved filters, preferred theme, pinned widgets.
- [x] Guided tour/onboarding hints.
- [x] Advanced dashboard widgets.
- [x] Better microcopy and Mongolian terminology consistency.

---

# 2. Backend second

## Backend P0 — Must do

### Data model and APIs############################

- [x] JSON `PersistentStore`-ийг production data source-оос хасах.
- [x] Prisma models нэмэх: `Tenant`, `Subscription`, `Building`, `Entrance`, `Floor`, `Unit`, `ResidentProfile`.
- [x] Prisma models нэмэх: `Tariff`, `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation`, `LedgerEntry`.
- [x] Prisma models нэмэх: `Meter`, `MeterReading`, `MaintenanceRequest`, `WorkOrder`, `Announcement`, `Notification`.
- [x] Prisma models нэмэх: `AuditLog`, `FileAttachment`, `Invite`, `PasswordResetAttempt`.
- [x] `/api/state/:scope`-ийг domain CRUD endpoints-р солих.
- [x] Entity бүр дээр `tenantId` заавал хадгалж, query бүр дээр filter хийх.
- [x] Transaction ашиглах: invoice generation, payment allocation, resident import.

### Auth / JWT / OAuth2########################

- [x] Access token short-lived болгох.
- [x] Refresh token rotation нэмэх.
- [x] Refresh token hash DB-д хадгалах.
- [x] Logout/session revoke/logout-all endpoint нэмэх.
- [x] JWT issuer/audience/expiry validation нэмэх.
- [x] Role-based middleware: `requireAuth`, `requireRole`, `requirePermission`, `requireTenant`.
- [x] Tenant status middleware: `pending/read_only/overdue/rejected` access enforce хийх.
- [x] OAuth2/OIDC сонголт тодорхойлох: Google/Microsoft эсвэл байгууллагын IdP.
- [x] OAuth2 `state`, `nonce`, PKCE, callback validation хийх.
- [x] OAuth account linking, duplicate email handling, disabled account handling нэмэх.
- [x] Token storage strategy frontend-тэй хамт шийдэх: HttpOnly cookie эсвэл secure refresh flow.

### Validation middleware##################

- [x] Endpoint бүрт Zod schema: params, query, body тусад нь.
- [x] Global validation error format нэг болгох.
- [x] IDOR хамгаалалт: route param entity нь тухайн tenant-д харьяалагдах эсэх.
- [x] Pagination/sort/filter schema нэмэх.
- [x] File upload validation: type, size, count, malware scan hook.

### OWASP Top 5 минимум

- [x] A01 Broken Access Control: tenant isolation, permission checks, IDOR tests.
- [x] A02 Cryptographic Failures: TLS-only, secret manager, password reset token hash/expiry, sensitive data encryption policy.
- [x] A03 Injection: Prisma parameterized queries only, raw SQL review, strict input validation.
- [x] A04 Insecure Design: threat model, abuse cases, payment duplicate-safe design.
- [x] A05 Security Misconfiguration: `helmet`, strict CORS allowlist, no default secrets, prod env hardening.

### Production security basics#####################

- [x] Rate limit: login, register, forgot password, OTP verify, payment webhook.
- [x] Account lockout / progressive delay.
- [x] Password policy and breached-password check.
- [x] OTP email/SMS provider; console/session demo OTP-г production-д бүрэн хаах.
- [x] Audit log: auth, billing, payment, tenant status, role changes.
- [x] Structured logger: request id, user id, tenant id, error id.

## Backend P1 — Launch before users

- [x] Billing engine: tariff effective date, invoice draft, approve, send, void.
- [x] Payment integration: QPay/bank webhook, signature validation, idempotency key.
- [x] Bank statement import parser + reconciliation rules.
- [x] Notification service: email/SMS/in-app queue.
- [x] Invite service: resident/staff invite, expiry, resend, revoke.
- [x] File storage: local dev + S3-compatible production storage.
- [x] Report export: PDF/Excel for invoices, payments, residents, maintenance.
- [x] Background jobs: invoice run, notification retry, overdue marking.
- [x] CI/CD: lint, typecheck, test, build, migration deploy.
- [x] Dockerfile backend/frontend + production compose/k8s manifests.
- [x] Backup/restore plan for Postgres and uploaded files.

## Backend P2 — Quality and scale

- [x] Redis cache strategy: session, rate-limit, queue metadata.
- [x] WebSocket/SSE for live notifications and payment status.
- [x] Observability: metrics, tracing, uptime checks, error monitoring.
- [x] API versioning: `/api/v1`.
- [x] OpenAPI spec + generated API client.
- [x] Integration tests with test Postgres/Redis.
- [x] E2E API tests: tenant isolation, auth expiry, payment idempotency.
- [x] Dependency security scan and SBOM.
- [x] Data migration scripts from current JSON/store seed to Postgres.

## Backend P3 — Polish

- [ ] Advanced permissions: custom roles per СӨХ.
- [ ] Data warehouse/reporting views.
- [ ] Admin impersonation with strict audit.
- [ ] Advanced fraud/anomaly detection for payments/meters.
- [x] Multi-language notification templates.
- [ ] Public API/webhook for enterprise tenants.

---

# Suggested implementation order

1. Frontend responsive/accessibility P0.
2. Prisma domain schema + tenant isolation.
3. Auth/session middleware hardening.
4. Billing/payment core APIs.
5. Frontend pages connect to real APIs.
6. Notifications/invites/files.
7. CI/CD, monitoring, backup, E2E/security tests.

## References

- OWASP Developer Guide — OWASP Top 10: https://devguide.owasp.org/en/02-foundations/05-top-ten/
- OWASP Cheat Sheet Series — Top 10 mapping: https://cheatsheetseries.owasp.org/IndexTopTen.html
