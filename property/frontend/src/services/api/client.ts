import type { paths } from './api-types';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

export type QpayInvoice = {
  invoiceId: string;
  senderInvoiceNo: string;
  amount: number;
  qpayInvoiceId: string;
  qrText?: string;
  qrImage?: string;
  shortUrl?: string;
  deeplinks: Array<{ name: string; description?: string; logo?: string; link: string }>;
  createdAt: string;
};

export type ResidentBillingSummary = {
  currentInvoice: null | {
    id: string;
    number: string;
    amount: string;
    due: string;
    lines: Array<{ label: string; detail: string; amount: string; tone?: 'success' | 'warning' }>;
  };
  payments: Array<{ id: string; month: string; paidAt: string; amount: string; method: string; reference: string; receipt: string }>;
  meter: null | { value: string; status: string; readAt: string };
  tickets: Array<{ id: string; displayId?: string; title: string; description: string; status: string; tone: 'info' | 'success'; date: string }>;
  notices: Array<{ id: string; title: string; audience: string; date: string; body: string; read: boolean }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Сервертэй холбогдож чадсангүй.');
  }

  const body = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok || !body?.success || body.data === null) {
    throw new Error(body?.message ?? 'Хүсэлтийг боловсруулахад алдаа гарлаа.');
  }
  return body.data;
}

export const apiClient = {
  login: (body: paths['/auth/login']['post']['requestBody']['content']['application/json']) =>
    request<paths['/auth/login']['post']['responses']['200']['content']['application/json']['data']>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: paths['/auth/register']['post']['requestBody']['content']['application/json']) =>
    request<paths['/auth/register']['post']['responses']['200']['content']['application/json']['data']>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMe: (token: string) =>
    request<paths['/auth/me']['get']['responses']['200']['content']['application/json']['data']>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  refresh: () =>
    request<paths['/auth/refresh']['post']['responses']['200']['content']['application/json']['data']>('/auth/refresh', {
      method: 'POST',
    }),

  logout: () =>
    request<paths['/auth/logout']['post']['responses']['200']['content']['application/json']['data']>('/auth/logout', {
      method: 'POST',
    }),

  createQpayInvoice: (token: string, invoiceId: string) =>
    request<QpayInvoice>('/payments/qpay/invoices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invoiceId }),
    }),

  getResidentBillingSummary: (token: string) =>
    request<ResidentBillingSummary>('/resident/billing-summary', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createResidentMaintenanceRequest: (token: string, body: { title: string; description: string }) =>
    request<ResidentBillingSummary['tickets'][number]>('/resident/maintenance-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),

  deleteResidentMaintenanceRequest: (token: string, id: string) =>
    request<{ id: string }>(`/resident/maintenance-requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  getManagerDashboardStats: (token: string) =>
    request<any>('/dashboard/manager', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getAccountantDashboardStats: (token: string) =>
    request<any>('/dashboard/accountant', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getBillingStats: (token: string) =>
    request<any>('/stats/billing', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getReportsStats: (token: string, months = 6) =>
    request<any>(`/stats/reports?months=${months}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getMaintenanceStats: (token: string) =>
    request<any>('/stats/maintenance', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getMaintenanceStaff: (token: string) =>
    request<Array<{ id: string; name: string }>>('/maintenance-staff', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPaymentStats: (token: string) =>
    request<any>('/stats/payments', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getTransparencyStats: (token: string) =>
    request<any>('/stats/transparency', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPlatformOverview: (token: string) =>
    request<any>('/platform/overview', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPlatformTenants: (token: string, status?: string) =>
    request<any>(status ? `/platform/tenants?status=${status}` : '/platform/tenants', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPlatformRequests: (token: string) =>
    request<any>('/platform/requests', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
