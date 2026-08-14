import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Moon,
  UsersRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import platformOfficeBackground from '../assets/platform-office-background.svg';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getStoredToken } from '../services/authApi';
import { apiClient } from '../services/api/client';
import { useUrlQueryState } from '../hooks/useUrlQueryState';

type Plan = 'Start' | 'Growth' | 'Enterprise';
type TenantStatus = 'active' | 'trial' | 'overdue' | 'read_only';
type View = 'overview' | 'approvals' | 'directory' | 'revenue' | 'system';
type SystemAction = 'audit' | 'status' | 'policy';

type Tenant = {
  id: string;
  name: string;
  location: string;
  unitCount: number;
  plan: Plan;
  status: TenantStatus;
  trialEndsAt?: string;
  createdAt: string;
};

type ApprovalRequest = {
  id: string;
  workspaceName: string;
  contactName: string;
  location: string;
  unitCount: number;
  requestedPlan: Plan;
  submittedAt: string;
};

type ApprovedRequest = ApprovalRequest & {
  approvedAt: string;
};

type DropdownOption<T extends string> = { value: T; label: string; note?: string };

function PlatformDropdown<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return <div className="relative min-w-[132px]" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition ${open ? 'border-[#557762] bg-[#edf3eb] shadow-[0_0_0_3px_rgba(81,118,96,.10)]' : 'border-black/10 bg-white/55 hover:border-[#698674]/45 hover:bg-white/80'}`}>
      <span className="truncate">{selected.label}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#496553] transition ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="absolute left-0 top-[calc(100%+7px)] z-50 w-full min-w-[170px] overflow-hidden rounded-2xl border border-[#6f8877]/20 bg-[#f7f5ef]/95 p-1.5 shadow-[0_18px_45px_rgba(40,55,44,.20)] backdrop-blur-xl">
      {options.map((option) => { const active = option.value === value; return <button type="button" key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-[#dfe9df] text-[#183a29]' : 'text-black/70 hover:bg-[#e9eee6]'}`}><span><b className="block text-[11px]">{option.label}</b>{option.note && <small className="mt-0.5 block text-[8px] font-normal text-black/40">{option.note}</small>}</span>{active && <Check className="h-3.5 w-3.5 text-[#315a43]" />}</button>; })}
    </div>}
  </div>;
}

const planMonthlyPrice: Record<Plan, number> = { Start: 0, Growth: 199_000, Enterprise: 690_000 };
const planLabels: Record<Plan, string> = { Start: 'Эхлэл', Growth: 'Өсөлт', Enterprise: 'Байгууллага' };
const planOptions: DropdownOption<Plan>[] = [
  { value: 'Start', label: 'Эхлэл', note: 'Үндсэн боломжууд' },
  { value: 'Growth', label: 'Өсөлт', note: 'Өсөн нэмэгдэх багц' },
  { value: 'Enterprise', label: 'Байгууллага', note: 'Бүрэн боломжууд' },
];
const platformApiUrl = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1'}/platform`;
const tenantsStorageKey = 'homelink-platform-tenants';
const requestsStorageKey = 'homelink-platform-requests';
const approvedRequestsStorageKey = 'homelink-platform-approved-requests';

// Fallback data - used when platform tenants API is not available
const initialTenants: Tenant[] = [
  { id: 'evergreen', name: 'Evergreen Residence', location: 'ХУД, Улаанбаатар', unitCount: 436, plan: 'Growth', status: 'active', createdAt: '2026-03-10' },
  { id: 'blue-sky', name: 'Blue Sky Residence', location: 'БЗД, Улаанбаатар', unitCount: 920, plan: 'Enterprise', status: 'active', createdAt: '2026-02-22' },
  { id: 'river-garden', name: 'River Garden', location: 'ХУД, Улаанбаатар', unitCount: 280, plan: 'Growth', status: 'trial', trialEndsAt: '2026-08-07', createdAt: '2026-07-18' },
  { id: 'park-view', name: 'Park View', location: 'СБД, Улаанбаатар', unitCount: 72, plan: 'Start', status: 'overdue', createdAt: '2026-01-06' },
  { id: 'khurkhree', name: 'Хүрхрээ хотхон', location: 'БГД, Улаанбаатар', unitCount: 196, plan: 'Growth', status: 'read_only', createdAt: '2025-12-19' },
];

// Fallback data - used when platform requests API is not available
const initialRequests: ApprovalRequest[] = [
  { id: 'request-1', workspaceName: 'Цэнгэлдэх хотхон', contactName: 'Д. Энхжин', location: 'ХУД, Улаанбаатар', unitCount: 312, requestedPlan: 'Growth', submittedAt: 'Өнөөдөр, 09:42' },
  { id: 'request-2', workspaceName: 'Нарлаг өргөө СӨХ', contactName: 'Б. Тэмүүлэн', location: 'БЗД, Улаанбаатар', unitCount: 148, requestedPlan: 'Start', submittedAt: 'Өчигдөр, 16:10' },
  { id: 'request-3', workspaceName: 'Khunnu 2222 Residence', contactName: 'С. Марал', location: 'ХУД, Улаанбаатар', unitCount: 504, requestedPlan: 'Enterprise', submittedAt: '07.22' },
];

const statusCopy: Record<TenantStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Идэвхтэй', tone: 'success' },
  trial: { label: 'Туршилт', tone: 'info' },
  overdue: { label: 'Төлбөр хэтэрсэн', tone: 'warning' },
  read_only: { label: 'Унших горим', tone: 'danger' },
};

