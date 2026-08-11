import { LogOut, Wrench, Sun, Moon } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function StaffLayout() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="workspace-shell min-h-screen overflow-x-hidden text-cream">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-emerald-300/[.08] opacity-45 blur-3xl sm:opacity-100" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-sand/[.06] blur-3xl" />
      </div>

      <header className="workspace-chrome sticky top-0 z-20 border-b px-4 pb-3.5 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 sm:pt-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center text-sand">
              <Wrench className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm font-semibold text-white">Дорж · Засварчин</b>
              <small className="mt-0.5 block text-[9px] font-bold tracking-[.18em] text-sand-400">MY FIELD WORK</small>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-sand/15 bg-sand/[.05] px-3 py-2 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-sand-200 shadow-[0_0_0_4px_rgba(197,168,128,.08)]" />
              <span className="text-[10px] font-bold tracking-[.1em] text-sand-400">ӨНӨӨДРИЙН ЭЭЛЖ</span>
            </div>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-white/10 bg-white/[.035] text-white/80 transition hover:border-sand/20 hover:bg-white/[.07] sm:h-10 sm:w-10"
              aria-label={theme === 'dark' ? 'Гэрэлтэй горимд шилжих' : 'Харанхуй горимд шилжих'}
              title={theme === 'dark' ? 'Гэрэлтэй горим' : 'Харанхуй горим'}
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button
              type="button"
              onClick={() => { logout(); navigate('/'); }}
              className="inline-flex h-12 min-w-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 text-xs font-semibold text-white/80 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-100 sm:h-10"
              aria-label="Гарах"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Гарах</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-5 pb-12 sm:px-6 sm:py-7 sm:pb-16">
        <Outlet />
      </main>
    </div>
  );
}
