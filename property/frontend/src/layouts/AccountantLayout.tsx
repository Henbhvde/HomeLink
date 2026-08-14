import { useEffect, useState } from 'react';
import { Building2, CalendarDays, CreditCard, FileSpreadsheet, LogOut, Menu, ReceiptText, ShieldCheck, Sun, Moon, WalletCards, X, Zap } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const navigation = [
  { label: 'Санхүүгийн тойм', icon: WalletCards, to: '/accountant' },
  { label: 'Заалт шалгах', icon: Zap, to: '/accountant/meters' },
  { label: 'Нэхэмжлэл үүсгэх', icon: FileSpreadsheet, to: '/accountant/billing' },
  { label: 'Төлбөр, авлага', icon: CreditCard, to: '/accountant/payments' },
  { label: 'Зарлага, баримт', icon: ReceiptText, to: '/accountant/expenses' },
];

export default function AccountantLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebar = (
    <aside className="workspace-chrome flex h-full w-72 flex-col border-r px-4 py-5 shadow-[16px_0_60px_rgba(0,0,0,.25)]">
      <div className="flex items-center justify-between px-2">
        <NavLink to="/accountant" className="flex items-center gap-3" onClick={() => setIsMobileOpen(false)}>
          <span className="grid h-10 w-10 place-items-center text-[#d3a84b]">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span>
            <b className="block font-serif text-lg leading-none text-[#f6edda]">HomeLink</b>
            <small className="mt-1 block text-[8px] font-bold tracking-[.22em] text-[#be9a54]">САНХҮҮГИЙН ХЯНАЛТ</small>
          </span>
        </NavLink>
        <button className="text-[#be9a54] lg:hidden" onClick={() => setIsMobileOpen(false)} aria-label="Цэс хаах">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#c89e43]/24 bg-[linear-gradient(135deg,rgba(196,141,35,.17),rgba(20,17,10,.8))] p-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#e4bd61]" />
          <span className="text-[10px] font-bold tracking-[.14em] text-[#edcf8a]">2026 ОНЫ 8-Р САР</span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#c7b78e]">Сарын санхүүгийн мөчлөг нээлттэй</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/35">
          <span className="block h-full w-[72%] rounded-full bg-gradient-to-r from-[#8c5a15] via-[#e5b94f] to-[#fff0b9]" />
        </div>
      </div>

      <nav className="mt-7 space-y-1">
        <p className="px-3 pb-2 text-[9px] font-bold tracking-[.18em] text-[#806c45]">НЯРАВЫН АЖЛЫН ОРЧИН</p>
        {navigation.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/accountant'}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'border border-[#d7ad55]/30 bg-[linear-gradient(90deg,rgba(201,151,46,.27),rgba(201,151,46,.06))] text-[#fae4a4] shadow-[inset_2px_0_0_#e7bf63]'
                  : 'text-[#a99c7c] hover:bg-white/[.035] hover:text-[#f3e6c7]'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="workspace-shell accountant-shell min-h-screen text-cream">
      {/* Desktop Sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block w-72">{sidebar}</div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#14120c]/65 backdrop-blur-sm lg:hidden"
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

      <div className="min-h-screen lg:pl-72">
        <header className="workspace-chrome sticky top-0 z-20 flex h-[72px] items-center justify-between border-b px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#bba77d] lg:hidden"
              aria-label="Цэс нээх"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-sand">ЭВЕРГРИН ХОТХОН</p>
              <p className="mt-0.5 text-xs text-sand-400 hidden sm:block">Няравын санхүүгийн ажлын орчин</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 text-[10px] font-bold tracking-[.12em] text-emerald-200 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              ҮЕ НЭЭЛТТЭЙ
            </span>
            <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d3a84b]/40 bg-[#2a1e0d] text-[10px] font-bold text-[#e6c46e]">
                {(user?.fullName ?? 'Нярав').slice(0, 1)}
              </span>
              <div className="hidden min-w-0 text-left sm:block">
                <b className="block max-w-28 truncate text-[11px] leading-none text-[#f1e7d5]">
                  {user?.fullName ?? 'Нярав'}
                </b>
                <small className="mt-1 block max-w-28 truncate text-[9px] text-[#8f8267]">{user?.email}</small>
              </div>
            </div>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#d3a84b]/20 text-[#bba77d] transition hover:border-[#d3a84b]/40 hover:bg-white/[.05]"
              aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'}
              title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/');
              }}
              aria-label="Гарах"
              title="Гарах"
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#d3a84b]/20 text-[#bba77d] transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="relative mx-auto max-w-[1600px] p-5 lg:p-8">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(120,156,130,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(197,168,128,.025)_1px,transparent_1px)] [background-size:28px_28px]" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
