# HomeLink / Smart Property Management — Production Readiness

Одоогийн байдал: frontend UI ихэнх role/page-үүдтэй, auth-ийн суурь backend байгаа. Гэхдээ production-д гаргахын өмнө доорх зүйлс заавал дуусах хэрэгтэй. Энэ файл нь code review дээр үндэслэсэн checklist.

## Хийсэн суурь

- React/Vite frontend: landing, pricing, manager, accountant, staff, platform admin, resident routes байна.
- Express backend: login/register/forgot password/JWT auth, Prisma `Tenant`/`User`, Redis health check байна.
- Local dev: `docker-compose.yml` дээр Postgres/Redis байна.
- Basic validation test: `backend/src/validation.test.ts` байна.

## P0 — Production blocker

### 1. Real database model дутуу

- Одоо Prisma schema зөвхөн `Tenant`, `User` байна.
- Building, unit, resident profile, invoice, payment, meter, maintenance, announcement, expense, audit log model-ууд алга.
- `backend/src/persistentStore.ts` JSON file store ашиглаж байна; production-д concurrency, backup, reporting, tenant isolation-д тохирохгүй.
- `/api/state/:scope` нь whole-page JSON хадгалж байгаа тул entity-level validation, transaction, permission хийх боломж муу.

Шийдэл:
- Prisma model-уудыг domain бүрээр нэмэх.
- `/api/state/:scope`-ийг entity API-уудаар солих.
- Tenant бүрийн query дээр `tenantId` заавал filter хийх.

### 2. Platform tenant ба auth tenant хоёр салангид байна

- Manager register хийхэд Prisma `Tenant` үүсдэг.
- Platform admin-ийн tenants/requests нь тусдаа seed/JSON store дээр явж байна.
- Тиймээс platform approval, subscription, read-only status нь бодит user workspace-т нөлөөлөхгүй.

Шийдэл:
- Platform tenant data-г Prisma `Tenant`/`Subscription` model-той нэгтгэх.
- Tenant status: `pending`, `active`, `trial`, `overdue`, `read_only`, `rejected`-ийг backend auth/route access-д enforce хийх.

### 3. Security hardening дутуу

- JWT token browser `localStorage` дээр хадгалагдаж байна.
- Refresh token/session revoke/logout-all байхгүй.
- Login, OTP, reset password дээр rate limit/lockout байхгүй.
- OTP production-д email/SMS-р илгээхгүй; dev үед console/session-д харагдаж байна.
- `helmet`, strict CORS allowlist, request logging, audit trail байхгүй.

Шийдэл:
- HttpOnly secure cookie эсвэл refresh-token architecture сонгох.
- Login/OTP endpoint дээр rate limit нэмэх.
- Email/SMS provider холбох.
- Security headers, structured logs, audit log нэмэх.

### 4. Payment / billing бодит биш

- Invoice run, QR payment, bank statement import, reconciliation UI байгаа ч backend business logic/API байхгүй.
- QPay/bank integration, webhook, receipt, refund, duplicate payment protection алга.
- Ledger/accounting model байхгүй.

Шийдэл:
- Invoice, invoice line, payment, payment allocation, ledger entry model нэмэх.
- QPay/bank webhook signature validation хийх.
- Payment статусыг resident/manager/accountant талд real-time шинэчлэх.

### 5. Resident data бодит backend-тэй бүрэн холбогдоогүй

- Resident portal invoice/history/service/community data ихэнх нь static/initial state байна.
- Resident өөрийн apartment/unit-аас өөр data харахгүй байх tenant+unit permission баталгаажуулаагүй.

Шийдэл:
- Resident profile, unit ownership/occupancy model нэмэх.
- Resident API бүр дээр `tenantId + userId/unitId` authorization шалгах.

## P1 — Paying users өмнө дуусгах

### Product flows

