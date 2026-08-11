import { useEffect, useState } from 'react';
import { Bell, Building2, ChevronDown, ChevronsUpDown, CircleHelp, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Search, Settings, Sun, Moon, Users, Wallet, Wrench, X, Zap } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type ManagerNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  route: string;
  read: boolean;
  tone: 'payment' | 'maintenance' | 'billing' | 'info';
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

const navigation = [
  { label: 'Хяналтын самбар', icon: LayoutDashboard, to: '/manager' },
  { label: 'Барилга, байр', icon: Building2, to: '/manager/buildings' },
  { label: 'Оршин суугчид', icon: Users, to: '/manager/residents' },
  { label: 'Төлбөр, нэхэмжлэл', icon: Wallet, to: '/manager/billing' },
  { label: 'Гүйлгээ', icon: CreditCard, to: '/manager/payments' },
  { label: 'Тоолуурын заалт', icon: Zap, to: '/manager/meters' },
  { label: 'Засвар үйлчилгээ', icon: Wrench, to: '/manager/maintenance' },
  { label: 'Тайлан, баримт', icon: FileText, to: '/manager/reports' },
];

function notificationIcon(tone: ManagerNotification['tone']) {
  if (tone === 'payment') return CreditCard;
  if (tone === 'maintenance') return Wrench;
  if (tone === 'billing') return Wallet;
  return Bell;
}