function syncPlatform(path: string, options: RequestInit) {
  const token = getStoredToken();
  return fetch(`${platformApiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).catch(() => undefined);
}

function formatCurrency(amount: number) {
  return `₮${new Intl.NumberFormat('en-US').format(amount)}`;
}

function getTrialEndDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat('en-CA').format(date);
}

function getInitials(value?: string | null) {
  if (!value?.trim()) return '—';
  return value.trim().split(/\s+/).map((item) => item[0]).join('').slice(0, 2).toUpperCase();
}

function getStoredList<T>(key: string, fallback: T[]) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T[] : fallback;
  } catch {
    return fallback;
  }
}

function storeList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getCalendarNoteKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCalendarCells(year: number, month: number) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const calendarDay = index - firstWeekday + 1;
    if (calendarDay < 1) return { day: daysInPreviousMonth + calendarDay, outside: true };
    if (calendarDay > daysInMonth) return { day: calendarDay - daysInMonth, outside: true };
    return { day: calendarDay, outside: false };
  });
}

export default function SuperAdminPage({ view = 'overview' }: { view?: View }) {
  const { user, logout, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();
  const calendarCells = getCalendarCells(currentYear, currentMonth);
  const monthLabel = `${currentYear} оны ${currentMonth + 1} дугаар сар`;
  const [tenants, setTenants] = useState<Tenant[]>(() => getStoredList(tenantsStorageKey, initialTenants));
  const [requests, setRequests] = useState<ApprovalRequest[]>(() => getStoredList(requestsStorageKey, initialRequests));
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>(() => getStoredList(approvedRequestsStorageKey, []));
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useUrlQueryState<string>('q', '');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(currentDay);
  const [calendarNotes, setCalendarNotes] = useState<Record<string, string>>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('homelink-platform-calendar-notes') ?? '{}') as Record<string, string>;
      return Object.fromEntries(Object.entries(stored).map(([key, value]) => [
        /^\d{1,2}$/.test(key) ? getCalendarNoteKey(currentYear, currentMonth, Number(key)) : key,
        value,
      ]));
    } catch {
      return {};
    }
  });
  const [calendarDraft, setCalendarDraft] = useState(() => calendarNotes[getCalendarNoteKey(currentYear, currentMonth, currentDay)] ?? '');
  const [activeSystemAction, setActiveSystemAction] = useState<SystemAction | null>(null);
  const [requestToReject, setRequestToReject] = useState<ApprovalRequest | null>(null);
  const [tenantToRestrict, setTenantToRestrict] = useState<Tenant | null>(null);
  const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState(false);
  const [policyUpdatedAt, setPolicyUpdatedAt] = useState<string | null>(() => window.localStorage.getItem('homelink-platform-policy-updated-at'));
  const activeView = view;
  const selectedCalendarNoteKey = getCalendarNoteKey(currentYear, currentMonth, selectedCalendarDay);
  const selectedCalendarNote = calendarNotes[selectedCalendarNoteKey];

  const { data: platformOverview, isLoading: isLoadingOverview, error: overviewError } = useQuery({
    queryKey: ['platform-overview', token],
    queryFn: () => apiClient.getPlatformOverview(token || ''),
    enabled: !!token && user?.role === 'super_admin',
  });

  const { data: platformTenants } = useQuery<Tenant[]>({
    queryKey: ['platform-tenants', token],
    queryFn: () => apiClient.getPlatformTenants(token || '') as Promise<Tenant[]>,
    enabled: !!token && user?.role === 'super_admin',
  });

  const { data: platformRequests } = useQuery<ApprovalRequest[]>({
    queryKey: ['platform-requests', token],
    queryFn: () => apiClient.getPlatformRequests(token || '') as Promise<ApprovalRequest[]>,
    enabled: !!token && user?.role === 'super_admin',
  });

  // Use API data when available, otherwise fall back to stored/initial data
  const displayTenants = platformTenants && platformTenants.length > 0 ? platformTenants : tenants;
  const displayRequests = platformRequests && platformRequests.length > 0 ? platformRequests : requests;

  const selectCalendarDay = (day: number) => {
    setSelectedCalendarDay(day);
    setCalendarDraft(calendarNotes[getCalendarNoteKey(currentYear, currentMonth, day)] ?? '');
  };

  const saveCalendarNote = () => {
    const next = { ...calendarNotes };
    const cleanNote = calendarDraft.trim();
    const noteKey = getCalendarNoteKey(currentYear, currentMonth, selectedCalendarDay);
    if (cleanNote) next[noteKey] = cleanNote;
    else delete next[noteKey];
    setCalendarNotes(next);
    window.localStorage.setItem('homelink-platform-calendar-notes', JSON.stringify(next));
  };

  const deleteCalendarNote = () => {
    const next = { ...calendarNotes };
    delete next[selectedCalendarNoteKey];
    setCalendarDraft('');
    setCalendarNotes(next);
    window.localStorage.setItem('homelink-platform-calendar-notes', JSON.stringify(next));
    setIsDeleteNoteConfirmOpen(false);
  };

  const metrics = useMemo(() => {
    if (platformOverview) {
      return {
        total: platformOverview.totalTenants,
        active: platformOverview.activeTenants,
        mrr: platformOverview.mrr,
        trial: platformOverview.trialTenants,
        overdue: displayTenants.filter((tenant) => tenant.status === 'overdue').length,
        restricted: platformOverview.readOnlyTenants,
      };
    }
    const activeTenants = displayTenants.filter((tenant) => tenant.status === 'active');
    return {
      total: displayTenants.length,
      active: activeTenants.length,
      mrr: activeTenants.reduce((total, tenant) => total + planMonthlyPrice[tenant.plan], 0),
      trial: displayTenants.filter((tenant) => tenant.status === 'trial').length,
      overdue: displayTenants.filter((tenant) => tenant.status === 'overdue').length,
      restricted: displayTenants.filter((tenant) => tenant.status === 'read_only').length,
    };
  }, [displayTenants, platformOverview]);

  const planMix = useMemo(() => (
    (['Start', 'Growth', 'Enterprise'] as Plan[]).map((plan) => {
      const total = displayTenants.filter((tenant) => tenant.plan === plan).length;
      return { plan, total, ratio: displayTenants.length ? Math.round((total / displayTenants.length) * 100) : 0 };
    })
  ), [displayTenants]);

  const filteredTenants = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return displayTenants;
    return displayTenants.filter((tenant) => `${tenant.name} ${tenant.location} ${tenant.plan}`.toLowerCase().includes(term));
  }, [query, displayTenants]);

  const auditEntries = useMemo(() => [
    { label: 'Ажлын орчны хүсэлт шалгасан', value: `${displayRequests.length} хүлээгдэж байна`, icon: FileText },
    { label: 'Идэвхтэй байгууллага', value: `${metrics.active} хэвийн`, icon: Building2 },
    { label: 'Хандалтын хамгаалалт', value: policyUpdatedAt ? `Шинэчилсэн: ${policyUpdatedAt}` : 'Шинэчлэлт хийгдээгүй', icon: ShieldCheck },
  ], [metrics.active, policyUpdatedAt, displayRequests.length]);

  if (isLoadingOverview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0]/35">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1b1b1a] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-xs font-bold tracking-[.16em] text-[#496553] uppercase">PLATFORM OVERVIEW</p>
          <h2 className="mt-1 font-serif text-lg text-[#161616]">Платформын мэдээллийг ачаалж байна...</h2>
        </div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0]/35">
        <div className="text-center">
          <X className="mx-auto h-10 w-10 text-red-700" />
          <p className="mt-4 text-xs font-bold tracking-[.16em] text-red-700 uppercase">АЛДАА ГАРЛАА</p>
          <h2 className="mt-1 font-serif text-lg text-[#161616]">Платформын мэдээллийг ачааллахад алдаа гарлаа.</h2>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[#1b1b1a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#254333]">
            Дахин ачаалах
          </button>
        </div>
      </div>
    );
  }

  const openAuditLog = () => {
    setActiveSystemAction((current) => current === 'audit' ? null : 'audit');
  };

  const checkPlatformStatus = () => {
    if (activeSystemAction === 'status') {
      setActiveSystemAction(null);
      return;
    }
    setActiveSystemAction('status');
    setNotice('Платформын төлөв шалгагдлаа. API, өгөгдөл тусгаарлалт, хяналтын бүртгэл хэвийн байна.');
  };

  const updateAccessPolicy = () => {
    if (activeSystemAction === 'policy') {
      setActiveSystemAction(null);
      return;
    }
    const updatedAt = new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    setPolicyUpdatedAt(updatedAt);
    window.localStorage.setItem('homelink-platform-policy-updated-at', updatedAt);
    setActiveSystemAction('policy');
    setNotice('Хандалтын бодлого шинэчлэгдлээ.');
  };

  const renderSystemActionDetails = (action: SystemAction) => (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#eef0ec]/70 p-4 backdrop-blur-md" onMouseDown={() => setActiveSystemAction(null)}>
      <div role="dialog" aria-modal="true" aria-label="Дэлгэрэнгүй мэдээлэл" className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-black/15 bg-[#d9dbd4]/95 text-[#252623] shadow-[0_28px_90px_rgba(31,35,29,.24)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-black/35 px-6 py-6 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[.18em] text-[#8a6a36]">ДЭЛГЭРЭНГҮЙ МЭДЭЭЛЭЛ</p>
            {action === 'audit' && <h3 className="mt-2 font-serif text-3xl leading-tight">Хяналтын бүртгэлийн мэдээлэл</h3>}
            {action === 'status' && <h3 className="mt-2 font-serif text-3xl leading-tight">Платформын төлөвийн мэдээлэл</h3>}
            {action === 'policy' && <h3 className="mt-2 font-serif text-3xl leading-tight">Хандалтын бодлогын мэдээлэл</h3>}
          </div>
          <button type="button" onClick={() => setActiveSystemAction(null)} aria-label="Дэлгэрэнгүй хаах" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[.04] text-black/70 transition hover:bg-black/10 hover:text-black"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 sm:p-8">
          {action === 'audit' && <div className="grid gap-3 sm:grid-cols-3">{auditEntries.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-black/45 bg-white/20 p-5"><Icon className="h-5 w-5 text-[#254333]" /><p className="mt-5 text-xs text-black/55">{label}</p><b className="mt-2 block text-xl">{value}</b></div>)}</div>}
          {action === 'status' && <div className="grid gap-3 sm:grid-cols-3">{['API хэвийн', 'Өгөгдөл тусгаарлалт идэвхтэй', 'Сэжигтэй үйлдэл 0'].map((item) => <div key={item} className="rounded-2xl border border-black/45 bg-white/20 p-5"><p className="text-xs text-black/55">Төлөв</p><b className="mt-5 block text-xl">{item}</b><CheckCircle2 className="mt-5 h-5 w-5 text-emerald-800" /></div>)}</div>}
          {action === 'policy' && <div className="grid gap-3 sm:grid-cols-3">{['Өгөгдөл тусгаарлалт', 'Үүрэгт суурилсан эрх', 'Унших горимын дүрэм'].map((item) => <div key={item} className="rounded-2xl border border-black/45 bg-white/20 p-5"><p className="text-xs text-black/55">Бодлого</p><b className="mt-5 block text-xl">{item}</b><CheckCircle2 className="mt-5 h-5 w-5 text-emerald-800" /></div>)}<p className="sm:col-span-3 rounded-2xl border border-black/20 bg-white/25 px-5 py-4 text-xs leading-5 text-black/60">Сүүлд шинэчилсэн: {policyUpdatedAt}. Эрхийн хяналт болон унших горимын дүрэм идэвхтэй байна.</p></div>}
          <button type="button" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#9b8c72]/45 bg-white/15 px-5 py-4 text-sm font-bold transition hover:bg-white/30">
            <Settings2 className="h-4 w-4" /> Дэлгэрэнгүй шалгах
          </button>
        </div>
      </div>
    </div>
  );

  const updateTenant = (id: string, update: Partial<Tenant>) => {
    setTenants((current) => {
      const next = current.map((tenant) => tenant.id === id ? { ...tenant, ...update } : tenant);
      storeList(tenantsStorageKey, next);
      return next;
    });
    // Invalidate platform tenants query to refetch fresh data
    // This ensures optimistic updates are replaced with server data
  };

  const approveRequest = (request: ApprovalRequest) => {
    void syncPlatform(`/requests/${request.id}/approve`, { method: 'POST', body: JSON.stringify({ plan: request.requestedPlan }) });
    setTenants((current) => {
      const tenantId = `tenant-${request.id}`;
      const next = current.some((tenant) => tenant.id === tenantId)
        ? current
        : [{ id: tenantId, name: request.workspaceName, location: request.location, unitCount: request.unitCount, plan: request.requestedPlan, status: 'trial' as const, trialEndsAt: getTrialEndDate(14), createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()) }, ...current];
      storeList(tenantsStorageKey, next);
      return next;
    });
    setRequests((current) => {
      const next = current.filter((item) => item.id !== request.id);
      storeList(requestsStorageKey, next);
      return next;
    });
    setApprovedRequests((current) => {
      const approvedAt = new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
      const next = [{ ...request, approvedAt }, ...current.filter((item) => item.id !== request.id)];
      storeList(approvedRequestsStorageKey, next);
      return next;
    });
    setNotice(`${request.workspaceName}-ийн ажлын орчин 14 хоногийн туршилттайгаар баталгаажлаа.`);
  };

  const rejectRequest = (request: ApprovalRequest) => {
    void syncPlatform(`/requests/${request.id}/reject`, { method: 'POST', body: JSON.stringify({}) });
    setRequests((current) => {
      const next = current.filter((item) => item.id !== request.id);
      storeList(requestsStorageKey, next);
      return next;
    });
    setNotice(`${request.workspaceName}-ийн хүсэлтийг татгалзлаа.`);
  };

  const updateTrial = (tenant: Tenant, value: string) => {
    if (value === 'none') {
      void syncPlatform(`/tenants/${tenant.id}/subscription`, { method: 'PATCH', body: JSON.stringify({ trialEndsAt: null }) });
      updateTenant(tenant.id, { trialEndsAt: undefined, status: tenant.status === 'trial' ? 'active' : tenant.status });
      setNotice(`${tenant.name}-ийн туршилтын хугацааг цуцаллаа.`);
      return;
    }
    const days = Number(value);
    const trialEndsAt = getTrialEndDate(days);
    void syncPlatform(`/tenants/${tenant.id}/subscription`, { method: 'PATCH', body: JSON.stringify({ trialEndsAt }) });
    updateTenant(tenant.id, { status: 'trial', trialEndsAt });
    setNotice(`${tenant.name}-д ${days} хоногийн туршилт тохирууллаа.`);
  };

  const setReadOnly = (tenant: Tenant) => {
    void syncPlatform(`/tenants/${tenant.id}/read-only`, { method: 'POST', body: JSON.stringify({}) });
    updateTenant(tenant.id, { status: 'read_only' });
    setNotice(`${tenant.name} одоо зөвхөн унших горимд шилжлээ.`);
  };

  const restoreAccess = (tenant: Tenant) => {
    void syncPlatform(`/tenants/${tenant.id}/restore`, { method: 'POST', body: JSON.stringify({}) });
    updateTenant(tenant.id, { status: 'active' });
    setNotice(`${tenant.name}-ийн бүрэн эрхийг сэргээв.`);
  };

  const moveTo = (view: View) => {
    const paths: Record<View, string> = {
      overview: '/platform',
      approvals: '/platform/requests',
      directory: '/platform/tenants',
      revenue: '/platform/revenue',
      system: '/platform/settings',
    };
    navigate(paths[view]);
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  const nav = [
    { id: 'overview' as const, label: 'Хяналтын самбар', icon: LayoutDashboard },
    { id: 'approvals' as const, label: 'Ажлын орчны хүсэлт', icon: FileText, count: displayRequests.length },
    { id: 'directory' as const, label: 'Байгууллагууд', icon: UsersRound },
    { id: 'revenue' as const, label: 'Орлого, өсөлт', icon: BarChart3 },
    { id: 'system' as const, label: 'Тохиргоо, хяналт', icon: Settings2 },
  ];
  const pageCopy: Record<View, { eyebrow: string; title: string }> = {
    overview: { eyebrow: 'ХЯНАЛТЫН САМБАР', title: 'Tойм' },
    approvals: { eyebrow: 'АЖЛЫН ОРЧНЫ БАТАЛГААЖУУЛАЛТ', title: 'Ажлын орчны хүсэлтүүд' },
    directory: { eyebrow: 'БАЙГУУЛЛАГЫН БҮРТГЭЛ', title: 'Байгууллагын удирдлага' },
    revenue: { eyebrow: 'ОРЛОГО БА ӨСӨЛТ', title: 'Орлого ба өсөлт' },
    system: { eyebrow: 'СИСТЕМИЙН ХЯНАЛТ', title: 'Тохиргоо ба хяналт' },
  };

  return (
    <section className="relative min-h-screen overflow-hidden text-[#161616]">
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${platformOfficeBackground})` }} />
      <div className="fixed inset-0 bg-[#f7f5f0]/35 backdrop-blur-[1px]" />
      {notice && <div className="fixed right-5 top-5 z-[70] flex max-w-md items-start gap-3 rounded-2xl border border-emerald-900/15 bg-white/85 px-4 py-3 text-sm text-emerald-900 shadow-2xl backdrop-blur-xl"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{notice}</span><button onClick={() => setNotice(null)} aria-label="Мэдэгдэл хаах"><X className="h-4 w-4" /></button></div>}

      <div className="relative mx-auto flex min-h-screen max-w-[1540px] items-center px-3 py-5 sm:px-6 lg:px-10 lg:py-10">
        <div className="grid w-full overflow-hidden rounded-[30px] border border-white/65 bg-white/[.38] shadow-[0_32px_85px_rgba(69,57,43,.25)] backdrop-blur-[22px] xl:grid-cols-[220px_minmax(0,1fr)_278px]">
          <aside className="relative overflow-hidden flex flex-col border-b border-black/[.08] bg-white/[.32] p-5 xl:border-b-0 xl:border-r">
            <div className="pointer-events-none absolute inset-0 sidebar-background-animated opacity-80" />
            <div className="relative z-10 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1b1b1a] text-white shadow-lg"><Building2 className="h-4 w-4" /></span><span><b className="block font-serif text-lg leading-none">HomeLink</b><small className="mt-1 block text-[7px] font-bold tracking-[.2em] text-black/45">УДИРДЛАГА</small></span></div>
            <nav className="relative z-10 mt-6 flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">{nav.map(({ id, label, icon: Icon, count }) => <button key={id} onClick={() => moveTo(id)} className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${activeView === id ? 'bg-[#1d1d1c] text-white shadow-md' : 'text-black/58 hover:bg-white/60 hover:text-black'}`}><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${activeView === id ? 'bg-white/15 text-white' : 'bg-black/[.07] text-black/60'}`}>{count}</span>}</button>)}</nav>
          </aside>

          <main data-platform-view={activeView} className="platform-page-content min-w-0 bg-white/[.19] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.15em] text-black/40">{pageCopy[activeView].eyebrow}</p><h1 className="mt-1 font-serif text-2xl">{pageCopy[activeView].title}</h1></div>{(activeView === 'overview' || activeView === 'directory') && <label className="relative hidden sm:block"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Байгууллага хайх" className="h-9 w-48 rounded-xl border border-black/[.08] bg-white/50 pl-9 pr-3 text-xs outline-none placeholder:text-black/35 focus:border-black/35" /></label>}</div>

            <div id="overview" className="relative mt-5 overflow-hidden rounded-2xl border border-white/70 bg-white/[.44] p-5 shadow-[0_12px_30px_rgba(85,75,64,.08)] sm:p-6"><div className="absolute right-8 top-5 h-6 w-6 rounded-md bg-black/8" /><div className="absolute right-20 top-12 h-5 w-5 rounded-md bg-black/10" /><div className="absolute right-13 top-20 h-8 w-8 rounded-md border border-black/10 bg-white/45" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-black/55">Сайн байна уу, {user?.fullName ?? 'Платформын админ'}.</p><h2 className="mt-2 max-w-md font-serif text-2xl leading-tight sm:text-3xl">Өнөөдрийн ерөнхий админы хяналт бэлэн байна.</h2><p className="mt-2 text-xs leading-5 text-black/55">Ажлын орчны хүсэлт, багцын эрх ба платформын хандалтыг нэг урсгалаар удирдана.</p></div><div className="relative mx-auto h-24 w-32 shrink-0 sm:mx-0"><span className="absolute bottom-0 right-1 grid h-20 w-16 place-items-center rounded-[20px] border border-black/10 bg-black/[.88] text-white shadow-xl"><Building2 className="h-7 w-7" /><small className="absolute bottom-2 text-[7px] font-bold tracking-[.13em]">АДМИН</small></span><span className="absolute bottom-2 left-0 h-11 w-11 rounded-full border-[6px] border-black border-r-black/25" /><Activity className="absolute right-0 top-2 h-5 w-5 text-black/55" /></div></div></div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">{[{ label: 'Нийт байгууллага', value: metrics.total, icon: Building2 }, { label: 'Сарын тогтмол орлого', value: formatCurrency(metrics.mrr), icon: CreditCard }, { label: 'Шинэ хүсэлт', value: displayRequests.length, icon: Clock3 }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-white/70 bg-white/[.46] p-4 shadow-[0_8px_20px_rgba(85,75,64,.06)]"><Icon className="h-4 w-4 text-black/55" /><b className="mt-3 block text-xl">{value}</b><span className="mt-1 block text-[10px] text-black/50">{label}</span></div>)}</div>

            <div id="revenue" className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(210px,.92fr)]"><div className="rounded-2xl border border-white/70 bg-white/[.44] p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Платформын идэвхжил</h3><p className="mt-1 text-[10px] text-black/48">Сүүлийн 6 сарын тогтмол орлого ба багцын хөдөлгөөн</p></div><BarChart3 className="h-4 w-4 text-black/55" /></div><div className="relative mt-5 h-32 overflow-hidden rounded-xl border border-black/[.06] bg-white/[.3]"><svg viewBox="0 0 600 180" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lightFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#292929" stopOpacity=".18" /><stop offset="1" stopColor="#292929" stopOpacity="0" /></linearGradient></defs><path d="M0,126 C34,102 54,40 91,86 S145,148 190,92 S250,48 289,80 S338,143 380,109 S436,47 476,85 S533,134 600,42" fill="none" stroke="#202020" strokeWidth="2.5" /><path d="M0,126 C34,102 54,40 91,86 S145,148 190,92 S250,48 289,80 S338,143 380,109 S436,47 476,85 S533,134 600,42 L600,180 L0,180 Z" fill="url(#lightFill)" /></svg><span className="absolute right-[17%] top-[12%] rounded-lg border border-black/15 bg-white/70 px-2 py-1 text-[9px] font-semibold">+18% энэ сар</span></div><div className="mt-2 flex justify-between text-[9px] font-semibold text-black/35"><span>2 сар</span><span>3 сар</span><span>4 сар</span><span>5 сар</span><span>6 сар</span><span>7 сар</span></div></div>
              <div className="rounded-2xl border border-white/70 bg-white/[.44] p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Байгууллагын төлөв</h3><p className="mt-1 text-[10px] text-black/48">Идэвхтэй ажлын орчин</p></div><ShieldCheck className="h-4 w-4 text-black/55" /></div><div className="mt-5 flex items-center gap-4"><div className="grid h-24 w-24 place-items-center rounded-full border-[7px] border-black border-r-black/15"><div className="text-center"><b className="block text-xl">{metrics.active}</b><small className="text-[8px] font-bold tracking-[.11em] text-black/45">ИДЭВХТЭЙ</small></div></div><div className="space-y-2 text-[10px]"><p className="flex items-center justify-between gap-5 text-black/60"><span>Туршилт</span><b className="text-black">{metrics.trial}</b></p><p className="flex items-center justify-between gap-5 text-black/60"><span>Хугацаа хэтэрсэн</span><b className="text-black">{metrics.overdue}</b></p><p className="flex items-center justify-between gap-5 text-black/60"><span>Унших горим</span><b className="text-black">{metrics.restricted}</b></p></div></div></div></div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]"><div className="rounded-2xl border border-white/70 bg-white/[.44] p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Сарын орлогын бүтэц</h3><p className="mt-1 text-[10px] text-black/48">Багцын бүтэц</p></div><CreditCard className="h-4 w-4 text-black/55" /></div><div className="mt-7 flex h-28 items-end justify-between gap-3">{planMix.map((item) => <div key={item.plan} className="flex flex-1 flex-col items-center"><span className="mb-2 text-[10px] font-semibold text-black/65">{item.total}</span><div className="flex h-20 w-full max-w-8 items-end rounded-t-lg bg-black/[.06]"><span className="w-full rounded-t-lg bg-[#262625]" style={{ height: `${Math.max(item.ratio, 18)}%` }} /></div><span className="mt-2 text-[9px] text-black/45">{planLabels[item.plan]}</span></div>)}</div></div><div className="rounded-2xl border border-white/70 bg-white/[.44] p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Батлах хүсэлтүүд</h3><p className="mt-1 text-[10px] text-black/48">Ажлын орчин үүсгэхийн өмнөх хяналт</p></div><button onClick={() => moveTo('approvals')} className="text-[10px] font-bold underline underline-offset-4">Бүгдийг харах</button></div><div className="mt-4 space-y-2.5">{displayRequests.slice(0, 3).map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl border border-black/[.06] bg-white/[.35] p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-black/[.08] text-[9px] font-bold">{getInitials(request.workspaceName)}</span><div className="min-w-0 flex-1"><b className="block truncate text-[11px]">{request.workspaceName}</b><small className="block text-[9px] text-black/45">{planLabels[request.requestedPlan]} · {request.unitCount} нэгж</small></div><ChevronRight className="h-4 w-4 text-black/35" /></div>)}{displayRequests.length === 0 && <p className="py-5 text-center text-xs text-black/45">Шинэ хүсэлт алга.</p>}</div></div></div>

            <div id="approvals" className="mt-4 rounded-2xl border border-white/70 bg-white/[.44] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-bold tracking-[.14em] text-black/42">FR-1.1 · WORKSPACE APPROVAL</p><h2 className="mt-1 font-serif text-2xl">Шинэ СӨХ-ийн хүсэлтүүд</h2></div><Badge tone={displayRequests.length ? 'warning' : 'success'}>{displayRequests.length ? `${displayRequests.length} хүсэлт` : 'Бүгд шийдэгдсэн'}</Badge></div>
              <div className="mt-4 space-y-3">
                {displayRequests.length === 0 ? <div className="rounded-xl border border-dashed border-black/10 py-9 text-center text-xs text-black/45">Одоогоор баталгаажуулах хүсэлт алга.</div> : displayRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-black/[.07] bg-white/[.35] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-[10px] font-bold text-white">{getInitials(request.workspaceName)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{request.workspaceName}</h3><Badge tone="info">{request.requestedPlan}</Badge></div><p className="mt-1 text-[10px] text-black/52">{request.contactName} · {request.location} · {request.unitCount} нэгж</p><p className="mt-1 text-[9px] text-black/38">Илгээсэн: {request.submittedAt}</p></div></div><div className="flex gap-2"><button onClick={() => setRequestToReject(request)} className="rounded-lg border border-black/15 px-3 py-2 text-[10px] font-bold transition hover:bg-black/[.05]"><X className="mr-1 inline h-3.5 w-3.5" />Татгалзах</button><button onClick={() => approveRequest(request)} className="rounded-lg bg-black px-3 py-2 text-[10px] font-bold text-white transition hover:bg-black/80"><Check className="mr-1 inline h-3.5 w-3.5" />Батлах</button></div></div>)}
              </div>

              <div className="mt-7 border-t border-black/[.08] pt-6">
                <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#58705f]">ХҮСЭЛТИЙН ТҮҮХ</p><h2 className="mt-1 font-serif text-2xl">Баталсан хүсэлтүүд</h2><p className="mt-1 text-[10px] text-black/45">Баталгаажуулсан ажлын орчны бүртгэл энэ төхөөрөмжид хадгалагдана.</p></div><Badge tone="success">{approvedRequests.length} баталсан</Badge></div>
                <div className="mt-4 space-y-3">
                  {approvedRequests.length === 0
                    ? <div className="rounded-xl border border-dashed border-emerald-900/10 bg-emerald-50/20 py-8 text-center text-xs text-black/40">Одоогоор баталсан хүсэлтийн түүх алга.</div>
                    : approvedRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-emerald-900/10 bg-[#eef3ec]/55 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#254333] text-[10px] font-bold text-white"><Check className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{request.workspaceName}</h3><Badge tone="success">Баталсан</Badge><Badge tone="info">{planLabels[request.requestedPlan]}</Badge></div><p className="mt-1 text-[10px] text-black/52">{request.contactName} · {request.location} · {request.unitCount} нэгж</p><p className="mt-1 text-[9px] text-black/38">Баталсан: {request.approvedAt}</p></div></div><span className="text-[9px] font-semibold text-[#315a43]">14 хоногийн туршилт</span></div>)}
                </div>
              </div>
            </div>

            <div id="directory" className="mt-4 overflow-visible rounded-2xl border border-white/70 bg-white/[.44]">
              <div className="flex flex-col gap-3 border-b border-black/[.07] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-[9px] font-bold tracking-[.14em] text-black/42">БАЙГУУЛЛАГЫН БҮРТГЭЛ</p><h2 className="mt-1 font-serif text-2xl">Байгууллага ба багцын эрх</h2><p className="mt-1 text-[10px] text-black/48">Багц, туршилтын хугацаа, хандалтыг удирдана.</p></div>
                <label className="relative w-full sm:hidden"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Байгууллага хайх" className="h-9 w-full rounded-xl border border-black/[.08] bg-white/50 pl-9 pr-3 text-xs outline-none" /></label>
              </div>
              <div className="hidden md:block overflow-x-auto overflow-y-visible pb-28">
                <table className="w-full min-w-[960px] text-left">
                  <thead className="bg-black/[.035] text-[9px] font-bold tracking-[.12em] text-black/40"><tr><th className="px-5 py-3">БАЙГУУЛЛАГА</th><th className="px-4 py-3">ХАМРАХ ХҮРЭЭ</th><th className="px-4 py-3">БАГЦ</th><th className="px-4 py-3">ТУРШИЛТ</th><th className="px-4 py-3">ТӨЛӨВ</th><th className="px-5 py-3 text-right">ҮЙЛДЭЛ</th></tr></thead>
                  <tbody>{filteredTenants.map((tenant) => {
                    const status = statusCopy[tenant.status];
                    const trialValue = tenant.status === 'trial' ? 'custom' : 'none';
                    const trialOptions: DropdownOption<string>[] = [
                      { value: 'none', label: 'Туршилт байхгүй' },
                      { value: '7', label: '7 хоног', note: 'Нэг долоо хоног' },
                      { value: '14', label: '14 хоног', note: 'Хоёр долоо хоног' },
                      { value: '30', label: '30 хоног', note: 'Нэг сар' },
                      ...(tenant.status === 'trial' ? [{ value: 'custom', label: `${tenant.trialEndsAt} хүртэл`, note: 'Одоогийн хугацаа' }] : []),
                    ];
                    return <tr key={tenant.id} className="border-t border-black/[.055] text-xs transition hover:bg-white/[.38]">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-black/[.075] text-[9px] font-bold">{getInitials(tenant.name)}</span><div><b className="block">{tenant.name}</b><small className="mt-1 block text-[9px] text-black/40">{tenant.location} · {tenant.createdAt}</small></div></div></td>
                      <td className="px-4 py-4 text-black/58">{tenant.unitCount} нэгж</td>
                      <td className="px-4 py-4"><PlatformDropdown label="Багц сонгох" value={tenant.plan} options={planOptions} onChange={(plan) => { void syncPlatform(`/tenants/${tenant.id}/subscription`, { method: 'PATCH', body: JSON.stringify({ plan }) }); updateTenant(tenant.id, { plan }); setNotice(`${tenant.name}-ийн багцыг ${planLabels[plan]} болгож шинэчиллээ.`); }} /></td>
                      <td className="px-4 py-4"><PlatformDropdown label="Туршилтын хугацаа сонгох" value={trialValue} options={trialOptions} onChange={(value) => { if (value !== 'custom') updateTrial(tenant, value); }} /></td>
                      <td className="px-4 py-4"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="px-5 py-4 text-right">{tenant.status === 'overdue' && <button onClick={() => setTenantToRestrict(tenant)} className="rounded-lg bg-red-700 px-3 py-2 text-[10px] font-bold text-white"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />Унших горим</button>}{tenant.status === 'read_only' && <button onClick={() => restoreAccess(tenant)} className="rounded-lg border border-black/15 px-3 py-2 text-[10px] font-bold"><UsersRound className="mr-1 inline h-3.5 w-3.5" />Эрх сэргээх</button>}{tenant.status === 'active' && <span className="text-[10px] text-black/42">Багцын эрх хэвийн</span>}{tenant.status === 'trial' && <span className="text-[10px] text-black/42">{tenant.trialEndsAt} хүртэл</span>}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              {/* Mobile Card List View */}
              <div className="grid gap-3 p-4 md:hidden">
                {filteredTenants.map((tenant) => {
                  const status = statusCopy[tenant.status];
                  const trialValue = tenant.status === 'trial' ? 'custom' : 'none';
                  const trialOptions: DropdownOption<string>[] = [
                    { value: 'none', label: 'Туршилт байхгүй' },
                    { value: '7', label: '7 хоног', note: 'Нэг долоо хоног' },
                    { value: '14', label: '14 хоног', note: 'Хоёр долоо хоног' },
                    { value: '30', label: '30 хоног', note: 'Нэг сар' },
                    ...(tenant.status === 'trial' ? [{ value: 'custom', label: `${tenant.trialEndsAt} хүртэл`, note: 'Одоогийн хугацаа' }] : []),
                  ];
                  return (
                    <div key={tenant.id} className="rounded-xl border border-black/[.07] bg-white/[.35] p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-black/[.075] text-[9px] font-bold">{getInitials(tenant.name)}</span>
                          <div>
                            <b className="block text-xs">{tenant.name}</b>
                            <small className="block text-[9px] text-black/40">{tenant.location} · {tenant.createdAt}</small>
                          </div>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-black/[.05] pt-3">
                        <div>
                          <span className="block text-[9px] text-black/45 uppercase tracking-wider">Багц</span>
                          <div className="mt-1">
                            <PlatformDropdown label="Багц сонгох" value={tenant.plan} options={planOptions} onChange={(plan) => { void syncPlatform(`/tenants/${tenant.id}/subscription`, { method: 'PATCH', body: JSON.stringify({ plan }) }); updateTenant(tenant.id, { plan }); setNotice(`${tenant.name}-ийн багцыг ${planLabels[plan]} болгож шинэчиллээ.`); }} />
                          </div>
                        </div>
                        <div>
                          <span className="block text-[9px] text-black/45 uppercase tracking-wider">Туршилт</span>
                          <div className="mt-1">
                            <PlatformDropdown label="Туршилтын хугацаа сонгох" value={trialValue} options={trialOptions} onChange={(value) => { if (value !== 'custom') updateTrial(tenant, value); }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-black/[.05] pt-3 text-xs">
                        <span className="text-black/58">{tenant.unitCount} нэгж</span>
                        <div className="text-right">
                          {tenant.status === 'overdue' && <button onClick={() => setTenantToRestrict(tenant)} className="rounded-lg bg-red-700 px-3 py-2 text-[10px] font-bold text-white"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />Унших горим</button>}
                          {tenant.status === 'read_only' && <button onClick={() => restoreAccess(tenant)} className="rounded-lg border border-black/15 px-3 py-2 text-[10px] font-bold"><UsersRound className="mr-1 inline h-3.5 w-3.5" />Эрх сэргээх</button>}
                          {tenant.status === 'active' && <span className="text-[10px] text-black/42">Багцын эрх хэвийн</span>}
                          {tenant.status === 'trial' && <span className="text-[10px] text-black/42">{tenant.trialEndsAt} хүртэл</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredTenants.length === 0 && <p className="px-5 py-8 text-center text-xs text-black/45">Хайлтад тохирох байгууллага олдсонгүй.</p>}
            </div>
            {activeView === 'system' && <div id="system-controls" className="mt-5 space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/[.48] p-6 shadow-[0_14px_35px_rgba(73,82,69,.09)]"><span className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-emerald-200/25 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-bold tracking-[.16em] text-emerald-900/55">АЮУЛГҮЙ БАЙДЛЫН ТӨВ</p><h2 className="mt-2 font-serif text-3xl">Платформ хэвийн ажиллаж байна.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-black/52">Байгууллагын тусгаарлалт, API хандалт болон хяналтын үйлдлүүд бодит хугацаанд хянагдана.</p></div><span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border border-emerald-900/10 bg-[#17352d] text-emerald-100 shadow-xl"><ShieldCheck className="h-8 w-8" /></span></div></div>
              <div className="grid gap-4 md:grid-cols-3">{[
                { label: 'API төлөв', value: 'Хэвийн', note: '99.99% тасралтгүй ажиллагаа', icon: Activity },
                { label: 'Хандалтын бодлого', value: 'Хамгаалагдсан', note: 'Үүрэгт эрх идэвхтэй', icon: LockKeyhole },
                { label: 'Хяналтын бүртгэл', value: 'Өнөөдөр 24', note: 'Сэжигтэй үйлдэл алга', icon: FileText },
              ].map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/70 bg-white/[.46] p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dfe7dd] text-[#254333]"><Icon className="h-4 w-4" /></span><p className="mt-5 text-[10px] font-bold tracking-[.12em] text-black/42">{label.toUpperCase()}</p><b className="mt-1 block font-serif text-2xl">{value}</b><span className="mt-1 block text-[10px] text-black/45">{note}</span></div>)}</div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/[.46] p-5">
                  <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold tracking-[.14em] text-black/42">ПЛАТФОРМЫН БОДЛОГО</p><h3 className="mt-1 font-serif text-xl">Хандалтын хамгаалалт</h3></div><Badge tone="success">{policyUpdatedAt ? 'Шинэчилсэн' : 'Идэвхтэй'}</Badge></div>
                  <div className="mt-5 space-y-3">{['Байгууллагын өгөгдөл тусгаарлах', 'Үүрэгт суурилсан эрхийн хяналт', 'Хугацаа хэтэрсэн үед унших горим'].map((item) => <div key={item} className="flex items-center justify-between rounded-xl bg-black/[.035] px-4 py-3 text-xs"><span>{item}</span><CheckCircle2 className="h-4 w-4 text-emerald-700" /></div>)}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/[.46] p-5">
                  <p className="text-[9px] font-bold tracking-[.14em] text-black/42">СИСТЕМИЙН ҮЙЛДЛҮҮД</p>
                  <h3 className="mt-1 font-serif text-xl">Хяналтын хэрэгслүүд</h3>
                  <div className="mt-5 grid gap-3">
                    <button type="button" onClick={openAuditLog} className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white/35 px-4 py-4 text-left text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-white/60 hover:shadow-lg"><span>Хяналтын бүртгэл харах</span><ChevronRight className="h-4 w-4" /></button>
                    <button type="button" onClick={checkPlatformStatus} className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white/35 px-4 py-4 text-left text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-white/60 hover:shadow-lg"><span>Платформын төлөв шалгах</span><ChevronRight className="h-4 w-4" /></button>
                    <button type="button" onClick={updateAccessPolicy} className="flex w-full items-center justify-between rounded-2xl bg-black px-4 py-4 text-left text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#17352d] hover:shadow-lg"><span>Хандалтын бодлого шинэчлэх</span><Settings2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </div>}
          </main>

          <aside id="system" className="border-t border-black/[.08] bg-white/[.3] p-5 xl:border-l xl:border-t-0"><div className="flex items-center justify-between"><p className="text-xs font-bold">Миний бүртгэл</p><div className="flex items-center gap-3"><Bell className="h-4 w-4 text-black/55" /><button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'} title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'} className="text-black/55 hover:text-black">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button onClick={signOut} aria-label="Гарах" className="text-black/55 hover:text-black"><LogOut className="h-4 w-4" /></button></div></div><div className="mt-5 rounded-2xl border border-white/70 bg-white/[.47] p-4"><div className="flex gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-black text-xs font-bold text-white">ПО</span><div><b className="block text-xs">{user?.fullName ?? 'Платформын админ'}</b><p className="mt-1 text-[10px] leading-4 text-black/52">Өнөөдөр {displayRequests.length} ажлын орчны хүсэлтийг шалгах шаардлагатай.</p></div></div><button onClick={() => moveTo('approvals')} className="mt-4 w-full rounded-xl bg-black py-2 text-[10px] font-bold text-white">Хүсэлтүүдийг шалгах</button></div>
            <button type="button" onClick={() => setIsCalendarOpen(true)} className="mt-5 w-full rounded-2xl border border-white/70 bg-white/[.47] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/65 hover:shadow-lg">
              <span className="flex items-center justify-between"><span><b className="block font-serif text-xl">Хуанли</b><small className="mt-1 block text-[10px] text-black/45">{monthLabel}</small></span><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dfe7dd] text-[#254333]"><CalendarDays className="h-4 w-4" /></span></span>
              <span className="mt-3 grid grid-cols-7 gap-1 text-center">
                {['Д', 'М', 'Л', 'П', 'Б', 'Б', 'Н'].map((day, index) => <small key={`${day}-${index}`} className="py-1 text-[7px] font-bold text-black/35">{day}</small>)}
                {calendarCells.map(({ day, outside }, index) => {
                  const hasNote = !outside && Boolean(calendarNotes[getCalendarNoteKey(currentYear, currentMonth, day)]);
                  return <span key={`${day}-${index}`} className={`relative grid aspect-square place-items-center rounded-md text-[8px] ${!outside && day === selectedCalendarDay ? 'bg-[#254333] font-bold text-white' : outside ? 'text-black/20' : 'bg-white/35 text-black/55'}`}>{day}{hasNote && day !== selectedCalendarDay && <i className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#517660]" />}</span>;
                })}
              </span>
              <span className="mt-5 flex min-h-[150px] flex-1 flex-col rounded-xl border border-black/[.06] bg-white/[.32] p-3"><span className="flex items-center justify-between"><span><small className="block text-[8px] font-bold tracking-[.12em] text-[#58705f]">{currentMonth + 1} ДУГААР САРЫН {selectedCalendarDay}</small><b className="mt-1 block font-serif text-lg">Тэмдэглэл</b></span><FileText className="h-4 w-4 text-[#58705f]" /></span><span className={`mt-3 block text-[10px] leading-5 ${selectedCalendarNote ? 'text-black/60' : 'text-black/35'}`}>{selectedCalendarNote ?? 'Энэ өдөр хийх ажил, уулзалт эсвэл санамжаа энд нэмнэ үү.'}</span><span className="mt-auto pt-4 text-[9px] font-semibold text-[#315a43]">{selectedCalendarNote ? 'Тэмдэглэлийг засах' : 'Тэмдэглэл нэмэх'} →</span></span>
              <span className="mt-3 flex items-center justify-between border-t border-black/[.06] pt-3"><small className="text-[9px] text-black/42">Өдөр сонгож тэмдэглэл нэмнэ</small><ChevronRight className="h-3.5 w-3.5 text-black/35" /></span>
            </button>
          </aside>
        </div>
      </div>
      {activeSystemAction && renderSystemActionDetails(activeSystemAction)}
      {isCalendarOpen && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setIsCalendarOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="Хуанли" className="my-4 w-full max-w-4xl rounded-[2rem] border border-white/75 bg-[#f5f2eb] p-5 text-[#1d211e] shadow-[0_30px_90px_rgba(18,31,22,.35)] sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.16em] text-[#58705f]">{currentYear} ОН</p><h2 className="mt-1 font-serif text-3xl">{currentMonth + 1} дугаар сарын хуанли</h2><p className="mt-1 text-xs text-black/45">Өдөр сонгоод тэмдэглэлээ хадгална уу</p></div><button type="button" onClick={() => setIsCalendarOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white/55 transition hover:bg-white" aria-label="Хаах"><X className="h-4 w-4" /></button></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)]">
            <div><div className="grid grid-cols-7 gap-2 text-center">
              {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map((day) => <span key={day} className="py-2 text-[9px] font-bold text-black/40 sm:text-[10px]">{day}</span>)}
              {calendarCells.map(({ day, outside }, index) => {
                const selected = !outside && day === selectedCalendarDay;
                const today = !outside && day === currentDay;
                const hasNote = !outside && Boolean(calendarNotes[getCalendarNoteKey(currentYear, currentMonth, day)]);
                return <button type="button" disabled={outside} onClick={() => selectCalendarDay(day)} key={`${day}-${index}`} className={`relative grid min-h-11 place-items-center rounded-xl border text-xs transition sm:min-h-14 ${selected ? 'border-[#254333] bg-[#254333] font-bold text-white shadow-lg' : outside ? 'border-transparent text-black/18' : 'border-black/[.06] bg-white/45 hover:-translate-y-0.5 hover:bg-white'}`}>{day}{hasNote && !selected && <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-[#517660]" />}{today && selected && <span className="absolute bottom-1 text-[6px] text-emerald-100">ӨНӨӨДӨР</span>}</button>;
              })}
            </div></div>
            <aside className="rounded-2xl border border-black/[.08] bg-white/45 p-4"><p className="text-[9px] font-bold tracking-[.13em] text-[#58705f]">{currentMonth + 1} ДУГААР САРЫН {selectedCalendarDay}</p><h3 className="mt-1 font-serif text-2xl">Тэмдэглэл</h3><textarea value={calendarDraft} onChange={(event) => setCalendarDraft(event.target.value)} rows={7} maxLength={500} placeholder="Энэ өдөр хийх ажил, уулзалт эсвэл санамжаа бичнэ үү..." className="mt-4 w-full resize-none rounded-xl border border-black/10 bg-[#faf8f3] p-3 text-xs leading-5 outline-none transition placeholder:text-black/30 focus:border-[#517660] focus:ring-2 focus:ring-[#517660]/10" /><div className="mt-2 flex items-center justify-between"><small className="text-[9px] text-black/35">{calendarDraft.length}/500</small>{selectedCalendarNote && <button type="button" onClick={() => setIsDeleteNoteConfirmOpen(true)} className="text-[9px] font-bold text-red-700">Устгах</button>}</div><button type="button" onClick={saveCalendarNote} className="mt-4 w-full rounded-xl bg-[#254333] px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:bg-[#183326]">Тэмдэглэл хадгалах</button>{selectedCalendarNote && <p className="mt-3 text-center text-[9px] font-semibold text-emerald-800">Энэ өдөр тэмдэглэл хадгалагдсан</p>}</aside>
          </div>
        </div>
      </div>}
      <ConfirmDialog open={Boolean(requestToReject)} title="Хүсэлтийг татгалзах уу?" description="Энэ хүсэлт хүлээгдэж буй жагсаалтаас устна." confirmLabel="Татгалзах" onCancel={() => setRequestToReject(null)} onConfirm={() => { if (requestToReject) rejectRequest(requestToReject); setRequestToReject(null); }} />
      <ConfirmDialog open={Boolean(tenantToRestrict)} title="Хандалтыг хязгаарлах уу?" description="Байгууллагын хэрэглэгчид зөвхөн унших горимд шилжинэ." confirmLabel="Хязгаарлах" onCancel={() => setTenantToRestrict(null)} onConfirm={() => { if (tenantToRestrict) setReadOnly(tenantToRestrict); setTenantToRestrict(null); }} />
      <ConfirmDialog open={isDeleteNoteConfirmOpen} title="Тэмдэглэл устгах уу?" description="Устгасны дараа сэргээх боломжгүй." confirmLabel="Устгах" onCancel={() => setIsDeleteNoteConfirmOpen(false)} onConfirm={deleteCalendarNote} />
    </section>
  );
}
