import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createDataStore } from './dataStore.js';
import { getDomainPrismaAdapter } from './domainPrismaCrud.js';
import { createAccessToken, createPasswordResetToken, hashSensitiveToken, matchesSensitiveToken, verifyPasswordResetToken, type AuthTokenPayload } from './auth.js';
import { hashPassword, verifyPassword } from './password.js';
import { prisma } from './prisma.js';
import { ensureRedisConnection, getRedisMode } from './redis.js';
import { approveRequestSchema, bankStatementImportSchema, fileUploadSchema, forgotPasswordSchema, googleOAuthSchema, googleStartQuerySchema, idParamsSchema, inviteAcceptSchema, invoiceGenerationSchema, inviteCreateSchema, loginSchema, notificationQueueSchema, organizationRequestSchema, paginationQuerySchema, parseBody, parseParams, parseQuery, paymentAllocationSchema, paymentWebhookHeadersSchema, paymentWebhookParamsSchema, paymentWebhookSchema, profileUpdateSchema, qpayInvoiceCreateSchema, readOnlySchema, registerSchema, rejectRequestSchema, reportExportParamsSchema, resetPasswordSchema, residentImportSchema, residentMembershipRequestSchema, roleChangeSchema, statePayloadSchema, subscriptionSchema, tenantListQuerySchema, verifyOtpSchema } from './validation.js';
import { allocatePayment, generateInvoices, importResidents, transitionInvoice } from './transactionService.js';
import { issueRefreshToken, listSessions, readRefreshCookie, refreshCookie, revokeAllSessions, revokeRefreshToken, revokeSession, rotateRefreshToken } from './refreshToken.js';
import { defaultPermissions, requireAuth, requirePermission, requireRole, requireTenant, requireTenantStatus } from './authorization.js';
import { createOAuthFlow, oauthCookie, readOAuthCookie, verifyOAuthFlow } from './oauthSecurity.js';
import { isUniqueConflict, newGoogleUserNeedsOnboarding, newGoogleUserRole, oauthLinkIssue } from './oauthAccount.js';
import { belongsToTenant, enforceTenantScope, findTenantEntity } from './tenantEntity.js';
import { parseDataUrl, validateEmbeddedUploads } from './fileUpload.js';
import { requireTls } from './transportSecurity.js';
import { corsAllowlist, validateProductionEnvironment } from './environment.js';
import { authRateLimits } from './rateLimit.js';
import { clearLoginFailures, currentLoginPenalty, recordLoginFailure } from './loginProtection.js';
import { isBreachedPassword } from './passwordSecurity.js';
import { demoOtpEnabled, sendPasswordResetOtp } from './otpProvider.js';
import { writeAudit } from './auditLog.js';
import { logError, logEvent, requestLogger } from './logger.js';
import { verifyWebhookSignature } from './paymentWebhook.js';
import { getSecret } from './secrets.js';
import { parseBankStatementCsv, reconcileBankStatement } from './bankReconciliation.js';
import { createNotificationJob, enqueueNotifications } from './notificationService.js';
import { createInvite, expireInvites, resendInvite, revokeInvite } from './inviteService.js';
import { createFileStorage, createStorageKey, localUploadDirectory } from './fileStorage.js';
import { loadReportRows, renderExcel, renderPdf } from './reportExport.js';
import { enqueueInvoiceRun, getBackgroundJobStatus, runBackgroundJobs } from './backgroundJobs.js';
import { publishLiveEvent, subscribeToLiveEvents } from './liveEvents.js';
import { detectMeterAnomalies, detectPaymentAnomalies, type MeterReading, type Payment } from './anomalyService.js';
import { renderTemplate } from './notificationTemplates.js';
import { triggerWebhook } from './webhookService.js';
import { observabilityMiddleware, prometheusMetrics } from './observability.js';
import { createQpayInvoice, type QpayDeeplink } from './qpayService.js';
import { createStripeCheckout, getStripeCheckout, verifyStripeWebhook } from './stripeService.js';
import { getManagerDashboardStats, getAccountantDashboardStats } from './dashboardService.js';
import {
  getBillingStats,
  getMaintenanceStats,
  getPaymentStats,
  getReportsStats,
  getTransparencyStats,
} from './statsService.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
validateProductionEnvironment();

function getFrontendUrl() {
  const configured = process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL;
  return configured
    ?.split(',')
    .map((url) => url.trim())
    .find(Boolean);
}
const store = await createDataStore(prisma);
const fileStorage = createFileStorage();

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  code?: string;
  details?: Array<{ path: string; message: string }>;
  errorId?: string;
};

function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } satisfies ApiResponse<T>);
}

type ValidationError = { code: 'VALIDATION_ERROR'; message: string; details: Array<{ path: string; message: string }> };
type StoredQpayInvoice = { invoiceId: string; senderInvoiceNo: string; amount: number; qpayInvoiceId: string; qrText?: string; qrImage?: string; shortUrl?: string; deeplinks: QpayDeeplink[]; createdAt: string };
type OnboardingCheckout = { tenantId: string; amount: number; stripeSessionId: string; checkoutUrl: string; status: 'pending' | 'paid'; createdAt: string; paidAt?: string; paymentId?: string };

// API-гаас хэрэглэгч рүү гарах алдааг нэг газраас Монголчилно.
// Техникийн provider/database алдааг дэлгэцэнд ил гаргахгүй.
const mongolianErrors: Record<string, string> = {
  'Validation failed.': 'Оруулсан мэдээллийг шалгана уу.',
  'An account with this email already exists.': 'Энэ и-мэйл хаягаар бүртгэлтэй хэрэглэгч байна.',
  'Email or password is incorrect.': 'И-мэйл хаяг эсвэл нууц үг буруу байна.',
  'Account is temporarily locked.': 'Олон удаа буруу нууц үг оруулсан тул бүртгэл түр түгжигдсэн байна.',
  'Account is disabled.': 'Энэ бүртгэл идэвхгүй байна.',
  'User not found.': 'Хэрэглэгч олдсонгүй.',
  'Resource not found.': 'Мэдээлэл олдсонгүй.',
  'Workspace request not found.': 'СӨХ-ийн хүсэлт олдсонгүй.',
  'Workspace not found.': 'СӨХ олдсонгүй.',
  'Selected unit not found.': 'Сонгосон айл олдсонгүй.',
  'Active membership was not found.': 'Идэвхтэй гишүүнчлэл олдсонгүй.',
  'Invitation not found.': 'Урилга олдсонгүй.',
  'Invitation not found or expired.': 'Урилга олдсонгүй эсвэл хугацаа нь дууссан байна.',
  'Invitation is missing or expired.': 'Урилга байхгүй эсвэл хугацаа нь дууссан байна.',
  'Pending resident request not found.': 'Хүлээгдэж буй оршин суугчийн хүсэлт олдсонгүй.',
  'Login session is invalid or expired.': 'Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.',
  'OAuth state is invalid or expired.': 'Google нэвтрэх хүсэлтийн хугацаа дууссан байна. Дахин оролдоно уу.',
  'Google OAuth token exchange failed.': 'Google-ээр нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.',
  'Google account could not be verified.': 'Google бүртгэлийг баталгаажуулж чадсангүй.',
  'Google login failed.': 'Google-ээр нэвтрэхэд алдаа гарлаа.',
  'Google OAuth environment variables are not configured.':
    'Google нэвтрэлтийн тохиргоо сервер дээр дутуу байна.',
  'Google redirect URI does not match server configuration.':
    'Google redirect URI серверийн тохиргоотой таарахгүй байна.',
  'Payment webhook verification failed.': 'Төлбөрийн баталгаажуулалт амжилтгүй боллоо.',
  'Payment webhook configuration is incomplete.': 'Төлбөрийн тохиргоо дутуу байна.',
  'Invalid payment webhook payload.': 'Төлбөрийн мэдээлэл буруу байна.',
  'Invoice not found.': 'Нэхэмжлэл олдсонгүй.',
  'Invoice is not payable.': 'Энэ нэхэмжлэлийг төлөх боломжгүй.',
  'Invoice is already paid.': 'Энэ нэхэмжлэл төлөгдсөн байна.',
  'Maintenance request not found.': 'Засварын хүсэлт олдсонгүй.',
  'No recipient address was found.': 'Хүлээн авагчийн хаяг олдсонгүй.',
  'File type is not supported.': 'Файлын төрөл дэмжигдэхгүй байна.',
  'File is too large.': 'Файлын хэмжээ хэтэрсэн байна.',
  'Invalid request body.': 'Хүсэлтийн мэдээлэл буруу байна.',
};

function localizeErrorMessage(message: string) {
  const text = message.trim();
  if (mongolianErrors[text]) return mongolianErrors[text];
  if (/[А-Яа-яӨөҮү]/.test(text)) return text;
  if (text.startsWith('No billable charges found for unit ')) return 'Сонгосон айлд нэхэмжлэх төлбөрийн төрөл олдсонгүй.';
  // Англи, техникийн алдаа хэрэглэгчийн дэлгэцэнд гарахгүй.
  return 'Хүсэлтийг боловсруулахад алдаа гарлаа. Дахин оролдоно уу.';
}

function sendError(res: Response, statusCode: number, error: string | ValidationError) {
  const validation = typeof error === 'string' ? null : error;
  const message = localizeErrorMessage(typeof error === 'string' ? error : error.message);
  const errorId = statusCode >= 500 ? logError(res.locals.errorCause ?? message, res.locals.request as Request | undefined, res) : undefined;
  delete res.locals.errorCause;
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    ...(validation ? { code: validation.code, details: validation.details } : {}),
    ...(errorId ? { errorId } : {}),
  } satisfies ApiResponse<never>);
}

function getValidationMessage(error?: ValidationError): ValidationError {
  return error ?? { code: 'VALIDATION_ERROR', message: 'Оруулсан мэдээллийг шалгана уу.', details: [] };
}

type Plan = 'Start' | 'Growth' | 'Enterprise';
type TenantStatus = 'pending' | 'active' | 'trial' | 'overdue' | 'read_only' | 'rejected';

type Tenant = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  location: string;
  plan: Plan;
  status: TenantStatus;
  unitCount: number;
  monthlyPrice: number;
  createdAt: string;
  trialEndsAt?: string;
  pastDueSince?: string;
  rejectionReason?: string;
};

const planPrices: Record<Plan, number> = {
  Start: 49_000,
  Growth: 149_000,
  Enterprise: 299_000,
};

// This seed store is intentionally platform-level: it contains no resident,
// invoice, payment, or property-ledger information.
const initialTenants: Tenant[] = [
  { id: 'evergreen', name: 'Evergreen Residence', contactName: 'Б. Энхтөр', contactEmail: 'manager@evergreen.mn', location: 'ХУД, Улаанбаатар', plan: 'Growth', status: 'active', unitCount: 436, monthlyPrice: 199_000, createdAt: '2026-04-10' },
  { id: 'blue-sky', name: 'Blue Sky Residence', contactName: 'Д. Мөнхөө', contactEmail: 'admin@bluesky.mn', location: 'БЗД, Улаанбаатар', plan: 'Enterprise', status: 'active', unitCount: 920, monthlyPrice: 690_000, createdAt: '2026-02-18' },
  { id: 'river-garden', name: 'River Garden', contactName: 'Н. Ариунболд', contactEmail: 'office@rivergarden.mn', location: 'ХУД, Улаанбаатар', plan: 'Growth', status: 'trial', unitCount: 280, monthlyPrice: 199_000, createdAt: '2026-07-12', trialEndsAt: '2026-08-11' },
  { id: 'park-view', name: 'Park View', contactName: 'Г. Тэмүүлэн', contactEmail: 'manager@parkview.mn', location: 'СБД, Улаанбаатар', plan: 'Growth', status: 'overdue', unitCount: 72, monthlyPrice: 199_000, createdAt: '2025-11-03', pastDueSince: '2026-06-25' },
  { id: 'khurkhree', name: 'Хүрхрээ хотхон', contactName: 'Б. Гэрэл', contactEmail: 'manager@khurkhree.mn', location: 'БГД, Улаанбаатар', plan: 'Growth', status: 'read_only', unitCount: 196, monthlyPrice: 199_000, createdAt: '2025-12-19', pastDueSince: '2026-05-10' },
  { id: 'request-1', name: 'Цэнгэлдэх хотхон', contactName: 'Д. Энхжин', contactEmail: 'd.enkhjin@tsengeldekh.mn', location: 'ХУД, Улаанбаатар', plan: 'Growth', status: 'pending', unitCount: 312, monthlyPrice: 199_000, createdAt: '2026-07-24' },
  { id: 'request-2', name: 'Нарлаг өргөө СӨХ', contactName: 'Б. Тэмүүлэн', contactEmail: 'b.temuulen@narlag.mn', location: 'БЗД, Улаанбаатар', plan: 'Start', status: 'pending', unitCount: 148, monthlyPrice: 0, createdAt: '2026-07-23' },
  { id: 'request-3', name: 'Khunnu 2222 Residence', contactName: 'С. Марал', contactEmail: 's.maral@khunnu.mn', location: 'ХУД, Улаанбаатар', plan: 'Enterprise', status: 'pending', unitCount: 504, monthlyPrice: 690_000, createdAt: '2026-07-22' },
];

