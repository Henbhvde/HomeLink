import { useEffect, useRef, useState } from 'react';
import { Bell, Building2, Check, CreditCard, Home, LogOut, Megaphone, Pencil, Sun, Moon, UserRound, Wrench } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ResidentPortalProvider, useResidentPortal } from '../contexts/ResidentPortalContext';

const nav = [
  { icon: Home, label: 'Нүүр', to: '/resident', end: true },
  { icon: CreditCard, label: 'Төлбөр', to: '/resident/payments' },
  { icon: Wrench, label: 'Үйлчилгээ', to: '/resident/services' },
  { icon: Megaphone, label: 'Мэдээ', to: '/resident/community' },
];
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
type ResidentNotification = { id: string; title: string; message: string; route: string; read: boolean };

function ResidentShell() {
  const { user, token, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { selectedUnit, tenantName, building, entrance, floor } = useResidentPortal();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<ResidentNotification[]>([]);
  const [profileName, setProfileName] = useState(user?.fullName ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const menuAreaRef = useRef<HTMLDivElement>(null);
  const signOut = () => { logout(); navigate('/'); };
  const closeMenus = () => { setIsNotificationsOpen(false); setIsProfileOpen(false); };
  const hasUnread = notifications.some((notification) => !notification.read);

  useEffect(() => {
    if (!token) return;
    void fetch(`${apiBaseUrl}/notifications`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => {
      const rows = Array.isArray(payload?.data) ? payload.data as Array<Record<string, unknown>> : [];
      setNotifications(rows.map((row) => ({ id: String(row.id), title: String(row.title), message: String(row.body), route: typeof row.route === 'string' ? row.route : '/resident', read: Boolean(row.readAt) })));
    }).catch(() => setNotifications([]));
  }, [token]);

  useEffect(() => {
    const handleLiveNotification = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      const notification = { id: String(detail.id), title: String(detail.title), message: String(detail.body), route: typeof detail.route === 'string' ? detail.route : '/resident', read: false };
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
    };
    window.addEventListener('homelink:live-notification', handleLiveNotification);
    return () => window.removeEventListener('homelink:live-notification', handleLiveNotification);
  }, []);

  const markAllRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    if (token) void fetch(`${apiBaseUrl}/notifications/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
  };

  const openNotification = (notification: ResidentNotification) => {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    if (token) void fetch(`${apiBaseUrl}/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    navigate(notification.route.startsWith('/resident') ? notification.route : '/resident');
    closeMenus();
  };

  const saveProfile = async () => {
    if (!token || !user || profileName.trim().length < 2) return;
    setIsSavingProfile(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/me`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: profileName.trim(), phone: profilePhone.trim() || null }) });
      const payload = await response.json();
      if (response.ok && payload.data) { login(payload.data, token); setIsEditingProfile(false); }
    } finally { setIsSavingProfile(false); }
  };

  useEffect(() => {
    if (!isNotificationsOpen && !isProfileOpen) return;

    const handleOutsideClick = (event: PointerEvent) => {
      if (!menuAreaRef.current?.contains(event.target as Node)) closeMenus();
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isNotificationsOpen, isProfileOpen]);

  return (
    <div className="workspace-shell min-h-screen overflow-x-hidden text-cream">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgba(120,156,130,.12),transparent_62%)]" />
      <header className="workspace-chrome sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5">
          <NavLink to="/resident" end className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center text-sand"><Building2 className="h-5 w-5" strokeWidth={1.75} /></span>
            <span className="hidden sm:block"><b className="block font-serif text-base">HomeLink</b><small className="block text-[7px] font-bold tracking-[.18em] text-sand-400">ОРШИН СУУГЧИЙН ПОРТАЛ</small></span>
          </NavLink>

          <nav className="hidden items-center rounded-xl border border-white/8 bg-white/[.025] p-1 lg:flex">
            {nav.map(({ icon: Icon, label, to, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${isActive ? 'bg-sand text-onyx shadow-sm' : 'text-sand-400 hover:bg-white/[.045] hover:text-cream'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            ))}
          </nav>

          <div ref={menuAreaRef} className="flex shrink-0 items-center gap-2">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 transition hover:bg-white/[.05]"
              aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'}
              title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative z-40">
              <button type="button" onClick={() => { setIsNotificationsOpen((open) => !open); setIsProfileOpen(false); }} className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-sand-300 transition hover:bg-white/[.05]" aria-label="Мэдэгдэл" aria-expanded={isNotificationsOpen}><Bell className="h-4 w-4" />{hasUnread && <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sand" />}</button>
              {isNotificationsOpen && <div className="absolute right-0 mt-3 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-sand/20 bg-[#252821] p-3 shadow-2xl"><div className="flex items-center justify-between px-2 py-1"><div><b className="block text-xs text-cream">Мэдэгдэл</b><span className="text-[9px] text-sand-500">Бодит шинэчлэлтүүд</span></div><button type="button" onClick={markAllRead} disabled={!hasUnread} className="inline-flex items-center gap-1 text-[9px] font-bold text-sand disabled:opacity-40"><Check className="h-3 w-3" />Бүгдийг унших</button></div>{notifications.length === 0 ? <p className="px-2 py-5 text-center text-xs text-sand-500">Мэдэгдэл алга.</p> : notifications.map((notification) => <button type="button" key={notification.id} onClick={() => openNotification(notification)} className="mt-1 block w-full rounded-xl p-3 text-left transition hover:bg-white/5"><span className="flex items-center gap-2 text-xs font-semibold text-cream">{!notification.read && <i className="h-1.5 w-1.5 rounded-full bg-sand" />}{notification.title}</span><p className="mt-1 text-[10px] leading-4 text-sand-400">{notification.message}</p></button>)}</div>}
            </div>
            <div className="relative z-40">
              <button type="button" onClick={() => { setIsProfileOpen((open) => !open); setIsNotificationsOpen(false); }} className="grid h-9 w-9 place-items-center rounded-full bg-sand/15 text-sand transition hover:bg-sand/25" aria-label="Миний профайл" aria-expanded={isProfileOpen}><UserRound className="h-4 w-4" /></button>
              {isProfileOpen && <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-sand/20 bg-[#252821] p-3 shadow-2xl"><div className="flex items-start gap-3 rounded-xl bg-white/[.035] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/15 text-sand"><UserRound className="h-4 w-4" /></span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-cream">{user?.fullName ?? 'Оршин суугч'}</b><small className="block truncate text-[9px] text-sand-400">{user?.email}</small><small className="mt-1 block text-[9px] text-sand-400">{user?.phone ?? 'Утасгүй'}</small></div><button type="button" onClick={() => setIsEditingProfile((value) => !value)} className="grid h-7 w-7 place-items-center rounded-lg text-sand hover:bg-white/10" aria-label="Профайл засах"><Pencil className="h-3.5 w-3.5" /></button></div><div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px]">{[['СӨХ', tenantName], ['Байр', building], ['Орц', entrance], ['Давхар', floor], ['Тоот', selectedUnit]].map(([label, value]) => <div key={label} className="rounded-lg bg-black/15 px-2.5 py-2"><span className="block text-sand-500">{label}</span><b className="mt-0.5 block truncate text-sand-200">{value ?? '-'}</b></div>)}</div>{isEditingProfile && <div className="mt-3 space-y-2"><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Нэр" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-cream outline-none focus:border-sand" /><input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="Утасны дугаар" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-cream outline-none focus:border-sand" /><button type="button" disabled={isSavingProfile || profileName.trim().length < 2 || (!!profilePhone.trim() && profilePhone.trim().length < 8)} onClick={saveProfile} className="w-full rounded-lg bg-sand px-3 py-2 text-xs font-bold text-onyx disabled:opacity-50">{isSavingProfile ? 'Хадгалж байна...' : 'Хадгалах'}</button></div>}</div>}
            </div>
            <button type="button" onClick={signOut} className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-sand-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 sm:inline-flex"><LogOut className="h-3.5 w-3.5" />Гарах</button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl min-w-0 px-3 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-7 lg:pb-10"><Outlet /></main>

      <nav className="workspace-chrome fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 lg:hidden">
        {nav.map(({ icon: Icon, label, to, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-12 min-w-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[9px] font-semibold transition ${isActive ? 'text-sand' : 'text-sand-500'}`}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
        <button type="button" onClick={signOut} className="flex min-w-14 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[9px] font-semibold text-sand-500"><LogOut className="h-4 w-4" />Гарах</button>
      </nav>
    </div>
  );
}

export default function ResidentLayout() {
  return <ResidentPortalProvider><ResidentShell /></ResidentPortalProvider>;
}
