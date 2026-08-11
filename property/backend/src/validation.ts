import { z } from 'zod';

export const planSchema = z.enum(['Start', 'Growth', 'Enterprise']);
export const publicRegistrationRoleSchema = z.enum(['manager', 'resident']);
export const roleChangeSchema = z.object({ role: z.enum(['accountant', 'staff', 'resident']) }).strict();
export const passwordPolicySchema = z.string().min(8, 'Use at least 8 characters').max(128);
export const emptySchema = z.object({}).strict();
export const idParamsSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();
export const googleStartQuerySchema = z.object({ redirectUri: z.string().url().optional() }).strict();
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(100).optional(),
}).strict();
export const tenantListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'active', 'trial', 'overdue', 'read_only', 'rejected']).optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(320),
  code: z.string().trim().regex(/^\d{6}$/, 'A 6-digit OTP code is required'),
}).strict();

export const resetPasswordSchema = z.object({
  resetToken: z.string().trim().min(1),
  password: passwordPolicySchema,
}).strict();

export const googleOAuthSchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(32).max(200),
  redirectUri: z.string().trim().url(),
}).strict();

export const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: passwordPolicySchema,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30).optional(),
  role: publicRegistrationRoleSchema.default('manager'),
  workspaceName: z.string().trim().min(2).max(160).optional(),
  building: z.string().trim().min(1).max(50).optional(),
  apartment: z.string().trim().min(1).max(50).optional(),
  inviteToken: z.string().trim().min(20).max(500).optional(),
}).strict();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format is required').refine(
  (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  'A valid calendar date is required',
);

export const approveRequestSchema = z.object({ plan: planSchema.optional() }).strict();
export const rejectRequestSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() }).strict();
export const subscriptionSchema = z.object({
  plan: planSchema.optional(),
  trialEndsAt: isoDateSchema.nullable().optional(),
}).strict().refine(
  (value) => value.plan !== undefined || value.trialEndsAt !== undefined,
  'At least one subscription field is required',
);
export const readOnlySchema = z.object({ pastDueSince: isoDateSchema.optional() }).strict();
export const statePayloadSchema = z.object({ data: z.unknown() }).strict().refine(
  (value) => Object.prototype.hasOwnProperty.call(value, 'data'),
  { path: ['data'], message: 'A data payload is required' },
);

const moneySchema = z.number().positive().finite();
export const invoiceGenerationSchema = z.object({
  periodStart: z.string().datetime(), periodEnd: z.string().datetime(), dueAt: z.string().datetime(),
  includeAreaCharges: z.boolean().default(true),
  includeMeterCharges: z.boolean().default(true),
  includeOutstanding: z.boolean().default(true),
  penaltyRate: z.number().min(0).max(1).default(0),
  penaltyGraceDays: z.number().int().min(0).max(365).default(0),
  invoices: z.array(z.object({ unitId: z.string().min(1), residentProfileId: z.string().min(1).optional(), number: z.string().min(1).optional(), lines: z.array(z.object({ tariffId: z.string().min(1).optional(), description: z.string().min(1), quantity: z.number().positive(), unitPrice: moneySchema })).min(1).optional() })).min(1).max(1000),
}).strict();
export const paymentAllocationSchema = z.object({
  reference: z.string().min(1), method: z.string().min(1), amount: moneySchema, paidAt: z.string().datetime().optional(),
  allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: moneySchema })).min(1),
}).strict().refine((value) => value.allocations.reduce((sum, item) => sum + item.amount, 0) <= value.amount + 0.01, { path: ['allocations'], message: 'Allocation total cannot exceed payment amount' });
export const paymentWebhookParamsSchema = z.object({ provider: z.enum(['qpay', 'bank']) }).strict();
export const paymentWebhookHeadersSchema = z.object({ signature: z.string().min(32).max(256), idempotencyKey: z.string().trim().min(8).max(128) }).strict();
export const paymentWebhookSchema = z.object({
  tenantId: z.string().trim().min(1).max(128), externalReference: z.string().trim().min(1).max(200), amount: moneySchema,
  paidAt: z.string().datetime().optional(), allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: moneySchema })).min(1),
}).strict().refine((value) => Math.abs(value.allocations.reduce((sum, item) => sum + item.amount, 0) - value.amount) < 0.01, { path: ['allocations'], message: 'Allocation total must equal payment amount' });
export const qpayInvoiceCreateSchema = z.object({
  invoiceId: z.string().trim().min(1).max(128),
}).strict();
export const residentImportSchema = z.object({ rows: z.array(z.object({ email: z.string().email(), phone: z.string().min(8).optional(), unitId: z.string().min(1).optional() })).min(1).max(1000) }).strict();
export const bankStatementImportSchema = z.object({ csv: z.string().min(1).max(2_000_000) }).strict();
export const notificationQueueSchema = z.object({
  userId: z.string().min(1),
  channels: z.array(z.enum(['email', 'sms', 'in_app'])).min(1).max(3),
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
  route: z.string().max(500).optional(),
  templateKey: z.enum(['invoice_sent', 'invite_sent', 'payment_received', 'maintenance_updated', 'announcement_created']).optional(),
  variables: z.record(z.string()).optional(),
  lang: z.enum(['mn', 'en']).optional(),
}).strict().refine((data) => {
  if (data.templateKey) return true;
  return !!(data.title && data.body);
}, { message: 'title and body are required when templateKey is not provided', path: ['title'] });
export const inviteCreateSchema = z.object({ email: z.string().trim().email().optional(), phone: z.string().trim().min(8).max(30).optional(), role: z.enum(['resident', 'staff']), unitId: z.string().min(1).optional() }).strict().refine((value) => value.email || value.phone, 'Email or phone is required').refine((value) => value.role === 'resident' || !value.unitId, 'Staff invite cannot have a unit');
export const organizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160).optional(),
  plan: z.enum(['Start', 'Growth', 'Enterprise']).optional(),
}).strict();
export const inviteAcceptSchema = z.object({ token: z.string().trim().min(1) }).strict();
export const residentMembershipRequestSchema = z.object({
  tenantId: z.string().trim().min(1),
  unitId: z.string().trim().min(1).optional(),
  building: z.string().trim().min(1).max(100).optional(),
  entrance: z.string().trim().min(1).max(50).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
}).strict().refine((value) => value.unitId || (value.building && value.entrance && value.floor !== undefined && value.unit), { message: 'Unit selection or complete unit details are required.' });
export const profileUpdateSchema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(30).nullable().optional() }).strict();
export const fileUploadSchema = z.object({ entityType: z.string().trim().min(1).max(80), entityId: z.string().trim().min(1).max(128), fileName: z.string().trim().min(1).max(255), dataUrl: z.string().min(1).max(7_000_000) }).strict();
export const reportExportParamsSchema = z.object({ report: z.enum(['invoices', 'payments', 'residents', 'maintenance']), format: z.enum(['pdf', 'xlsx']) }).strict();

export function parseBody<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data } as const;
  return {
    error: {
      code: 'VALIDATION_ERROR' as const,
      message: 'Validation failed.',
      details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    },
  } as const;
}

export const parseParams = parseBody;
export const parseQuery = parseBody;