let tenants: Tenant[] = [];

const allowedOrigins = corsAllowlist();
app.use(requestLogger);
app.use(observabilityMiddleware);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  const origin = req.header('origin');
  if (origin && !allowedOrigins.includes(origin)) return sendError(res, 403, 'Origin is not allowed.');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));
app.set('trust proxy', 1);
app.use(requireTls);
app.use(express.json({ limit: '26mb', verify: (req, _res, buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
if (process.env.NODE_ENV !== 'production') app.use('/uploads', express.static(localUploadDirectory));

app.use((req, res, next) => {
  if (req.url === '/api/v1' || req.url.startsWith('/api/v1/')) {
    req.url = `/api${req.url.slice('/api/v1'.length)}`;
    res.setHeader('API-Version', 'v1');
    return next();
  }
  if (req.url.startsWith('/api/')) return sendError(res, 404, 'Unsupported API version. Use /api/v1.');
  next();
});

app.get('/metrics', (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (process.env.NODE_ENV === 'production' && (!token || req.header('authorization') !== `Bearer ${token}`)) return res.status(401).send('Unauthorized');
  res.type('text/plain; version=0.0.4').send(prometheusMetrics());
});

app.get('/api/live/events', requireAuth, (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const unsubscribe = subscribeToLiveEvents(auth, res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

const requireSuperAdmin = [requireAuth, requireRole('super_admin')];

function toTenantSummary(tenant: Tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    contactName: tenant.contactName,
    contactEmail: tenant.contactEmail,
    location: tenant.location,
    plan: tenant.plan,
    status: tenant.status,
    unitCount: tenant.unitCount,
    accessMode: tenant.status === 'read_only' ? 'read_only' : 'full',
    trialEndsAt: tenant.trialEndsAt,
    pastDueSince: tenant.pastDueSince,
    createdAt: tenant.createdAt,
  };
}

function findTenant(id: string, res: Response) {
  const tenant = tenants.find((item) => item.id === id);
  if (!tenant) {
    sendError(res, 404, 'Tenant олдсонгүй.');
    return undefined;
  }
  return tenant;
}

function getTenantId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? (id[0] ?? '') : id;
}

async function persistTenants() {
  await store.setPlatformTenants(tenants);
}

async function persistTenantAccess(tenant: Tenant) {
  await Promise.all([
    persistTenants(),
    prisma.$executeRaw`UPDATE "Tenant" SET "status"=CAST(${tenant.status} AS "TenantAccessStatus"), "updatedAt"=NOW() WHERE "id"=${tenant.id}`,
  ]);
}

const onboardingCheckoutScope = (tenantId: string) => `onboarding-stripe-checkout:${tenantId}`;

async function finalizePaidTenant(checkout: OnboardingCheckout) {
  const tenant = tenants.find((item) => item.id === checkout.tenantId);
  if (!tenant) throw new Error('Workspace request not found.');
  tenant.status = 'active';
  tenant.trialEndsAt = undefined;
  checkout.status = 'paid';
  checkout.paidAt = new Date().toISOString();
  await Promise.all([
    persistTenantAccess(tenant),
    store.setScope(onboardingCheckoutScope(tenant.id), checkout),
    prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, plan: tenant.plan, status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      update: { plan: tenant.plan, status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), canceledAt: null },
    }),
    prisma.user.updateMany({ where: { tenantId: tenant.id, role: 'unassigned' }, data: { role: 'manager', onboardingCompleted: true } }),
  ]);
  return true;
}

async function recordStripePayment(checkout: OnboardingCheckout) {
  const reference = `stripe:${checkout.stripeSessionId}`;
  const payment = await prisma.payment.upsert({
    where: { tenantId_reference: { tenantId: checkout.tenantId, reference } },
    create: { tenantId: checkout.tenantId, reference, method: 'stripe', status: 'confirmed', amount: checkout.amount, paidAt: new Date() },
    update: { status: 'confirmed', amount: checkout.amount, paidAt: new Date() },
  });
  checkout.paymentId = payment.id;
  await finalizePaidTenant(checkout);
  publishLiveEvent({ type: 'payment.updated', tenantId: checkout.tenantId, data: { paymentId: payment.id, status: 'confirmed' } });
}

const requireDomainAccess = (permission: string) => [requireAuth, requirePermission(permission), requireTenant, requireTenantStatus(prisma)];

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  building: string | null;
  apartment: string | null;
  onboardingCompleted: boolean;
  tenant: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    building: user.building,
    apartment: user.apartment,
    onboardingCompleted: user.onboardingCompleted,
    workspace: user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
    } : undefined,
  };
}

function createTokenForUser(user: { id: string; email: string; role: string; tenantId: string | null }) {
  return createAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as AuthTokenPayload['role'],
    tenantId: user.tenantId ?? undefined,
  });
}

type SessionUser = Parameters<typeof createTokenForUser>[0] & Parameters<typeof toAuthUser>[0];
async function sendSession(res: Response, message: string, user: SessionUser, statusCode = 200) {
  try {
    const refresh = await issueRefreshToken(prisma, user);
    res.append('Set-Cookie', refreshCookie(refresh));
  } catch (error) {
    console.error('Unable to persist refresh session:', error);
  }
  return sendSuccess(res, message, { user: toAuthUser(user), token: createTokenForUser(user) }, statusCode);
}

function createOtpCode() {
  return randomInt(100000, 1000000).toString();
}

function hashOtpCode(email: string, code: string) {
  return createHash('sha256')
    .update(`${email.toLowerCase()}:${code}:${process.env.JWT_SECRET ?? ''}`)
    .digest('hex');
}

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  nonce?: string;
};

async function fetchGoogle(url: string, init?: RequestInit) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await fetch(url, init); }
    catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw new Error(lastError instanceof Error && lastError.cause instanceof Error ? `Google OAuth холболт амжилтгүй: ${lastError.cause.message}` : 'Google OAuth сервертэй холбогдож чадсангүй.');
}

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not configured.');
  }
  return { clientId, clientSecret, redirectUri };
}

function slugFromText(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
}

async function exchangeGoogleCode(code: string, redirectUri: string, verifier: string) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const response = await fetchGoogle('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const token = await response.json() as GoogleTokenResponse;
  if (!response.ok || !token.id_token) {
    throw new Error(token.error_description ?? token.error ?? 'Google OAuth token exchange failed.');
  }
  return token.id_token;
}

async function verifyGoogleIdToken(idToken: string, expectedNonce: string) {
  const { clientId } = getGoogleOAuthConfig();
  const response = await fetchGoogle(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const profile = await response.json() as GoogleTokenInfo;
  if (!response.ok || profile.aud !== clientId || profile.nonce !== expectedNonce || !profile.sub || !profile.email || profile.email_verified !== 'true') {
    throw new Error('Google account could not be verified.');
  }
  return profile;
}

app.get('/', (_req, res) => {
  const frontendUrl = getFrontendUrl();

  if (frontendUrl) {
    return res.redirect(302, frontendUrl);
  }

  return sendSuccess(res, 'HomeLink API ажиллаж байна.', {
    status: 'ok',
    service: 'HomeLink API',
    health: '/health',
  });
});

app.get('/health', async (_req, res) => {
  try {
    const redisClient = await ensureRedisConnection();
    await Promise.all([prisma.$queryRaw`SELECT 1`, redisClient.ping()]);
    return sendSuccess(res, 'Service is healthy.', {
      status: 'ok',
      service: 'platform-api',
      postgres: 'connected',
      redis: getRedisMode() === 'redis' ? 'connected' : 'in-memory-fallback',
    });
  } catch {
    return sendError(res, 503, 'Service dependencies are unavailable.');
  }
});

app.post('/api/auth/register', authRateLimits.register, async (req, res) => {
  const parsed = parseBody(registerSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  try {
    if (await isBreachedPassword(parsed.data.password)) return sendError(res, 400, getValidationMessage({ code: 'VALIDATION_ERROR', message: 'Validation failed.', details: [{ path: 'password', message: 'This password appears in known breach data.' }] }));
    const email = parsed.data.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, tenantId: true } });
    if (existingUser) {
      const pendingInvite = parsed.data.inviteToken ? await prisma.invite.findFirst({
        where: { email, status: 'pending', expiresAt: { gt: new Date() }, tokenHash: hashSensitiveToken(parsed.data.inviteToken) },
        select: { id: true },
      }) : null;
      if (!pendingInvite || existingUser.role !== 'unassigned' || existingUser.tenantId) return sendError(res, 409, 'An account with this email already exists.');
      const passwordHash = await hashPassword(parsed.data.password);
      const recoveredUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash, fullName: parsed.data.fullName, phone: parsed.data.phone },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });
      return sendSession(res, 'Invitation account completed successfully.', recoveredUser);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: parsed.data.fullName,
          phone: parsed.data.phone,
          role: 'unassigned',
          tenantId: null,
          building: parsed.data.building,
          apartment: parsed.data.apartment,
          onboardingCompleted: false,
        },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });

    return sendSession(res, 'Account registered successfully.', user, 201);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return sendError(res, 409, 'An account with this email already exists.');
    }
    return sendError(res, 500, 'Unable to register the account.');
  }
});

app.post('/api/auth/login', authRateLimits.login, async (req, res) => {
  const parsed = parseBody(loginSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  try {
    const penalty = await currentLoginPenalty(parsed.data.email);
    if (penalty) { res.setHeader('Retry-After', penalty); return sendError(res, 429, 'Account is temporarily locked.'); }
    let user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) {
      const retryAfter = await recordLoginFailure(parsed.data.email);
      if (retryAfter) res.setHeader('Retry-After', retryAfter);
      return sendError(res, 401, 'Email or password is incorrect.');
    }
    if (!user.isActive) return sendError(res, 403, 'This account has been disabled.');
    if (user.role === 'unassigned' || user.role === 'resident') {
      const activeMembership = await prisma.residentProfile.findFirst({ where: { userId: user.id, status: 'active' }, include: { tenant: { select: { id: true, name: true, slug: true } } }, orderBy: { updatedAt: 'desc' } });
      if (activeMembership && (user.role !== 'resident' || user.tenantId !== activeMembership.tenantId)) {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: 'resident', tenantId: activeMembership.tenantId, onboardingCompleted: true }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
      }
    }
    await clearLoginFailures(parsed.data.email).catch(() => undefined);
    if (user.tenantId) {
      await writeAudit(prisma, req, { tenantId: user.tenantId, actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id })
        .catch((error) => console.error('Unable to write login audit:', error));
    }

    return sendSession(res, 'Login successful.', user);
  } catch (error) {
    console.error('Login failed:', error);
    return sendError(res, 500, 'Unable to log in at this time.');
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const current = readRefreshCookie(req.header('cookie'));
  if (!current) return sendError(res, 401, 'Refresh token is required.');
  try {
    const rotated = await rotateRefreshToken(prisma, current);
    if (!rotated) { res.setHeader('Set-Cookie', refreshCookie('', true)); return sendError(res, 401, 'Refresh token is invalid or reused.'); }
    const user = await prisma.user.findUnique({ where: { id: rotated.userId }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
    if (!user?.isActive) { await revokeRefreshToken(prisma, rotated.token); res.setHeader('Set-Cookie', refreshCookie('', true)); return sendError(res, 401, 'Account is unavailable.'); }
    res.setHeader('Set-Cookie', refreshCookie(rotated.token));
    return sendSuccess(res, 'Session refreshed.', { user: toAuthUser(user), token: createTokenForUser(user) });
  } catch { return sendError(res, 401, 'Unable to refresh session.'); }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = readRefreshCookie(req.header('cookie'));
  if (token) await revokeRefreshToken(prisma, token);
  res.setHeader('Set-Cookie', refreshCookie('', true));
  return sendSuccess(res, 'Logged out.', { revoked: true });
});

app.get('/api/auth/sessions', requireAuth, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  return sendSuccess(res, 'Active sessions retrieved.', await listSessions(prisma, auth.sub));
});

app.delete('/api/auth/sessions/:id', requireAuth, async (req, res) => {
  const params = parseParams(idParamsSchema, req.params);
  if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
  const auth = res.locals.auth as AuthTokenPayload;
  const familyId = params.data.id;
  const revoked = await revokeSession(prisma, auth.sub, familyId);
  return revoked ? sendSuccess(res, 'Session revoked.', { familyId }) : sendError(res, 404, 'Session not found.');
});

app.post('/api/auth/logout-all', requireAuth, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const revoked = await revokeAllSessions(prisma, auth.sub);
  res.setHeader('Set-Cookie', refreshCookie('', true));
  return sendSuccess(res, 'All sessions revoked.', { revoked });
});