- Onboarding: СӨХ хүсэлт → approval → tenant үүсэх → manager invite → initial setup flow.
- Resident invite: CSV import, phone/email invite, invite expiry, duplicate handling.
- Meter reading: previous/current validation, abnormal usage alert, photo proof.
- Maintenance: assignment, SLA timer, status history, attachments, resident feedback.
- Notifications: email/SMS/push/in-app notification queue.
- Reports: бодит data-аас PDF/Excel export.
- Settings: tariff/version history, effective date, approval flow.

### Admin / operations

- Super admin audit log backend-д хадгалах.
- Subscription/billing status tenant access-д бодитоор нөлөөлөх.
- Account disabled/read-only үед frontend биш backend дээр block хийх.
- Role permission-г зөвхөн role string биш granular permission болгож задлах.

### Reliability

- Dockerfile/frontend+backend production build нэмэх.
- CI pipeline: typecheck, test, build, migration check.
- Staging/prod env config, secret manager, backup/restore plan.
- Health/readiness endpoint ялгах: app alive vs DB/Redis ready.
- Error monitoring/log aggregation нэмэх.

### Testing

- Backend integration tests: auth, tenant isolation, CRUD, billing/payment.
- Frontend route/auth tests.
- E2E tests: manager onboarding, invoice create, resident payment, maintenance request.
- Security tests: forbidden tenant access, expired token, invalid OTP/rate limit.

## P2 — Launch quality

- Accessibility: keyboard nav, focus state, contrast, dialog aria.
- Performance: bundle split, lazy routes, image optimization, dashboard query caching.
- Mobile polish: role pages дээр overflow/table responsive шалгах.
- i18n/encoding: Mongolian text mojibake болохгүй UTF-8 pipeline баталгаажуулах.
- Legal: privacy policy, terms, data retention, backup retention, admin access policy.
- Analytics: activation funnel, payment success/fail, support events.

## Page-by-page gap

| Хэсэг | Production gap |
| --- | --- |
| Landing/Pricing | Contact/signup CRM, plan checkout, real subscription үүсгэх flow дутуу |
| Manager Dashboard | Metrics static; DB/reporting source хэрэгтэй |
| Buildings | CRUD нь normalized building/unit DB рүү ороогүй |
| Residents | Import/invite, resident account linking, duplicate validation дутуу |
| Billing | Invoice generation formula, tariff effective date, ledger дутуу |
| Payments | Bank/QPay integration, reconciliation, receipt backend дутуу |
| Meters | Reading validation, billing integration, attachment proof дутуу |
| Maintenance | Assignment/SLA/history/attachments notification backend дутуу |
| Accountant | Expense/payment/report data source бүрэн production биш |
| Staff | Work orders static/store state; staff workflow backend дутуу |
| Resident | Own-unit authorization, live invoice/payment/service data дутуу |
| Platform Admin | Tenant/subscription data Prisma auth tenant-тэй нэгтгэгдээгүй |

## Санал болгож буй хийх дараалал

1. Prisma domain schema гаргах: tenants, buildings, units, residents, invoices, payments, meters, maintenance.
2. `/api/state/:scope`-ийг backend CRUD API-уудаар солих.
3. Tenant isolation + read-only/subscription enforcement хийх.
4. Billing/payment core workflow-оо эхэлж production болгох.
5. Notifications + invite + password reset email/SMS холбох.
6. CI/CD, Dockerfile, staging env, backup, monitoring нэмэх.
7. E2E/security tests хийж launch checklist хаах.

## Minimum production definition

Production гэж үзэх minimum шалгуур:

- Бүх sensitive/business data Postgres дээр normalized хадгалагддаг.
- Бүх API tenant-isolated, validated, audited байна.
- Auth token/session lifecycle secure байна.
- Payment/invoice flow duplicate-safe, traceable байна.
- Deploy, rollback, backup, monitoring, logs бэлэн байна.
- Critical user flows automated test-тэй байна.