export default function AdminLayout() {
  const { user, token, logout } = useAuth();
  const userInitial = Array.from((user?.fullName ?? '').trim())[0]?.toLocaleUpperCase('mn-MN') ?? 'Х';
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ManagerNotification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`${apiBaseUrl}/notifications`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data as Array<Record<string, unknown>> : [];
        setNotifications(rows.map((row) => ({ id: String(row.id), title: String(row.title), message: String(row.body), route: typeof row.route === 'string' ? row.route : '/manager', time: new Date(String(row.createdAt)).toLocaleString('mn-MN'), read: Boolean(row.readAt), tone: row.type === 'payment' || row.type === 'maintenance' || row.type === 'billing' ? row.type : 'info' })));
      }).catch(() => setNotifications([]));
  }, [token]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  useEffect(() => {
    const handleLiveNotification = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      const tone = detail.type === 'payment' || detail.type === 'maintenance' || detail.type === 'billing' ? detail.type : 'info';
      const notification: ManagerNotification = { id: String(detail.id), title: String(detail.title), message: String(detail.body), route: typeof detail.route === 'string' ? detail.route : '/manager', time: 'Саяхан', read: false, tone };
      setNotifications((current) => {
        const next = [notification, ...current.filter((item) => item.id !== notification.id)];
        return next;
      });
    };
    window.addEventListener('homelink:live-notification', handleLiveNotification);
    return () => window.removeEventListener('homelink:live-notification', handleLiveNotification);
  }, []);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const filteredNotifications = notifications.filter((notification) => notificationFilter === 'all' || (notificationFilter === 'read' ? notification.read : !notification.read));

  const saveNotifications = (nextNotifications: ManagerNotification[]) => {
    setNotifications(nextNotifications);
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  const markAllNotificationsRead = () => {
    saveNotifications(notifications.map((notification) => ({ ...notification, read: true })));
    if (token) void fetch(`${apiBaseUrl}/notifications/read-all`, { method: 'PATCH', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  };

  const clearNotifications = () => {
    saveNotifications([]);
    if (token) void fetch(`${apiBaseUrl}/notifications`, { method: 'DELETE', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  };

  const openNotification = (notification: ManagerNotification) => {
    saveNotifications(notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    if (token) void fetch(`${apiBaseUrl}/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
    setIsNotificationsOpen(false);
    navigate(notification.route.startsWith('/manager') ? notification.route : '/manager');
  };

  const sidebar = (
    <aside className="workspace-chrome flex h-full w-72 flex-col border-r px-4 py-5 shadow-[14px_0_45px_rgba(0,0,0,.22)] lg:w-[82px] lg:px-3">
      <div className="flex items-center justify-between px-2 lg:justify-center lg:px-0">
        <NavLink to="/" className="group relative flex items-center gap-3" aria-label="HomeLink нүүр хуудас">
          <span className="grid h-9 w-9 place-items-center text-sand"><Building2 className="h-5 w-5" strokeWidth={1.75} /></span>
          <span className="lg:hidden"><b className="block font-serif text-base text-cream">HomeLink</b><small className="block text-[8px] font-bold tracking-[.2em] text-sand-400">MANAGEMENT</small></span>
          <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-sand/20 bg-[#3a3734] px-2.5 py-1.5 text-[10px] font-bold text-sand-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">HomeLink</span>
        </NavLink>
        <button className="text-sand-400 lg:hidden" onClick={() => setIsMobileOpen(false)} aria-label="Цэс хаах"><X className="h-5 w-5" /></button>
      </div>

      <div className="relative mt-8 lg:mt-7">
        <button onClick={() => setIsWorkspaceOpen((open) => !open)} className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[.035] px-3 py-3 text-left transition-colors hover:border-sand/25 hover:bg-sand/[.07] lg:justify-center lg:px-0" aria-label="Workspace солих">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sand/20 bg-sand/15 text-xs font-bold text-sand">ER</span>
          <span className="min-w-0 flex-1 lg:hidden"><b className="block truncate text-xs text-cream">Evergreen Residence</b><small className="block text-[9px] text-sand-400">Manager workspace</small></span>
          <ChevronsUpDown className="h-4 w-4 text-sand-400 lg:hidden" />
          <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-sand/20 bg-[#3a3734] px-2.5 py-1.5 text-[10px] font-bold text-sand-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">Evergreen Residence</span>
        </button>
        {isWorkspaceOpen && <div className="absolute z-30 mt-2 w-full rounded-xl border border-sand/20 bg-[#3a3734] p-2 shadow-2xl lg:left-[calc(100%+12px)] lg:top-0 lg:mt-0 lg:w-64"><button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs text-cream hover:bg-white/7"><span className="grid h-6 w-6 place-items-center rounded-md bg-sand/15 text-[9px] text-sand">ER</span>Evergreen Residence</button><button className="mt-1 w-full rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-left text-xs text-sand-300 hover:bg-white/7">+ Шинэ workspace</button></div>}
      </div>

      <nav className="mt-7 space-y-1">
        <p className="px-3 pb-2 text-[9px] font-bold tracking-[.18em] text-sand-500 lg:hidden">ҮНДСЭН ЦЭС</p>
        {navigation.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.label} to={item.to} end aria-label={item.label} onClick={() => setIsMobileOpen(false)} className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all lg:justify-center lg:px-0 ${isActive ? 'border border-sand/20 bg-sand/[.12] text-sand shadow-[inset_2px_0_0_#c5a880,0_0_18px_rgba(197,168,128,.06)]' : 'text-sand-400 hover:bg-white/5 hover:text-cream'}`}><Icon className="h-4 w-4 shrink-0" /><span className="lg:hidden">{item.label}</span><span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-sand/20 bg-[#3a3734] px-2.5 py-1.5 text-[10px] font-bold text-sand-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">{item.label}</span></NavLink>;
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-sand/15 pt-4">
        <NavLink to="/manager/settings" aria-label="Тохиргоо" onClick={() => setIsMobileOpen(false)} className={({ isActive }) => `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors lg:justify-center lg:px-0 ${isActive ? 'border border-sand/20 bg-sand/[.12] text-sand' : 'text-sand-400 hover:bg-white/5 hover:text-cream'}`}><Settings className="h-4 w-4" /><span className="lg:hidden">Тохиргоо</span><span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-sand/20 bg-[#3a3734] px-2.5 py-1.5 text-[10px] font-bold text-sand-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">Тохиргоо</span></NavLink>
        <button type="button" aria-label="Тусламж" className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-sand-400 transition-colors hover:bg-white/5 hover:text-cream lg:justify-center lg:px-0"><CircleHelp className="h-4 w-4" /><span className="lg:hidden">Тусламж</span><span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-sand/20 bg-[#3a3734] px-2.5 py-1.5 text-[10px] font-bold text-sand-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">Тусламж</span></button>
      </div>
    </aside>
  );

  return (
    <div className="workspace-shell manager-gold-shell min-h-screen text-cream">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1e1d1b]/65 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="h-full w-72 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}
      <div className="min-h-screen lg:pl-[82px]">
        <header className="workspace-chrome sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b px-4 sm:px-5">
          <button onClick={() => setIsMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 lg:hidden" aria-label="Цэс нээх"><Menu className="h-4 w-4" /></button>
          <div className="hidden items-center gap-2 rounded-xl border border-white/8 bg-white/[.035] px-3 py-2 lg:flex lg:w-[min(36vw,420px)]"><Search className="h-4 w-4 text-sand-500" /><input className="w-full bg-transparent text-xs text-cream outline-none placeholder:text-sand-500" placeholder="Хайх..." /><kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-sand-500">⌘ K</kbd></div>
          <div className="hidden items-center gap-2 text-[10px] font-bold tracking-[.12em] text-sand-500 xl:flex"><span className="h-px w-7 bg-sand/25" /> RESIDENCE OS</div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 hover:border-sand/25 hover:bg-sand/[.07]"
              aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'}
              title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen((open) => !open)}
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 hover:border-sand/25 hover:bg-sand/[.07]"
                aria-label={`Мэдэгдэл${unreadCount ? `, ${unreadCount} уншаагүй` : ''}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-sand px-1 text-[9px] font-bold leading-none text-onyx">{unreadCount}</span>}
              </button>
              {isNotificationsOpen && (
                <div
                  className="absolute right-0 top-full z-[100] mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-sand/25 p-3 shadow-[0_24px_70px_rgba(0,0,0,.42)]"
                  style={{ backgroundColor: '#2b2217', opacity: 1, backdropFilter: 'none' }}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-sand/15 px-2 pb-3 pt-1">
                    <div><b className="text-sm text-cream">Мэдэгдэл</b><p className="mt-0.5 text-[10px] text-sand-500">{unreadCount ? `${unreadCount} уншаагүй мэдэгдэл` : 'Бүгд уншсан'}</p></div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={markAllNotificationsRead} disabled={!unreadCount} className="text-[10px] font-semibold text-sand transition hover:text-cream disabled:cursor-not-allowed disabled:opacity-40">Бүгдийг унших</button>
                      <button type="button" onClick={() => setIsClearConfirmOpen(true)} disabled={!notifications.length} className="text-[10px] font-semibold text-sand-400 transition hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40">Цэвэрлэх</button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1 rounded-xl bg-black/15 p-1" aria-label="Мэдэгдлийн шүүлтүүр">
                    {([['all', 'Бүгд'], ['unread', 'Уншаагүй'], ['read', 'Уншсан']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setNotificationFilter(value)} className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${notificationFilter === value ? 'bg-sand text-onyx' : 'text-sand-400 hover:text-cream'}`}>{label}</button>)}
                  </div>

                  <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                    {filteredNotifications.length ? filteredNotifications.map((notification) => {
                      const Icon = notificationIcon(notification.tone);
                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => openNotification(notification)}
                          className={`group grid w-full grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition ${notification.read ? 'border-sand/10 hover:border-sand/20' : 'border-sand/25'}`}
                          style={{ backgroundColor: notification.read ? '#241b12' : '#3a2c1b', opacity: 1 }}
                        >
                          <span className={`grid h-9 w-9 place-items-center rounded-lg border ${notification.read ? 'border-sand/15 bg-sand/[.05] text-sand-400' : 'border-sand/30 bg-sand/[.14] text-sand'}`}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <b className="min-w-0 truncate text-xs text-cream">{notification.title}</b>
                              {!notification.read && <i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sand" />}
                            </span>
                            <span className="mt-1 block text-[11px] leading-4 text-sand-300">{notification.message}</span>
                            <span className="mt-1.5 block text-[10px] text-sand-500">{notification.time}</span>
                          </span>
                        </button>
                      );
                    }) : (
                      <div className="rounded-xl border border-dashed border-sand/20 p-5 text-center">
                        <Bell className="mx-auto h-5 w-5 text-sand-400" />
                        <p className="mt-2 text-xs font-semibold text-cream">Мэдэгдэл алга</p>
                        <p className="mt-1 text-[10px] text-sand-500">Шинэ төлбөр, засвар, нэхэмжлэл энд харагдана.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5"><span className="grid h-7 w-7 place-items-center rounded-full border border-sand/20 bg-sand/15 text-[10px] font-bold text-sand">{userInitial}</span><span className="hidden text-left sm:block"><b className="block text-[11px] leading-none">{user?.fullName ?? 'Хэрэглэгч'}</b><small className="text-[9px] text-sand-400">Менежер</small></span><ChevronDown className="hidden h-3.5 w-3.5 text-sand-400 sm:block" /></button>
            <button type="button" onClick={signOut} aria-label="Гарах" title="Гарах" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-[1460px] p-4 sm:p-5 lg:p-6"><Outlet /></main>
      </div>
      <ConfirmDialog open={isClearConfirmOpen} title="Мэдэгдлүүдийг цэвэрлэх үү?" description="Бүх мэдэгдэл энэ жагсаалтаас бүр мөсөн устна." confirmLabel="Цэвэрлэх" onCancel={() => setIsClearConfirmOpen(false)} onConfirm={() => { clearNotifications(); setIsClearConfirmOpen(false); }} />
    </div>
  );
}