app.get('/api/auth/google/start', (req, res) => {
  try {
    const query = parseQuery(googleStartQuerySchema, req.query);
    if ('error' in query) return sendError(res, 400, getValidationMessage(query.error));
    const { clientId, redirectUri } = getGoogleOAuthConfig();
    const requestedRedirectUri = query.data.redirectUri ?? redirectUri;
    if (requestedRedirectUri !== redirectUri) {
      return sendError(res, 400, 'Google redirect URI does not match server configuration.');
    }
    const flow = createOAuthFlow(requestedRedirectUri);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: requestedRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: flow.challenge,
      code_challenge_method: 'S256',
    });
    res.setHeader('Set-Cookie', oauthCookie(flow.cookie));
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Google OAuth is not configured.');
  }
});

app.post('/api/auth/google', async (req, res) => {
  const parsed = parseBody(googleOAuthSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  const flow = verifyOAuthFlow(readOAuthCookie(req.header('cookie')), parsed.data.state, parsed.data.redirectUri);
  res.append('Set-Cookie', oauthCookie('', true));
  if (!flow) return sendError(res, 401, 'OAuth state is invalid or expired.');

  try {
    const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (configuredRedirectUri && parsed.data.redirectUri !== configuredRedirectUri) {
      return sendError(res, 400, 'Google redirect URI does not match server configuration.');
    }

    const idToken = await exchangeGoogleCode(parsed.data.code, parsed.data.redirectUri, flow.verifier);
    const profile = await verifyGoogleIdToken(idToken, flow.nonce);
    const email = profile.email!.toLowerCase();
    const fullName = profile.name?.trim() || email.split('@')[0] || 'Google user';

    const linkedUser = await prisma.user.findFirst({
      where: { oauthProvider: 'google', oauthSubject: profile.sub },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (linkedUser) {
      if (!linkedUser.isActive) return sendError(res, 403, 'This account has been disabled.');
      return sendSession(res, 'Google login successful.', linkedUser);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (existingUser) {
      const linkIssue = oauthLinkIssue(existingUser, 'google', profile.sub!);
      if (linkIssue) return sendError(res, linkIssue.status, linkIssue.message);
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          oauthProvider: 'google',
          oauthSubject: profile.sub,
          avatarUrl: profile.picture,
          emailVerifiedAt: new Date(),
        },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });
      return sendSession(res, 'Google account linked successfully.', user);
    }

    const passwordHash = await hashPassword(randomUUID());
    const user = await prisma.$transaction(async (transaction) => {
      return transaction.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: newGoogleUserRole,
          tenantId: null,
          oauthProvider: 'google',
          oauthSubject: profile.sub,
          avatarUrl: profile.picture,
          emailVerifiedAt: new Date(),
          onboardingCompleted: !newGoogleUserNeedsOnboarding,
        },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });
    });

    return sendSession(res, 'Google account created successfully.', user, 201);
  } catch (error) {
    if (isUniqueConflict(error)) return sendError(res, 409, 'This email or Google account is already in use.');
    return sendError(res, 401, error instanceof Error ? error.message : 'Google login failed.');
  }
});

app.post('/api/auth/forgot-password', authRateLimits.forgotPassword, async (req, res) => {
  const parsed = parseBody(forgotPasswordSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  const email = parsed.data.email.toLowerCase();
  const responseData: { email: string; expiresInMinutes: number; resetCode?: string } = { email, expiresInMinutes: 10 };

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true, phone: true } });
    if (user?.isActive) {
      const code = createOtpCode();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCodeHash: hashOtpCode(email, code),
          passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          passwordResetVerifiedAt: null,
        },
      });
      await sendPasswordResetOtp({ email, phone: user.phone, code });
      if (demoOtpEnabled()) responseData.resetCode = code;
    }

    return sendSuccess(res, 'If the account exists, a password reset code has been sent.', responseData);
  } catch {
    return sendError(res, 500, 'Unable to start password recovery.');
  }
});

app.post('/api/auth/verify-otp', authRateLimits.verifyOtp, async (req, res) => {
  const parsed = parseBody(verifyOtpSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  try {
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true, passwordResetCodeHash: true, passwordResetExpiresAt: true },
    });
    const codeHash = hashOtpCode(email, parsed.data.code);
    if (
      !user
      || !user.isActive
      || !user.passwordResetCodeHash
      || user.passwordResetCodeHash !== codeHash
      || !user.passwordResetExpiresAt
      || user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return sendError(res, 400, 'The reset code is invalid or has expired.');
    }

    const resetToken = createPasswordResetToken({ sub: user.id, email: user.email });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetVerifiedAt: new Date(), passwordResetTokenHash: hashSensitiveToken(resetToken), passwordResetTokenExpiresAt: new Date(Date.now() + 10 * 60_000) },
    });

    return sendSuccess(res, 'Reset code verified successfully.', { resetToken });
  } catch {
    return sendError(res, 500, 'Unable to verify the reset code.');
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const parsed = parseBody(resetPasswordSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));

  try {
    const resetPayload = verifyPasswordResetToken(parsed.data.resetToken);
    if (!resetPayload) return sendError(res, 401, 'The password reset session is invalid or has expired.');
    if (await isBreachedPassword(parsed.data.password)) return sendError(res, 400, getValidationMessage({ code: 'VALIDATION_ERROR', message: 'Validation failed.', details: [{ path: 'password', message: 'This password appears in known breach data.' }] }));

    const user = await prisma.user.findUnique({
      where: { id: resetPayload.sub },
      select: { id: true, email: true, isActive: true, passwordResetVerifiedAt: true, passwordResetTokenHash: true, passwordResetTokenExpiresAt: true },
    });
    if (!user || !user.isActive || user.email !== resetPayload.email || !user.passwordResetVerifiedAt || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now() || !matchesSensitiveToken(parsed.data.resetToken, user.passwordResetTokenHash)) {
      return sendError(res, 401, 'The password reset session is invalid or has expired.');
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetCodeHash: null,
        passwordResetExpiresAt: null,
        passwordResetVerifiedAt: null,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return sendSuccess(res, 'Password reset successfully.', { changed: true });
  } catch {
    return sendError(res, 500, 'Unable to reset the password.');
  }
});

app.get('/api/auth/me', requireAuth, async (_req, res) => {
  try {
    const auth = res.locals.auth as AuthTokenPayload;
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) return sendError(res, 404, 'User account not found.');
    if (!user.isActive) return sendError(res, 403, 'This account has been disabled.');
    return sendSuccess(res, 'Authenticated user retrieved successfully.', toAuthUser(user));
  } catch {
    return sendError(res, 500, 'Unable to retrieve the authenticated user.');
  }
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const parsed = parseBody(profileUpdateSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  const user = await prisma.user.update({ where: { id: auth.sub }, data: { fullName: parsed.data.fullName, ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}) }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
  return sendSuccess(res, 'Profile updated.', toAuthUser(user));
});

function registerDomainCrud(path: string, scope: string) {
  const access = requireDomainAccess(scope);
  const adapter = getDomainPrismaAdapter(scope);
  const context = (res: Response) => {
    const tenantId = (res.locals.auth as AuthTokenPayload).tenantId!;
    return { tenantId, storageScope: `${tenantId}:${scope}` };
  };
  app.get(path, ...access, async (req, res) => {
    const query = parseQuery(paginationQuerySchema, req.query);
    if ('error' in query) return sendError(res, 400, getValidationMessage(query.error));
    const { tenantId, storageScope } = context(res);
    const data = scope === 'manager-buildings'
      ? (await prisma.building.findMany({
          where: { tenantId },
          include: { entrances: { orderBy: { name: 'asc' }, include: { floors: { orderBy: { number: 'asc' }, include: { units: { where: { residentProfiles: { some: { status: 'active' } } }, orderBy: { number: 'asc' }, include: { residentProfiles: { where: { status: 'active' }, take: 1, include: { user: { select: { fullName: true } } } } } } } } } } },
          orderBy: { code: 'asc' },
        })).map((building) => ({
          id: building.id,
          tenantId: building.tenantId,
          name: building.name,
          code: building.code,
          entrances: building.entrances.length,
          floors: Math.max(0, ...building.entrances.map((entrance) => entrance.floors.length)),
          apartments: building.entrances.reduce((sum, entrance) => sum + entrance.floors.reduce((floorSum, floor) => floorSum + floor.units.length, 0), 0),
          detail: building.address ?? '',
          status: 'Идэвхтэй',
          entranceDetails: building.entrances.map((entrance) => ({
            id: entrance.id,
            name: entrance.name,
            floors: entrance.floors.map((floor) => ({ id: floor.id, number: floor.number, units: floor.units.map((unit) => ({ id: unit.id, number: unit.number, status: unit.status, resident: unit.residentProfiles[0]?.user.fullName ?? '' })) })),
          })),
        }))
      : adapter ? await adapter.list(prisma, tenantId) : await store.getScope(storageScope);
    if (data === undefined) return sendError(res, 404, 'Resource not found.');
    if (!Array.isArray(data)) return sendSuccess(res, 'Resource retrieved.', data);
    let items: unknown[] = data.filter((item) => typeof item === 'object' && item !== null && (item as { tenantId?: string }).tenantId === tenantId);
    if (query.data.q) items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(query.data.q!.toLowerCase()));
    if (query.data.sortBy) items.sort((a, b) => String((a as Record<string, unknown>)[query.data.sortBy!] ?? '').localeCompare(String((b as Record<string, unknown>)[query.data.sortBy!] ?? '')) * (query.data.sortOrder === 'desc' ? -1 : 1));
    const page = query.data.page ?? 1;
    const limit = query.data.limit ?? 50;
    return sendSuccess(res, 'Resource retrieved.', items.slice((page - 1) * limit, page * limit));
  });
  app.put(path, ...access, async (req, res) => {
    const parsed = parseBody(statePayloadSchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    const { tenantId, storageScope } = context(res);
    const data = enforceTenantScope(parsed.data.data, tenantId);
    try { await validateEmbeddedUploads(data); } catch (error) { return sendError(res, 400, error instanceof Error ? error.message : 'Invalid attachment.'); }
    if (adapter) {
      const rows = Array.isArray(data) ? data : [data];
      await adapter.replace(prisma, tenantId, rows);
      if (scope === 'manager-buildings') {
        for (const value of rows) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
          const row = value as Record<string, unknown>;
          const buildingId = String(row.id ?? '');
          const entranceCount = Math.max(0, Number(row.entrances) || 0);
          const floorCount = Math.max(0, Number(row.floors) || 0);
          const apartmentCount = Math.max(0, Number(row.apartments) || 0);
          if (!buildingId || !entranceCount || !floorCount) continue;

          const floors: Array<{ entrance: number; floor: number; id: string }> = [];
          for (let entrance = 1; entrance <= entranceCount; entrance += 1) {
            const entranceId = `entrance-${buildingId}-${entrance}`;
            await prisma.entrance.upsert({
              where: { buildingId_name: { buildingId, name: String(entrance) } },
              update: {},
              create: { id: entranceId, tenantId, buildingId, name: String(entrance) },
            });
            const savedEntrance = await prisma.entrance.findUniqueOrThrow({ where: { buildingId_name: { buildingId, name: String(entrance) } } });
            for (let floor = 1; floor <= floorCount; floor += 1) {
              const floorId = `floor-${savedEntrance.id}-${floor}`;
              const savedFloor = await prisma.floor.upsert({
                where: { entranceId_number: { entranceId: savedEntrance.id, number: floor } },
                update: {},
                create: { id: floorId, tenantId, entranceId: savedEntrance.id, number: floor },
              });
              floors.push({ entrance, floor, id: savedFloor.id });
            }
          }

          for (let index = 0; index < apartmentCount; index += 1) {
            const target = floors[index % floors.length];
            const position = Math.floor(index / floors.length) + 1;
            const number = `${target.floor}${String(position).padStart(2, '0')}`;
            await prisma.unit.upsert({
              where: { floorId_number: { floorId: target.id, number } },
              update: {},
              create: { id: `unit-${buildingId}-${target.entrance}-${number}`, tenantId, floorId: target.id, number },
            });
          }
        }
      }
      return sendSuccess(res, 'Resource replaced.', await adapter.list(prisma, tenantId));
    }
    await store.setScope(storageScope, data);
    return sendSuccess(res, 'Resource replaced.', data);
  });
  app.post(path, ...access, async (req, res) => {
    const parsed = parseBody(statePayloadSchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    if (typeof parsed.data.data !== 'object' || parsed.data.data === null || Array.isArray(parsed.data.data)) return sendError(res, 400, getValidationMessage({ code: 'VALIDATION_ERROR', message: 'Validation failed.', details: [{ path: 'data', message: 'Must be an object.' }] }));
    const { tenantId, storageScope } = context(res);
    const current = adapter ? await adapter.list(prisma, tenantId) : await store.getScope<unknown[]>(storageScope) ?? [];
    if (!Array.isArray(current)) return sendError(res, 409, 'Resource is not a collection.');
    const itemData = parsed.data.data as Record<string, unknown>;
    const item = { ...itemData, id: String(itemData.id ?? randomUUID()), tenantId };
    try { await validateEmbeddedUploads(item); } catch (error) { return sendError(res, 400, error instanceof Error ? error.message : 'Invalid attachment.'); }
    const next = [...current, item];
    if (adapter) return sendSuccess(res, 'Resource created.', (await adapter.replace(prisma, tenantId, next)).find((entry) => belongsToTenant(entry, tenantId, item.id)) ?? item, 201);
    await store.setScope(storageScope, next);
    return sendSuccess(res, 'Resource created.', item, 201);
  });
  app.patch(`${path}/:id`, ...access, async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    const parsed = parseBody(statePayloadSchema, req.body);
    if ('error' in params || 'error' in parsed) return sendError(res, 400, getValidationMessage('error' in params ? params.error : parsed.error));
    if (typeof parsed.data.data !== 'object' || parsed.data.data === null || Array.isArray(parsed.data.data)) return sendError(res, 400, getValidationMessage({ code: 'VALIDATION_ERROR', message: 'Validation failed.', details: [{ path: 'data', message: 'Must be an object.' }] }));
    const patchData = parsed.data.data as Record<string, unknown>;
    try { await validateEmbeddedUploads(patchData); } catch (error) { return sendError(res, 400, error instanceof Error ? error.message : 'Invalid attachment.'); }
    const { tenantId, storageScope } = context(res);
    const current = adapter ? await adapter.list(prisma, tenantId) : await store.getScope<unknown[]>(storageScope);
    if (!Array.isArray(current)) return sendError(res, 409, 'Resource is not a collection.');
    const id = params.data.id;
    if (!findTenantEntity(current, tenantId, id)) return sendError(res, 404, 'Resource not found.');
    let updated: unknown;
    const next = current.map((item) => belongsToTenant(item, tenantId, id) ? (updated = { ...item, ...patchData, id, tenantId }, updated) : item);
    if (!updated) return sendError(res, 404, 'Resource not found.');
    if (adapter) return sendSuccess(res, 'Resource updated.', (await adapter.replace(prisma, tenantId, next)).find((entry) => belongsToTenant(entry, tenantId, id)) ?? updated);
    await store.setScope(storageScope, next);
    return sendSuccess(res, 'Resource updated.', updated);
  });
  app.delete(`${path}/:id`, ...access, async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
    const { tenantId, storageScope } = context(res);
    const current = adapter ? await adapter.list(prisma, tenantId) : await store.getScope<unknown[]>(storageScope);
    if (!Array.isArray(current)) return sendError(res, 409, 'Resource is not a collection.');
    if (!findTenantEntity(current, tenantId, params.data.id)) return sendError(res, 404, 'Resource not found.');
    if (scope === 'manager-buildings') {
      await prisma.building.deleteMany({ where: { id: params.data.id, tenantId } });
      return sendSuccess(res, 'Resource deleted.', { id: params.data.id });
    }
    const next = current.filter((item) => !belongsToTenant(item, tenantId, params.data.id));
    if (adapter) { await adapter.replace(prisma, tenantId, next); return sendSuccess(res, 'Resource deleted.', { id: params.data.id }); }
    await store.setScope(storageScope, next);
    return sendSuccess(res, 'Resource deleted.', { id: params.data.id });
  });
}

