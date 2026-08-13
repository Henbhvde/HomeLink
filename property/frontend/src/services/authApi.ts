import type { AuthUser, UserRole } from '../types/auth';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
let accessToken: string | null = null;

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  details?: Array<{ path: string; message: string }>;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
};

const validRoles = new Set<UserRole>(['unassigned', 'super_admin', 'manager', 'accountant', 'staff', 'resident']);

function normalizeAuthSession(value: unknown): AuthSession {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const nested = root?.session && typeof root.session === 'object' ? root.session as Record<string, unknown> : null;
  const session = nested ?? root;
  const user = session?.user && typeof session.user === 'object' ? session.user as Record<string, unknown> : null;
  const token = typeof session?.token === 'string'
    ? session.token
    : typeof session?.accessToken === 'string' ? session.accessToken : null;

  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string'
      || typeof user.role !== 'string' || !validRoles.has(user.role as UserRole) || !token) {
    throw new Error('Нэвтрэх мэдээллийн хариу буруу байна. Backend-ээ дахин deploy хийнэ үү.');
  }
  return { user: user as unknown as AuthUser, token };
}

export type OnboardingCheckout = {
  tenantId: string;
  amount: number;
  stripeSessionId: string;
  checkoutUrl: string;
  status: 'pending' | 'paid';
};

export type RegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: 'manager' | 'resident';
  workspaceName?: string;
  building?: string;
  apartment?: string;
  inviteToken?: string;
};

export type LoginIntent = 'soh' | 'resident';
const GOOGLE_LOGIN_INTENT_KEY = 'homelink_google_login_intent';

export function getPostLoginPath(role: UserRole, intent: LoginIntent = 'resident') {
  if (role === 'unassigned') return intent === 'soh' ? '/soh/register' : '/resident/join';
  if (role === 'resident') return '/resident';
  if (role === 'staff') return '/staff';
  if (role === 'accountant') return '/accountant';
  if (role === 'super_admin') return '/platform';
  return '/manager';
}

export function getGoogleLoginIntent(): LoginIntent {
  return sessionStorage.getItem(GOOGLE_LOGIN_INTENT_KEY) === 'soh' ? 'soh' : 'resident';
}

export function clearGoogleLoginIntent() {
  sessionStorage.removeItem(GOOGLE_LOGIN_INTENT_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...init?.headers,
        },
      });
      break;
    } catch {
      if (attempt === 2) throw new Error('Холболт түр тасарлаа. Дахин оролдоно уу.');
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  const body = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok || !body?.success || body.data === null) {
    const detail = body?.details?.[0];
    if (detail?.path === 'password') throw new Error('Нууц үг хамгийн багадаа 8 тэмдэгт байна.');
    if (detail?.path === 'phone') throw new Error('Утасны дугаараа зөв оруулна уу.');
    throw new Error(detail?.message ?? body?.message ?? 'Хүсэлтийг боловсруулахад алдаа гарлаа.');
  }
  return body.data;
}

export const loginApi = (email: string, password: string) =>
  request<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }).then(normalizeAuthSession);

export const registerApi = (payload: RegisterPayload) =>
  request<unknown>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(normalizeAuthSession);

export const forgotPasswordApi = (email: string) =>
  request<{ email: string; expiresInMinutes: number; resetCode?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const verifyOtpApi = (email: string, code: string) =>
  request<{ resetToken: string }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });

export const resetPasswordApi = (resetToken: string, password: string) =>
  request<{ changed: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ resetToken, password }),
  });

export const googleLoginApi = (code: string, state: string, redirectUri: string) =>
  request<unknown>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ code, state, redirectUri }),
  }).then(normalizeAuthSession);

export function getGoogleRedirectUri() {
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI?.trim() || `${window.location.origin}/auth/callback`;
}

export function startGoogleLogin(intent: LoginIntent = 'resident') {
  sessionStorage.setItem(GOOGLE_LOGIN_INTENT_KEY, intent);
  window.location.assign(`${apiBaseUrl}/auth/google/start?redirectUri=${encodeURIComponent(getGoogleRedirectUri())}`);
}

export const getCurrentUserApi = (token: string) =>
  request<AuthUser>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const refreshSessionApi = () => request<unknown>('/auth/refresh', { method: 'POST' }).then(normalizeAuthSession);
export const logoutApi = () => request<{ revoked: boolean }>('/auth/logout', { method: 'POST' });
export const createOrganizationRequestApi = (name: string, location?: string, plan?: 'Start' | 'Growth' | 'Enterprise') => request<{ id: string; status: string }>('/platform/requests', { method: 'POST', body: JSON.stringify({ name, location, plan }) });
export const createOnboardingCheckoutApi = (tenantId: string) => request<OnboardingCheckout>(`/platform/requests/${tenantId}/checkout`, { method: 'POST' });
export const verifyOnboardingPaymentApi = (tenantId: string) => request<{ paid: boolean; session?: AuthSession }>(`/platform/requests/${tenantId}/checkout/verify`, { method: 'POST' });
export const completeStripeReturnApi = (tenantId: string, sessionId: string) => request<{ paid: boolean; session?: AuthSession }>('/platform/checkout/complete', { method: 'POST', body: JSON.stringify({ tenantId, sessionId }) });
export const acceptInviteApi = (token: string) => request<unknown>('/invites/accept', { method: 'POST', body: JSON.stringify({ token }) }).then(normalizeAuthSession);

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getStoredToken() {
  return accessToken;
}