app.post('/api/invoices/generate', ...requireDomainAccess('billing-invoices'), async (req, res) => {
  const parsed = parseBody(invoiceGenerationSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  try {
    const tenantId = (res.locals.auth as AuthTokenPayload).tenantId!;
    const invoiceIds = await generateInvoices(prisma, tenantId, parsed.data);
    await writeAudit(prisma, req, { tenantId, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'billing.invoices_generated', entityType: 'Invoice', metadata: { count: invoiceIds.length } });
    return sendSuccess(res, 'Invoices generated atomically.', { invoiceIds }, 201);
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Invoice generation failed.'); }
});

app.post('/api/jobs/invoice-run', ...requireDomainAccess('billing-invoices'), async (req, res) => {
  const parsed = parseBody(invoiceGenerationSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try { const jobId = await enqueueInvoiceRun(auth.tenantId!, parsed.data); await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'billing.invoice_run_queued', entityType: 'BackgroundJob', entityId: jobId }); return sendSuccess(res, 'Invoice run queued.', { jobId }, 202); }
  catch (error) { return sendError(res, 503, error instanceof Error ? error.message : 'Unable to queue invoice run.'); }
});

app.get('/api/jobs/:id', ...requireDomainAccess('billing-invoices'), async (req, res) => {
  const params = parseParams(idParamsSchema, req.params); if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
  const auth = res.locals.auth as AuthTokenPayload; const status = await getBackgroundJobStatus(params.data.id, auth.tenantId!);
  return status ? sendSuccess(res, 'Job status retrieved.', status) : sendError(res, 404, 'Job not found.');
});

(['approve', 'send', 'void'] as const).forEach((action) => {
  app.post(`/api/invoices/:id/${action}`, ...requireDomainAccess('billing-invoices'), async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
    const auth = res.locals.auth as AuthTokenPayload;
    try {
      const status = await transitionInvoice(prisma, auth.tenantId!, params.data.id, action);
      if (action === 'send') {
        const recipient = await prisma.invoice.findFirst({ where: { id: params.data.id, tenantId: auth.tenantId }, select: { residentProfile: { select: { user: { select: { id: true, email: true, phone: true } } } } } });
        const user = recipient?.residentProfile?.user;
        if (user) {
          const lang = (req.headers['accept-language']?.startsWith('en') ? 'en' : 'mn') as 'en' | 'mn';
          const t = renderTemplate('invoice_sent', lang);
          await enqueueNotifications([
            createNotificationJob({ channel: 'in_app', tenantId: auth.tenantId!, userId: user.id, title: t.title, body: t.body, route: '/resident/payments', type: 'billing' }),
            createNotificationJob({ channel: 'email', tenantId: auth.tenantId!, userId: user.id, to: user.email, title: t.title, body: t.body, type: 'billing' }),
            ...(user.phone ? [createNotificationJob({ channel: 'sms' as const, tenantId: auth.tenantId!, userId: user.id, to: user.phone, title: t.title, body: t.body, type: 'billing' })] : []),
          ]);
        }
      }
      triggerWebhook(prisma, store, auth.tenantId!, `invoice.${action}`, { invoiceId: params.data.id, status });
      await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: `billing.invoice_${action}`, entityType: 'Invoice', entityId: params.data.id, metadata: { status } });
      return sendSuccess(res, `Invoice ${status}.`, { id: params.data.id, status });
    } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Invoice transition failed.'); }
  });
});

app.post('/api/payments/allocate', authRateLimits.paymentWebhook, ...requireDomainAccess('payment-records'), async (req, res) => {
  const parsed = parseBody(paymentAllocationSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  try {
    const tenantId = (res.locals.auth as AuthTokenPayload).tenantId!;
    const paymentId = await allocatePayment(prisma, tenantId, parsed.data);
    publishLiveEvent({ type: 'payment.updated', tenantId, data: { paymentId, status: 'confirmed' } });
    triggerWebhook(prisma, store, tenantId, 'payment.allocated', { paymentId, reference: parsed.data.reference, amount: parsed.data.amount });
    await writeAudit(prisma, req, { tenantId, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'payment.allocated', entityType: 'Payment', entityId: paymentId, metadata: { reference: parsed.data.reference, amount: parsed.data.amount } });
    return sendSuccess(res, 'Payment allocated atomically.', { paymentId }, 201);
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Payment allocation failed.'); }
});

app.post('/api/payments/qpay/invoices', ...requireDomainAccess('payment-records'), async (req, res) => {
  const parsed = parseBody(qpayInvoiceCreateSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; number: string; status: string; totalAmount: unknown; outstanding: unknown }>>`
      SELECT i."id",i."number",i."status"::text AS "status",i."totalAmount",
        i."totalAmount"-COALESCE(SUM(pa."amount"),0) AS "outstanding"
      FROM "Invoice" i
      LEFT JOIN "PaymentAllocation" pa ON pa."invoiceId"=i."id" AND pa."tenantId"=${auth.tenantId!}
      WHERE i."id"=${parsed.data.invoiceId} AND i."tenantId"=${auth.tenantId!}
      GROUP BY i."id",i."number",i."status",i."totalAmount"`;
    const invoice = rows[0];
    if (!invoice) return sendError(res, 404, 'Invoice not found.');
    if (!['approved', 'sent', 'overdue'].includes(invoice.status)) return sendError(res, 409, 'Invoice is not payable.');
    const amount = Math.round(Number(invoice.outstanding) * 100) / 100;
    if (amount <= 0) return sendError(res, 409, 'Invoice is already paid.');
    const scope = `${auth.tenantId}:qpay-invoices`;
    const cached = await store.getScope<StoredQpayInvoice[]>(scope) ?? [];
    const existing = cached.find((item) => item.invoiceId === invoice.id && item.amount === amount);
    if (existing) return sendSuccess(res, 'QPay invoice retrieved.', existing);
    const senderInvoiceNo = `HL-${auth.tenantId}-${invoice.id}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    const qpay = await createQpayInvoice({ senderInvoiceNo, receiverCode: auth.tenantId!, description: `HomeLink invoice ${invoice.number}`, amount });
    const stored: StoredQpayInvoice = { invoiceId: invoice.id, senderInvoiceNo, amount, qpayInvoiceId: qpay.invoiceId, qrText: qpay.qrText, qrImage: qpay.qrImage, shortUrl: qpay.shortUrl, deeplinks: qpay.deeplinks, createdAt: new Date().toISOString() };
    await store.setScope(scope, [...cached.filter((item) => item.invoiceId !== invoice.id), stored].slice(-500));
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'payment.qpay_invoice_created', entityType: 'Invoice', entityId: invoice.id, metadata: { qpayInvoiceId: stored.qpayInvoiceId, amount } });
    return sendSuccess(res, 'QPay invoice created.', stored, 201);
  } catch (error) { return sendError(res, 503, error instanceof Error ? error.message : 'QPay invoice creation failed.'); }
});

const moneyMnt = (value: unknown) => `₮${Math.round(Number(value ?? 0)).toLocaleString('en-US')}`;

app.get('/api/resident/billing-summary', requireAuth, requireTenant, requireRole('resident'), async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const profile = await prisma.residentProfile.findFirst({ where: { userId: auth.sub, tenantId: auth.tenantId!, status: 'active' } });
  if (!profile) return sendError(res, 404, 'Active resident membership was not found.');
  const invoice = await prisma.invoice.findFirst({ where: { tenantId: auth.tenantId!, status: { in: ['sent', 'overdue', 'approved'] }, OR: [{ residentProfileId: profile.id }, ...(profile.unitId ? [{ unitId: profile.unitId }] : [])] }, include: { lines: { orderBy: { createdAt: 'asc' } }, allocations: true }, orderBy: { dueAt: 'desc' } });
  const outstanding = invoice ? Number(invoice.totalAmount) - invoice.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0) : 0;
  const [payments, meterReading, requests, announcements] = await Promise.all([
    prisma.payment.findMany({ where: { tenantId: auth.tenantId!, residentProfileId: profile.id, status: 'confirmed' }, orderBy: { paidAt: 'desc' }, take: 6 }),
    profile.unitId ? prisma.meterReading.findFirst({ where: { tenantId: auth.tenantId!, meter: { unitId: profile.unitId, type: 'water' } }, orderBy: { readAt: 'desc' } }) : null,
    prisma.maintenanceRequest.findMany({ where: { tenantId: auth.tenantId!, requesterProfileId: profile.id }, orderBy: { updatedAt: 'desc' }, take: 10 }),
    prisma.announcement.findMany({ where: { tenantId: auth.tenantId!, publishedAt: { not: null, lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { publishedAt: 'desc' }, take: 10 }),
  ]);
  return sendSuccess(res, 'Resident billing summary retrieved.', {
    currentInvoice: invoice ? {
      id: invoice.id,
      number: invoice.number,
      amount: moneyMnt(outstanding),
      due: invoice.dueAt.toISOString().slice(5, 10).replace('-', '.'),
      lines: invoice.lines.map((line) => ({ label: line.description, detail: `${Number(line.quantity)} × ${moneyMnt(line.unitPrice)}`, amount: moneyMnt(line.amount), tone: Number(line.amount) < 0 ? 'success' : undefined })),
    } : null,
    payments: payments.map((payment) => ({ id: payment.id, month: payment.paidAt?.toISOString().slice(0, 7) ?? payment.createdAt.toISOString().slice(0, 7), paidAt: (payment.paidAt ?? payment.createdAt).toISOString().slice(5, 16).replace('T', ' · '), amount: moneyMnt(payment.amount), method: payment.method, reference: payment.reference, receipt: `Баримт ${payment.reference}` })),
    meter: meterReading ? { value: `${Number(meterReading.currentValue)} м³`, status: meterReading.status, readAt: meterReading.readAt.toISOString().slice(5, 10).replace('-', '.') } : null,
    tickets: requests.map((request) => ({ id: request.id, displayId: `#${request.id.slice(-6).toUpperCase()}`, title: request.title, description: request.description, status: request.status, tone: request.status === 'resolved' || request.status === 'closed' ? 'success' : 'info', date: request.updatedAt.toISOString().slice(0, 10) })),
    notices: announcements.map((notice) => ({ id: notice.id, title: notice.title, audience: notice.audience, date: (notice.publishedAt ?? notice.createdAt).toISOString().slice(0, 10), body: notice.body, read: false })),
  });
});

app.post('/api/resident/maintenance-requests', requireAuth, requireTenant, requireRole('resident'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const title = String(req.body?.title ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!title || title.length > 160 || description.length > 2000) return sendError(res, 400, 'Invalid maintenance request.');
  const profile = await prisma.residentProfile.findFirst({ where: { userId: auth.sub, tenantId: auth.tenantId!, status: 'active' }, select: { id: true, unitId: true, user: { select: { fullName: true, email: true } }, unit: { select: { number: true } } } });
  if (!profile) return sendError(res, 404, 'Active resident membership was not found.');
  const request = await prisma.maintenanceRequest.create({ data: { tenantId: auth.tenantId!, requesterProfileId: profile.id, unitId: profile.unitId, title, description: description || 'Засварын хүсэлт' } });
  const managers = await prisma.user.findMany({ where: { tenantId: auth.tenantId!, role: 'manager', isActive: true }, select: { id: true } });
  for (const manager of managers) {
    const notification = await prisma.notification.create({ data: { tenantId: auth.tenantId!, userId: manager.id, type: 'maintenance', title: 'Шинэ засварын хүсэлт', body: `${profile.user.fullName || profile.user.email}${profile.unit?.number ? ` · ${profile.unit.number} тоот` : ''}: ${title}`, route: `/manager/maintenance?request=${request.id}` } });
    publishLiveEvent({ type: 'notification.created', tenantId: auth.tenantId!, userId: manager.id, data: { id: notification.id, title: notification.title, body: notification.body, route: notification.route, type: 'maintenance' } });
  }
  return sendSuccess(res, 'Maintenance request created.', { id: request.id, displayId: `#${request.id.slice(-6).toUpperCase()}`, title: request.title, description: request.description, status: request.status, tone: 'info', date: request.updatedAt.toISOString().slice(0, 10) }, 201);
});

app.delete('/api/resident/maintenance-requests/:id', requireAuth, requireTenant, requireRole('resident'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const profile = await prisma.residentProfile.findFirst({ where: { userId: auth.sub, tenantId: auth.tenantId!, status: 'active' }, select: { id: true } });
  if (!profile) return sendError(res, 404, 'Active resident membership was not found.');
  const deleted = await prisma.maintenanceRequest.deleteMany({ where: { id: requestId, tenantId: auth.tenantId!, requesterProfileId: profile.id } });
  if (!deleted.count) return sendError(res, 404, 'Maintenance request was not found.');
  return sendSuccess(res, 'Maintenance request deleted.', { id: requestId });
});

app.post('/api/webhooks/payments/:provider', authRateLimits.paymentWebhook, async (req, res) => {
  const params = parseParams(paymentWebhookParamsSchema, req.params);
  const headers = paymentWebhookHeadersSchema.safeParse({ signature: req.header('x-webhook-signature'), idempotencyKey: req.header('idempotency-key') });
  const body = parseBody(paymentWebhookSchema, req.body);
  if ('error' in params || !headers.success || 'error' in body) return sendError(res, 400, 'Invalid payment webhook.');
  let secret: string;
  try { secret = getSecret(`${params.data.provider.toUpperCase()}_WEBHOOK_SECRET`); } catch { return sendError(res, 503, 'Payment webhook is not configured.'); }
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
  if (!verifyWebhookSignature(rawBody, headers.data.signature, secret)) return sendError(res, 401, 'Invalid webhook signature.');
  try {
    const paymentId = await allocatePayment(prisma, body.data.tenantId, { ...body.data, reference: `${params.data.provider}:${headers.data.idempotencyKey}`, method: params.data.provider });
    publishLiveEvent({ type: 'payment.updated', tenantId: body.data.tenantId, data: { paymentId, status: 'confirmed' } });
    triggerWebhook(prisma, store, body.data.tenantId, 'payment.allocated', { paymentId, reference: `${params.data.provider}:${headers.data.idempotencyKey}`, amount: body.data.amount });
    await writeAudit(prisma, req, { tenantId: body.data.tenantId, action: `payment.${params.data.provider}_webhook`, entityType: 'Payment', entityId: paymentId, metadata: { externalReference: body.data.externalReference, idempotencyKey: headers.data.idempotencyKey } });
    return sendSuccess(res, 'Payment webhook processed.', { paymentId });
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Payment webhook failed.'); }
});

app.post('/api/bank-statements/import', ...requireDomainAccess('payment-statements'), async (req, res) => {
  const parsed = parseBody(bankStatementImportSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const rows = parseBankStatementCsv(parsed.data.csv);
    const preview = await reconcileBankStatement(prisma, auth.tenantId!, rows);
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'payment.statement_imported', entityType: 'BankStatement', metadata: { rows: rows.length } });
    return sendSuccess(res, 'Bank statement parsed and reconciled.', { rows: preview });
  } catch (error) { return sendError(res, 400, error instanceof Error ? error.message : 'Statement import failed.'); }
});

app.post('/api/notifications/queue', ...requireDomainAccess('manager-residents'), async (req, res) => {
  const parsed = parseBody(notificationQueueSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  const user = await prisma.user.findFirst({ where: { id: parsed.data.userId, tenantId: auth.tenantId }, select: { id: true, email: true, phone: true } });
  if (!user) return sendError(res, 404, 'Notification recipient not found.');
  let title = parsed.data.title ?? '';
  let body = parsed.data.body ?? '';
  if (parsed.data.templateKey) {
    const lang = parsed.data.lang || (req.headers['accept-language']?.startsWith('en') ? 'en' : 'mn') as 'en' | 'mn';
    const rendered = renderTemplate(parsed.data.templateKey, lang, parsed.data.variables);
    title = rendered.title;
    body = rendered.body;
  }
  const jobs = parsed.data.channels.map((channel) => createNotificationJob({ channel, tenantId: auth.tenantId!, userId: user.id, to: channel === 'email' ? user.email : channel === 'sms' ? user.phone ?? undefined : undefined, title, body, route: parsed.data.route }));
  if (jobs.some((job) => job.channel !== 'in_app' && !job.to)) return sendError(res, 400, 'Selected notification channel has no recipient address.');
  await enqueueNotifications(jobs);
  return sendSuccess(res, 'Notifications queued.', { jobIds: jobs.map((job) => job.id) }, 202);
});

app.get('/api/notifications', requireAuth, requireTenant, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const notifications = await prisma.notification.findMany({ where: { tenantId: auth.tenantId!, userId: auth.sub }, orderBy: { createdAt: 'desc' }, take: 50 });
  return sendSuccess(res, 'Notifications retrieved.', notifications);
});

app.patch('/api/notifications/read-all', requireAuth, requireTenant, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  await prisma.notification.updateMany({ where: { tenantId: auth.tenantId!, userId: auth.sub, readAt: null }, data: { readAt: new Date() } });
  return sendSuccess(res, 'Notifications marked as read.', { updated: true });
});

app.patch('/api/notifications/:id/read', requireAuth, requireTenant, async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  await prisma.notification.updateMany({ where: { id: getTenantId(req), tenantId: auth.tenantId!, userId: auth.sub }, data: { readAt: new Date() } });
  return sendSuccess(res, 'Notification marked as read.', { updated: true });
});

app.delete('/api/notifications', requireAuth, requireTenant, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  await prisma.notification.deleteMany({ where: { tenantId: auth.tenantId!, userId: auth.sub } });
  return sendSuccess(res, 'Notifications cleared.', { deleted: true });
});

const queueInvite = async (auth: AuthTokenPayload, invite: { email: string | null; phone: string | null }, token: string, lang: 'mn' | 'en' = 'mn') => {
  const origin = (process.env.FRONTEND_URLS?.split(',')[0] ?? process.env.FRONTEND_URL ?? 'http://localhost:5174').trim();
  const link = `${origin}/invite?token=${encodeURIComponent(token)}`;
  const t = renderTemplate('invite_sent', lang, { link });
  const jobs = [
    ...(invite.email ? [createNotificationJob({ channel: 'email' as const, tenantId: auth.tenantId!, userId: auth.sub, to: invite.email, title: t.title, body: t.body })] : []),
    ...(invite.phone ? [createNotificationJob({ channel: 'sms' as const, tenantId: auth.tenantId!, userId: auth.sub, to: invite.phone, title: t.title, body: t.body })] : []),
  ];
  await enqueueNotifications(jobs);
};

app.get('/api/resident-memberships/tenants', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = await prisma.tenant.findMany({ where: { status: { in: ['active', 'trial'] }, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { buildings: { some: { address: { contains: q, mode: 'insensitive' } } } }] } : {}) }, select: { id: true, name: true, slug: true, buildings: { where: { address: { not: null } }, select: { address: true }, take: 1 } }, orderBy: { name: 'asc' }, take: 30 });
  return sendSuccess(res, 'Active workspaces retrieved.', rows.map(({ buildings, ...tenant }) => ({ ...tenant, address: buildings[0]?.address ?? null })));
});

app.get('/api/resident-memberships/tenants/:id/units', requireAuth, async (req, res) => {
  const requestedTenantId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!requestedTenantId) return sendError(res, 400, 'СӨХ-ийн мэдээлэл дутуу байна.');
  const tenant = await prisma.tenant.findFirst({ where: { id: requestedTenantId, status: { in: ['active', 'trial'] } }, select: { id: true } });
  if (!tenant) return sendError(res, 404, 'СӨХ олдсонгүй.');
  const units = await prisma.unit.findMany({ where: { tenantId: tenant.id, status: { not: 'inactive' } }, select: { id: true, number: true, floor: { select: { number: true, entrance: { select: { name: true, building: { select: { name: true } } } } } }, _count: { select: { residentProfiles: { where: { status: 'active' } } } } }, orderBy: { number: 'asc' } });
  return sendSuccess(res, 'Workspace units retrieved.', units.map((unit) => ({ id: unit.id, number: unit.number, floor: unit.floor.number, entrance: unit.floor.entrance.name, building: unit.floor.entrance.building.name, hasActiveResident: unit._count.residentProfiles > 0 })));
});

app.post('/api/resident-memberships/requests', requireAuth, async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  if (auth.role !== 'unassigned') return sendError(res, 409, 'Only an unassigned account can request resident membership.');
  const parsed = parseBody(residentMembershipRequestSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const tenant = await prisma.tenant.findFirst({ where: { id: parsed.data.tenantId, status: { in: ['active', 'trial'] } }, select: { id: true } });
  if (!tenant) return sendError(res, 404, 'Selected workspace was not found.');
  const unit = parsed.data.unitId ? await prisma.unit.findFirst({ where: { id: parsed.data.unitId, tenantId: tenant.id } }) : null;
  if (parsed.data.unitId && !unit) return sendError(res, 404, 'Selected unit was not found.');
  const requestData = { unitId: unit?.id ?? null, requestedBuilding: unit ? null : parsed.data.building, requestedEntrance: unit ? null : parsed.data.entrance, requestedFloor: unit ? null : parsed.data.floor, requestedUnit: unit ? null : parsed.data.unit, status: 'pending' as const };
  const membership = await prisma.residentProfile.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: auth.sub } }, create: { tenantId: tenant.id, userId: auth.sub, ...requestData }, update: requestData });
  const managers = await prisma.user.findMany({ where: { tenantId: parsed.data.tenantId, role: 'manager', isActive: true }, select: { id: true } });
  for (const manager of managers) {
    const notification = await prisma.notification.create({ data: { tenantId: parsed.data.tenantId, userId: manager.id, type: 'info', title: 'Оршин суугчийн шинэ хүсэлт', body: `${auth.email} оршин суугчаар нэгдэх хүсэлт илгээлээ.`, route: `/manager/residents?view=requests&request=${membership.id}` } });
    publishLiveEvent({ type: 'notification.created', tenantId: parsed.data.tenantId, userId: manager.id, data: { id: notification.id, title: notification.title, body: notification.body, route: notification.route, type: 'info' } });
  }
  return sendSuccess(res, 'Resident membership request submitted.', { id: membership.id, status: membership.status }, 201);
});

app.get('/api/resident-memberships/me', requireAuth, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const memberships = await prisma.residentProfile.findMany({ where: { userId: auth.sub }, include: { tenant: { select: { id: true, name: true, slug: true } }, unit: { select: { id: true, number: true, floor: { select: { number: true, entrance: { select: { name: true, building: { select: { name: true } } } } } } } } }, orderBy: { createdAt: 'desc' } });
  return sendSuccess(res, 'Resident memberships retrieved.', memberships);
});

app.get('/api/resident-memberships/requests', ...requireDomainAccess('manager-residents'), async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const requests = await prisma.residentProfile.findMany({ where: { tenantId: auth.tenantId!, status: 'pending' }, include: { user: { select: { fullName: true, email: true, phone: true } }, unit: { select: { number: true, floor: { select: { number: true, entrance: { select: { name: true, building: { select: { name: true } } } } } } } } }, orderBy: { createdAt: 'desc' } });
  return sendSuccess(res, 'Pending resident requests retrieved.', requests);
});

for (const action of ['approve', 'reject'] as const) app.post(`/api/resident-memberships/requests/:id/${action}`, ...requireDomainAccess('manager-residents'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const membership = await prisma.residentProfile.findFirst({ where: { id: getTenantId(req), tenantId: auth.tenantId!, status: 'pending' }, include: { user: true } });
  if (!membership) return sendError(res, 404, 'Pending resident request not found.');
  if (action === 'approve') {
    await prisma.$transaction(async (tx) => {
      let unitId = membership.unitId;
      if (!unitId) {
        if (!membership.requestedBuilding || !membership.requestedEntrance || membership.requestedFloor === null || !membership.requestedUnit) throw new Error('Requested unit details are incomplete.');
        let building = await tx.building.findFirst({ where: { tenantId: membership.tenantId, name: { equals: membership.requestedBuilding, mode: 'insensitive' } } });
        if (!building) building = await tx.building.create({ data: { tenantId: membership.tenantId, code: `B-${Date.now()}`, name: membership.requestedBuilding } });
        const entrance = await tx.entrance.upsert({ where: { buildingId_name: { buildingId: building.id, name: membership.requestedEntrance } }, create: { tenantId: membership.tenantId, buildingId: building.id, name: membership.requestedEntrance }, update: {} });
        const floor = await tx.floor.upsert({ where: { entranceId_number: { entranceId: entrance.id, number: membership.requestedFloor } }, create: { tenantId: membership.tenantId, entranceId: entrance.id, number: membership.requestedFloor }, update: {} });
        const unit = await tx.unit.upsert({ where: { floorId_number: { floorId: floor.id, number: membership.requestedUnit } }, create: { tenantId: membership.tenantId, floorId: floor.id, number: membership.requestedUnit }, update: {} });
        unitId = unit.id;
      }
      await tx.residentProfile.update({ where: { id: membership.id }, data: { status: 'active', unitId } });
      await tx.user.update({ where: { id: membership.userId }, data: { tenantId: membership.tenantId, role: 'resident', onboardingCompleted: true } });
    });
  } else await prisma.residentProfile.update({ where: { id: membership.id }, data: { status: 'rejected' } });
  const notification = await prisma.notification.create({ data: { tenantId: membership.tenantId, userId: membership.userId, type: 'info', title: action === 'approve' ? 'Гишүүнчлэл баталгаажлаа' : 'Гишүүнчлэлийн хүсэлт татгалзлаа', body: action === 'approve' ? 'Та resident dashboard ашиглах эрхтэй боллоо.' : 'СӨХ таны нэгдэх хүсэлтийг татгалзлаа.', route: action === 'approve' ? '/resident' : '/resident/join' } });
  publishLiveEvent({ type: 'notification.created', tenantId: membership.tenantId, userId: membership.userId, data: { id: notification.id, title: notification.title, body: notification.body, route: notification.route, type: 'info' } });
  return sendSuccess(res, `Resident request ${action}d.`, { id: membership.id, status: action === 'approve' ? 'active' : 'rejected' });
});

app.get('/api/invites', ...requireDomainAccess('manager-residents'), async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload; await expireInvites(prisma, auth.tenantId!);
  const invites = await prisma.invite.findMany({ where: { tenantId: auth.tenantId }, select: { id: true, email: true, phone: true, role: true, unitId: true, status: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  return sendSuccess(res, 'Invites retrieved.', invites);
});

app.post('/api/invites', ...requireDomainAccess('manager-residents'), async (req, res) => {
  const parsed = parseBody(inviteCreateSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const { invite, token } = await createInvite(prisma, { tenantId: auth.tenantId!, invitedById: auth.sub, ...parsed.data });
    const lang = (req.headers['accept-language']?.startsWith('en') ? 'en' : 'mn') as 'en' | 'mn';
    await queueInvite(auth, invite, token, lang);
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'invite.created', entityType: 'Invite', entityId: invite.id, metadata: { role: invite.role } });
    return sendSuccess(res, 'Invite created and queued.', { id: invite.id, status: invite.status, expiresAt: invite.expiresAt }, 201);
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Invite failed.'); }
});

app.delete('/api/invites/:id', ...requireDomainAccess('manager-residents'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const value = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await prisma.invite.deleteMany({ where: { tenantId: auth.tenantId!, OR: [{ id: value }, { email: value.toLowerCase() }] } });
  if (!deleted.count) return sendError(res, 404, 'Invitation was not found.');
  return sendSuccess(res, 'Invitation deleted.', { deleted: true });
});

app.post('/api/invites/accept', requireAuth, async (req, res) => {
  const parsed = parseBody(inviteAcceptSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  const invite = await prisma.invite.findFirst({ where: { status: { in: ['pending', 'accepted'] }, expiresAt: { gt: new Date() }, tokenHash: hashSensitiveToken(parsed.data.token) }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
  const acceptingUser = await prisma.user.findUnique({ where: { id: auth.sub }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
  const identityMatches = invite?.email
    ? invite.email.toLowerCase() === auth.email.toLowerCase()
    : Boolean(invite?.phone && invite.phone.replace(/\D/g, '') === (acceptingUser?.phone ?? '').replace(/\D/g, ''));
  if (!invite || !identityMatches) return sendError(res, 404, 'Invitation not found or expired.');
  if (invite.status === 'accepted') {
    if (!acceptingUser || acceptingUser.tenantId !== invite.tenantId || acceptingUser.role !== invite.role) return sendError(res, 404, 'Invitation not found or expired.');
    return sendSession(res, 'Invitation already accepted.', acceptingUser);
  }
  const user = await prisma.$transaction(async (transaction) => {
    await transaction.invite.update({ where: { id: invite.id }, data: { status: 'accepted', acceptedAt: new Date() } });
    const updated = await transaction.user.update({ where: { id: auth.sub }, data: { role: invite.role, tenantId: invite.tenantId, onboardingCompleted: true }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
    if (invite.role === 'resident') await transaction.residentProfile.upsert({ where: { tenantId_userId: { tenantId: invite.tenantId, userId: auth.sub } }, create: { tenantId: invite.tenantId, userId: auth.sub, unitId: invite.unitId, status: 'active' }, update: { unitId: invite.unitId, status: 'active' } });
    return updated;
  });
  return sendSession(res, 'Invitation accepted.', user);
});

(['resend', 'revoke'] as const).forEach((action) => app.post(`/api/invites/:id/${action}`, ...requireDomainAccess('manager-residents'), async (req, res) => {
  const params = parseParams(idParamsSchema, req.params); if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    if (action === 'resend') {
      const result = await resendInvite(prisma, auth.tenantId!, params.data.id);
      const lang = (req.headers['accept-language']?.startsWith('en') ? 'en' : 'mn') as 'en' | 'mn';
      await queueInvite(auth, result.invite, result.token, lang);
    }
    else await revokeInvite(prisma, auth.tenantId!, params.data.id);
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: `invite.${action}`, entityType: 'Invite', entityId: params.data.id });
    return sendSuccess(res, `Invite ${action} successful.`, { id: params.data.id });
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Invite action failed.'); }
}));

app.post('/api/files', ...requireDomainAccess('file-attachments'), async (req, res) => {
  const parsed = parseBody(fileUploadSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    await validateEmbeddedUploads(parsed.data.dataUrl);
    const { mimeType, bytes } = parseDataUrl(parsed.data.dataUrl); const storageKey = createStorageKey(auth.tenantId!, parsed.data.fileName);
    const url = await fileStorage.put({ key: storageKey, bytes, mimeType });
    const attachment = await prisma.fileAttachment.create({ data: { tenantId: auth.tenantId!, uploadedById: auth.sub, entityType: parsed.data.entityType, entityId: parsed.data.entityId, fileName: parsed.data.fileName, mimeType, sizeBytes: BigInt(bytes.length), storageKey, url }, select: { id: true, url: true, fileName: true, mimeType: true } });
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'file.uploaded', entityType: parsed.data.entityType, entityId: parsed.data.entityId, metadata: { attachmentId: attachment.id, mimeType, sizeBytes: bytes.length } });
    return sendSuccess(res, 'File uploaded.', { ...attachment, sizeBytes: bytes.length }, 201);
  } catch (error) { return sendError(res, 400, error instanceof Error ? error.message : 'File upload failed.'); }
});

app.get('/api/reports/export/:report/:format', ...requireDomainAccess('report-export'), async (req, res) => {
  const params = parseParams(reportExportParamsSchema, req.params); if ('error' in params) return sendError(res, 400, getValidationMessage(params.error));
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const rows = await loadReportRows(prisma, auth.tenantId!, params.data.report);
    const file = params.data.format === 'pdf' ? await renderPdf(params.data.report, rows) : await renderExcel(params.data.report, rows);
    await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'report.exported', entityType: 'Report', entityId: params.data.report, metadata: { format: params.data.format, rows: rows.length } });
    res.setHeader('Content-Type', params.data.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${params.data.report}.${params.data.format}"`);
    return res.send(file);
  } catch (error) { return sendError(res, 500, error instanceof Error ? error.message : 'Report export failed.'); }
});

app.post('/api/residents/import', ...requireDomainAccess('manager-residents'), async (req, res) => {
  const parsed = parseBody(residentImportSchema, req.body);
  if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  try {
    const tenantId = (res.locals.auth as AuthTokenPayload).tenantId!;
    const result = await importResidents(prisma, tenantId, parsed.data);
    return sendSuccess(res, 'Residents imported atomically.', result, 201);
  } catch (error) { return sendError(res, 409, error instanceof Error ? error.message : 'Resident import failed.'); }
});

app.patch('/api/users/:id/role', ...requireDomainAccess('manager-residents'), async (req, res) => {
  const params = parseParams(idParamsSchema, req.params);
  const parsed = parseBody(roleChangeSchema, req.body);
  if ('error' in params || 'error' in parsed) return sendError(res, 400, getValidationMessage('error' in params ? params.error : parsed.error));
  const auth = res.locals.auth as AuthTokenPayload;
  const user = await prisma.user.findFirst({ where: { id: params.data.id, tenantId: auth.tenantId }, select: { id: true, role: true } });
  if (!user) return sendError(res, 404, 'User not found.');
  await prisma.user.update({ where: { id: user.id }, data: { role: parsed.data.role } });
  await writeAudit(prisma, req, { tenantId: auth.tenantId!, actorId: auth.sub, action: 'user.role_changed', entityType: 'User', entityId: user.id, metadata: { from: user.role, to: parsed.data.role } });
  return sendSuccess(res, 'User role updated.', { id: user.id, role: parsed.data.role });
});

app.get('/api/permissions/custom', requireAuth, requireTenant, async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const record = await prisma.appState.findUnique({ where: { key: `${auth.tenantId}:custom-permissions` } });
    const current = (record?.value as Record<string, string[]>) || defaultPermissions;
    return sendSuccess(res, 'Permissions retrieved successfully.', current);
  } catch (error) {
    return sendError(res, 500, 'Unable to retrieve custom permissions.');
  }
});

app.put('/api/permissions/custom', requireAuth, requireTenant, requireRole('manager'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return sendError(res, 400, 'Invalid request body.');
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
      return sendError(res, 400, `Invalid configuration for permission: ${key}`);
    }
  }
  try {
    const stateKey = `${auth.tenantId}:custom-permissions`;
    await prisma.appState.upsert({
      where: { key: stateKey },
      update: { value: payload },
      create: { key: stateKey, value: payload },
    });
    return sendSuccess(res, 'Custom permissions updated successfully.', payload);
  } catch (error) {
    return sendError(res, 500, 'Unable to update custom permissions.');
  }
});

app.get('/api/reports/summary/billing', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const data = await prisma.$queryRaw`
      SELECT * FROM "TenantBillingSummary" WHERE "tenantId" = ${auth.tenantId} LIMIT 1
    `;
    return sendSuccess(res, 'Billing report retrieved.', data || null);
  } catch (error) {
    return sendError(res, 500, 'Unable to query billing report.');
  }
});

app.get('/api/reports/summary/utility', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const data = await prisma.$queryRaw`
      SELECT * FROM "MonthlyUtilityConsumption" WHERE "tenantId" = ${auth.tenantId}
    `;
    return sendSuccess(res, 'Utility report retrieved.', data);
  } catch (error) {
    return sendError(res, 500, 'Unable to query utility report.');
  }
});

app.get('/api/reports/summary/maintenance', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const data = await prisma.$queryRaw`
      SELECT * FROM "MaintenancePerformance" WHERE "tenantId" = ${auth.tenantId} LIMIT 1
    `;
    return sendSuccess(res, 'Maintenance performance report retrieved.', data || null);
  } catch (error) {
    return sendError(res, 500, 'Unable to query maintenance report.');
  }
});

app.get('/api/anomalies', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const readings = (await store.getScope<MeterReading[]>(`${auth.tenantId}:meter-readings`)) || [];
    const payments = (await store.getScope<Payment[]>(`${auth.tenantId}:payment-records`)) || [];

    const meterAlerts = detectMeterAnomalies(readings);
    const paymentAlerts = detectPaymentAnomalies(payments);

    const allAlerts = [...meterAlerts, ...paymentAlerts];
    const summary = {
      high: allAlerts.filter(a => a.severity === 'high').length,
      medium: allAlerts.filter(a => a.severity === 'medium').length,
      info: allAlerts.filter(a => a.severity === 'info').length,
    };

    return sendSuccess(res, 'Anomalies detected successfully.', {
      meterAlerts,
      paymentAlerts,
      summary,
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to detect anomalies.');
  }
});

app.get('/api/public/data', async (req, res) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) return sendError(res, 401, 'API key is required.');

  try {
    const tenantsList = await store.getScope<any[]>('platform-tenants') || [];
    let authenticatedTenant: any = null;

    for (const tenant of tenantsList) {
      if (tenant.plan === 'Enterprise') {
        const settings = await store.getScope<any>(`${tenant.id}:manager-settings`);
        if (settings && settings.apiKey === apiKey) {
          authenticatedTenant = tenant;
          break;
        }
      }
    }

    if (!authenticatedTenant) {
      return sendError(res, 403, 'Invalid API Key or subscription plan restriction.');
    }

    const readings = await store.getScope<any[]>(`${authenticatedTenant.id}:meter-readings`) || [];
    const payments = await store.getScope<any[]>(`${authenticatedTenant.id}:payment-records`) || [];

    return sendSuccess(res, 'Public data retrieved successfully.', {
      tenantId: authenticatedTenant.id,
      tenantName: authenticatedTenant.name,
      metersCount: readings.length,
      paymentsCount: payments.length,
      recentPayments: payments.slice(-10),
      recentReadings: readings.slice(-10),
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to query public API.');
  }
});

app.get('/api/residents', ...requireDomainAccess('manager-residents'), async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const profiles = await prisma.residentProfile.findMany({
    where: { tenantId: auth.tenantId!, status: 'active' },
    include: { user: { select: { fullName: true, email: true, phone: true } }, unit: { select: { number: true, floor: { select: { number: true, entrance: { select: { name: true, building: { select: { name: true } } } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const residents = profiles.map((profile) => {
    const name = profile.user.fullName || profile.user.email;
    return { id: profile.id, tenantId: profile.tenantId, name, apartment: profile.unit ? `${profile.unit.floor.entrance.building.name} · ${profile.unit.floor.entrance.name}-р орц · ${profile.unit.floor.number}-р давхар · ${profile.unit.number} тоот` : '-', phone: profile.user.phone ?? '-', email: profile.user.email, type: profile.isOwner ? 'Нярав' : 'Оршин суугч', status: 'Идэвхтэй', initials: name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() };
  });
  const stored = await store.getScope<Array<Record<string, unknown>>>(`${auth.tenantId!}:manager-residents`) ?? [];
  return sendSuccess(res, 'Residents retrieved.', [...residents, ...stored.filter((item) => !residents.some((resident) => resident.id === item.id))]);
});

app.get('/api/maintenance-staff', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (_req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const staff = await prisma.user.findMany({ where: { tenantId: auth.tenantId!, role: 'staff', isActive: true }, select: { id: true, fullName: true, email: true }, orderBy: { fullName: 'asc' } });
  return sendSuccess(res, 'Maintenance staff retrieved.', staff.map((member) => ({ id: member.id, name: member.fullName || member.email })));
});

[
  ['/api/buildings', 'manager-buildings'], ['/api/residents', 'manager-residents'], ['/api/meter-readings', 'meter-readings'],
  ['/api/invoices', 'billing-invoices'], ['/api/invoice-runs/current', 'billing-run'], ['/api/bank-statements', 'payment-statements'],
  ['/api/payments', 'payment-records'], ['/api/expenses', 'expense-records'], ['/api/maintenance-requests', 'maintenance-requests'],
  ['/api/maintenance-announcements', 'maintenance-announcements'], ['/api/manager-settings', 'manager-settings'],
  ['/api/accounting-periods/current', 'accountant-period'], ['/api/work-orders', 'staff-work-orders'],
  ['/api/resident/notices', 'resident-portal-notices'], ['/api/resident/portal-tickets', 'resident-portal-tickets'],
  ['/api/resident/service-tickets', 'resident-service-tickets'], ['/api/resident/community-notices', 'resident-community-notices'],
].forEach(([path, scope]) => registerDomainCrud(path, scope));

app.get('/api/dashboard/manager', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getManagerDashboardStats(prisma, auth.tenantId!, store);
    return sendSuccess(res, 'Manager dashboard statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query manager dashboard stats.');
  }
});

app.get('/api/stats/billing', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getBillingStats(prisma, auth.tenantId!, store);
    return sendSuccess(res, 'Billing statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query billing stats.');
  }
});

app.get('/api/stats/reports', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const months = Math.min(Math.max(Number(req.query.months ?? 6), 1), 12);
  try {
    const stats = await getReportsStats(prisma, auth.tenantId!, store, months);
    return sendSuccess(res, 'Report statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query report stats.');
  }
});

app.get('/api/stats/maintenance', requireAuth, requireTenant, requireRole('manager', 'accountant', 'staff'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getMaintenanceStats(prisma, auth.tenantId!);
    return sendSuccess(res, 'Maintenance statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query maintenance stats.');
  }
});

app.get('/api/stats/payments', requireAuth, requireTenant, requireRole('manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getPaymentStats(prisma, auth.tenantId!);
    return sendSuccess(res, 'Payment statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query payment stats.');
  }
});

app.get('/api/stats/transparency', requireAuth, requireTenant, requireRole('resident', 'manager', 'accountant'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getTransparencyStats(prisma, auth.tenantId!, store);
    return sendSuccess(res, 'Transparency statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query transparency stats.');
  }
});

app.get('/api/dashboard/accountant', requireAuth, requireTenant, requireRole('accountant', 'manager'), async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  try {
    const stats = await getAccountantDashboardStats(prisma, auth.tenantId!, store);
    return sendSuccess(res, 'Accountant dashboard statistics retrieved successfully.', stats);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to query accountant dashboard stats.');
  }
});

app.get('/api/platform/overview', ...requireSuperAdmin, (_req, res) => {
  const approved = tenants.filter((tenant) => ['active', 'trial', 'overdue', 'read_only'].includes(tenant.status));
  const active = tenants.filter((tenant) => tenant.status === 'active');
  const trial = tenants.filter((tenant) => tenant.status === 'trial');
  const readOnly = tenants.filter((tenant) => tenant.status === 'read_only');
  const mrr = active.reduce((sum, tenant) => sum + tenant.monthlyPrice, 0);

  return sendSuccess(res, 'Platform overview retrieved successfully.', {
    totalTenants: approved.length,
    activeTenants: active.length,
    trialTenants: trial.length,
    readOnlyTenants: readOnly.length,
    pendingApprovals: tenants.filter((tenant) => tenant.status === 'pending').length,
    mrr,
  });
});

app.get('/api/platform/tenants', ...requireSuperAdmin, (req, res) => {
  const query = parseQuery(tenantListQuerySchema, req.query);
  if ('error' in query) return sendError(res, 400, getValidationMessage(query.error));
  const status = query.data.status;
  const result = status
    ? tenants.filter((tenant) => tenant.status === status)
    : tenants.filter((tenant) => !['pending', 'rejected'].includes(tenant.status));
  return sendSuccess(res, 'Tenants retrieved successfully.', result.map(toTenantSummary));
});

app.get('/api/platform/requests', ...requireSuperAdmin, (_req, res) => {
  return sendSuccess(
    res,
    'Pending workspace requests retrieved successfully.',
    tenants.filter((tenant) => tenant.status === 'pending').map(toTenantSummary),
  );
});

app.post('/api/platform/requests', requireAuth, async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  if (auth.role !== 'unassigned') return sendError(res, 403, 'Only unassigned users can request an organization.');
  const parsed = parseBody(organizationRequestSchema, req.body); if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: auth.sub }, select: { tenantId: true } });
    if (currentUser?.tenantId) {
      const existing = tenants.find((item) => item.id === currentUser.tenantId);
      if (existing?.status === 'pending') return sendSuccess(res, 'Existing organization request retrieved.', { id: existing.id, status: existing.status });
    }
    const tenant = await prisma.tenant.create({ data: { name: parsed.data.name, slug: `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${randomUUID().slice(0, 8)}`, status: 'pending' } });
    await prisma.user.update({ where: { id: auth.sub }, data: { tenantId: tenant.id } });
    const plan = parsed.data.plan ?? 'Start';
    tenants.push({ id: tenant.id, name: tenant.name, contactName: auth.email, contactEmail: auth.email, location: parsed.data.location ?? '', plan, status: 'pending', unitCount: 0, monthlyPrice: planPrices[plan], createdAt: tenant.createdAt.toISOString().slice(0, 10) });
    await persistTenants();
    return sendSuccess(res, 'Organization request submitted.', { id: tenant.id, status: 'pending' }, 201);
  } catch { return sendError(res, 500, 'Unable to submit organization request.'); }
});

app.post('/api/platform/requests/:id/checkout', requireAuth, async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const tenantId = getTenantId(req);
  try {
    const owner = await prisma.user.findFirst({ where: { id: auth.sub, tenantId }, select: { id: true } });
    if (!owner) return sendError(res, 403, 'This workspace does not belong to your account.');
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant || tenant.status !== 'pending') return sendError(res, 409, 'Workspace is not awaiting payment.');
    const scope = onboardingCheckoutScope(tenantId);
    const existing = await store.getScope<OnboardingCheckout>(scope);
    if (existing?.checkoutUrl) return sendSuccess(res, 'Checkout retrieved.', existing);
    const amount = planPrices[tenant.plan];
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5174').replace(/\/$/, '');
    const stripe = await createStripeCheckout({
      tenantId,
      email: auth.email,
      plan: tenant.plan,
      amountMnt: amount,
      successUrl: `${frontendUrl}/soh/register?payment=success&tenant_id=${encodeURIComponent(tenantId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/soh/register?payment=cancelled`,
    });
    if (!stripe.id || !stripe.url) throw new Error('Stripe Checkout URL is missing.');
    const checkout: OnboardingCheckout = { tenantId, amount, stripeSessionId: stripe.id, checkoutUrl: stripe.url, createdAt: new Date().toISOString(), status: 'pending' };
    await store.setScope(scope, checkout);
    return sendSuccess(res, 'Stripe test checkout created.', checkout, 201);
  } catch (error) {
    return sendError(res, 503, error instanceof Error ? error.message : 'Unable to create payment QR.');
  }
});

app.post('/api/platform/requests/:id/checkout/verify', requireAuth, async (req, res) => {
  const auth = res.locals.auth as AuthTokenPayload;
  const tenantId = getTenantId(req);
  try {
    const owner = await prisma.user.findFirst({ where: { id: auth.sub, tenantId }, select: { id: true } });
    if (!owner) return sendError(res, 403, 'This workspace does not belong to your account.');
    const checkout = await store.getScope<OnboardingCheckout>(onboardingCheckoutScope(tenantId));
    if (!checkout) return sendError(res, 404, 'Payment checkout not found.');
    if (checkout.status !== 'paid') {
      const stripe = await getStripeCheckout(checkout.stripeSessionId);
      if (stripe.paymentStatus !== 'paid' || stripe.clientReferenceId !== tenantId || stripe.amountTotal !== checkout.amount * 100) {
        return sendSuccess(res, 'Payment is still pending.', { paid: false });
      }
      await recordStripePayment(checkout);
    }
    const user = await prisma.user.findUnique({ where: { id: auth.sub }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
    if (!user?.isActive || user.role !== 'manager') return sendError(res, 403, 'Manager access is not active.');
    const refresh = await issueRefreshToken(prisma, user);
    res.append('Set-Cookie', refreshCookie(refresh));
    return sendSuccess(res, 'Payment confirmed.', { paid: true, session: { user: toAuthUser(user), token: createTokenForUser(user) } });
  } catch (error) {
    return sendError(res, 503, error instanceof Error ? error.message : 'Unable to verify payment.');
  }
});

app.post('/api/platform/checkout/complete', async (req, res) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : '';
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!tenantId || !sessionId) return sendError(res, 400, 'Stripe return data is missing.');
  try {
    const checkout = await store.getScope<OnboardingCheckout>(onboardingCheckoutScope(tenantId));
    if (!checkout || checkout.stripeSessionId !== sessionId) return sendError(res, 403, 'Stripe checkout session is invalid.');
    if (checkout.status !== 'paid') {
      const stripe = await getStripeCheckout(sessionId);
      if (stripe.paymentStatus !== 'paid' || stripe.clientReferenceId !== tenantId || stripe.amountTotal !== checkout.amount * 100) {
        return sendSuccess(res, 'Payment is still pending.', { paid: false });
      }
      await recordStripePayment(checkout);
    }
    const user = await prisma.user.findFirst({ where: { tenantId, role: 'manager', isActive: true }, include: { tenant: { select: { id: true, name: true, slug: true } } } });
    if (!user) return sendError(res, 403, 'Manager access is not active.');
    const refresh = await issueRefreshToken(prisma, user);
    res.append('Set-Cookie', refreshCookie(refresh));
    return sendSuccess(res, 'Stripe payment completed.', { paid: true, session: { user: toAuthUser(user), token: createTokenForUser(user) } });
  } catch (error) {
    return sendError(res, 503, error instanceof Error ? error.message : 'Unable to complete Stripe return.');
  }
});

app.post('/api/webhooks/stripe', async (req, res) => {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) return sendError(res, 400, 'Stripe webhook body is missing.');
    const event = verifyStripeWebhook(rawBody, req.header('stripe-signature'));
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      return sendSuccess(res, 'Stripe event ignored.', { received: true });
    }
    const session = event.data?.object;
    const tenantId = typeof session?.client_reference_id === 'string' ? session.client_reference_id : undefined;
    const sessionId = typeof session?.id === 'string' ? session.id : undefined;
    const paymentStatus = typeof session?.payment_status === 'string' ? session.payment_status : undefined;
    if (!tenantId || !sessionId || paymentStatus !== 'paid') return sendError(res, 400, 'Stripe checkout session is incomplete.');
    const checkout = await store.getScope<OnboardingCheckout>(onboardingCheckoutScope(tenantId));
    if (!checkout || checkout.stripeSessionId !== sessionId || Number(session?.amount_total) !== checkout.amount * 100) {
      return sendError(res, 409, 'Stripe checkout does not match the workspace payment.');
    }
    await recordStripePayment(checkout);
    return sendSuccess(res, 'Stripe payment recorded.', { received: true });
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : 'Invalid Stripe webhook.');
  }
});

app.post('/api/platform/requests/:id/approve', ...requireSuperAdmin, async (req, res) => {
  try {
    const tenant = findTenant(getTenantId(req), res);
    if (!tenant) return;
    if (tenant.status !== 'pending') {
      return sendError(res, 409, 'Зөвхөн хүлээгдэж буй хүсэлтийг батална.');
    }

    const parsed = parseBody(approveRequestSchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    const { plan } = parsed.data;

    tenant.plan = plan ?? tenant.plan;
    tenant.monthlyPrice = planPrices[tenant.plan];
    tenant.status = tenant.plan === 'Start' ? 'active' : 'trial';
    tenant.trialEndsAt = tenant.status === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined;
    await persistTenantAccess(tenant);
    await prisma.user.updateMany({ where: { tenantId: tenant.id, role: 'unassigned' }, data: { role: 'manager', onboardingCompleted: true } });
    await writeAudit(prisma, req, { tenantId: tenant.id, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'tenant.approved', entityType: 'Tenant', entityId: tenant.id, metadata: { status: tenant.status, plan: tenant.plan } });
    return sendSuccess(res, 'Workspace request approved successfully.', toTenantSummary(tenant));
  } catch {
    return sendError(res, 500, 'Unable to approve the workspace request.');
  }
});

app.post('/api/platform/requests/:id/reject', ...requireSuperAdmin, async (req, res) => {
  try {
    const tenant = findTenant(getTenantId(req), res);
    if (!tenant) return;
    if (tenant.status !== 'pending') {
      return sendError(res, 409, 'Зөвхөн хүлээгдэж буй хүсэлтийг татгалзана.');
    }
    const parsed = parseBody(rejectRequestSchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    tenant.status = 'rejected';
    tenant.rejectionReason = parsed.data.reason ?? 'Баталгаажуулалт дутуу';
    await persistTenantAccess(tenant);
    await writeAudit(prisma, req, { tenantId: tenant.id, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'tenant.rejected', entityType: 'Tenant', entityId: tenant.id, metadata: { reason: tenant.rejectionReason } });
    return sendSuccess(res, 'Workspace request rejected successfully.', toTenantSummary(tenant));
  } catch {
    return sendError(res, 500, 'Unable to reject the workspace request.');
  }
});

app.patch('/api/platform/tenants/:id/subscription', ...requireSuperAdmin, async (req, res) => {
  try {
    const tenant = findTenant(getTenantId(req), res);
    if (!tenant) return;
    if (tenant.status === 'pending' || tenant.status === 'rejected') {
      return sendError(res, 409, 'Эхлээд workspace хүсэлтийг батална уу.');
    }

    const parsed = parseBody(subscriptionSchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    const { plan, trialEndsAt } = parsed.data;
    if (plan) {
      tenant.plan = plan;
      tenant.monthlyPrice = planPrices[plan];
    }
    if (trialEndsAt !== undefined) {
      tenant.trialEndsAt = trialEndsAt || undefined;
      if (trialEndsAt && tenant.status !== 'read_only') tenant.status = 'trial';
      if (!trialEndsAt && tenant.status === 'trial') tenant.status = 'active';
    }
    await persistTenantAccess(tenant);
    await writeAudit(prisma, req, { tenantId: tenant.id, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'tenant.subscription_changed', entityType: 'Tenant', entityId: tenant.id, metadata: { plan: tenant.plan, status: tenant.status } });
    return sendSuccess(res, 'Tenant subscription updated successfully.', toTenantSummary(tenant));
  } catch {
    return sendError(res, 500, 'Unable to update the tenant subscription.');
  }
});

app.post('/api/platform/tenants/:id/read-only', ...requireSuperAdmin, async (req, res) => {
  try {
    const tenant = findTenant(getTenantId(req), res);
    if (!tenant) return;
    if (tenant.status === 'pending' || tenant.status === 'rejected') {
      return sendError(res, 409, 'Баталгаажаагүй tenant-ийг хязгаарлах боломжгүй.');
    }
    const parsed = parseBody(readOnlySchema, req.body);
    if ('error' in parsed) return sendError(res, 400, getValidationMessage(parsed.error));
    tenant.status = 'read_only';
    tenant.pastDueSince = parsed.data.pastDueSince ?? new Date().toISOString().slice(0, 10);
    await persistTenantAccess(tenant);
    await writeAudit(prisma, req, { tenantId: tenant.id, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'tenant.read_only', entityType: 'Tenant', entityId: tenant.id, metadata: { status: tenant.status } });
    return sendSuccess(res, 'Tenant access changed to read-only successfully.', toTenantSummary(tenant));
  } catch {
    return sendError(res, 500, 'Unable to change tenant access to read-only.');
  }
});

app.post('/api/platform/tenants/:id/restore', ...requireSuperAdmin, async (req, res) => {
  try {
    const tenant = findTenant(getTenantId(req), res);
    if (!tenant) return;
    if (tenant.status !== 'read_only') {
      return sendError(res, 409, 'Энэ tenant хязгаарлагдаагүй байна.');
    }
    tenant.status = 'active';
    tenant.pastDueSince = undefined;
    await persistTenantAccess(tenant);
    await writeAudit(prisma, req, { tenantId: tenant.id, actorId: (res.locals.auth as AuthTokenPayload).sub, action: 'tenant.restored', entityType: 'Tenant', entityId: tenant.id, metadata: { status: tenant.status } });
    return sendSuccess(res, 'Tenant access restored successfully.', toTenantSummary(tenant));
  } catch {
    return sendError(res, 500, 'Unable to restore tenant access.');
  }
});

app.post('/api/platform/impersonate/:userId', ...requireSuperAdmin, async (req, res) => {
  const superAdminAuth = res.locals.auth as AuthTokenPayload;
  const targetUserId = String(req.params.userId);
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { tenant: true },
    });
    if (!targetUser) {
      return sendError(res, 404, 'Хэрэглэгч олдсонгүй.');
    }
    if (targetUser.role === 'super_admin') {
      return sendError(res, 403, 'Super Admin хэрэглэгчийг impersonate хийх боломжгүй.');
    }

    const impersonationToken = createAccessToken({
      sub: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      tenantId: targetUser.tenantId || undefined,
      impersonatorSub: superAdminAuth.sub,
    });

    await writeAudit(prisma, req, {
      tenantId: targetUser.tenantId || 'platform',
      actorId: targetUser.id,
      action: 'user.impersonation_started',
      entityType: 'User',
      entityId: targetUser.id,
      metadata: {
        impersonatorId: superAdminAuth.sub,
        impersonatorEmail: superAdminAuth.email,
        targetEmail: targetUser.email,
      },
    });

    return sendSuccess(res, 'Impersonation session started successfully.', {
      token: impersonationToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        tenantId: targetUser.tenantId,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to start impersonation session.');
  }
});

app.use((_req, res) => sendError(res, 404, 'API endpoint not found.'));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.locals.errorCause = error;
  if (error instanceof SyntaxError && 'body' in error) {
    return sendError(res, 400, 'Request body contains invalid JSON.');
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    return sendError(res, 413, 'Request body is too large.');
  }
  return sendError(res, 500, 'An unexpected server error occurred.');
});

await store.initialize();
tenants = await store.getPlatformTenants<Tenant[]>(initialTenants);
const runWorker = () => void runBackgroundJobs(prisma).catch((error) => logEvent('error', 'background.worker_error', { message: error instanceof Error ? error.message : 'Unknown error' }));
runWorker(); const backgroundWorker = setInterval(runWorker, 30_000); backgroundWorker.unref();

app.listen(port, '0.0.0.0', () => {
  logEvent('info', 'server.started', { port, host: '0.0.0.0', redis: getRedisMode() });
});
