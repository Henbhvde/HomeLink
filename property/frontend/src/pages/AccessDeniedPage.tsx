import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/auth';

const roleNames: Record<UserRole, string> = {
  unassigned: 'Шинэ хэрэглэгч',
  super_admin: 'Системийн админ',
  manager: 'Менежер',
  accountant: 'Нягтлан',
  staff: 'Ажилтан',
  resident: 'Оршин суугч',
};

const roleHomes: Record<UserRole, string> = {
  unassigned: '/resident/join',
  super_admin: '/platform',
  manager: '/manager',
  accountant: '/accountant',
  staff: '/staff',
  resident: '/resident',
};

export default function AccessDeniedPage({ expectedRole }: { expectedRole: UserRole }) {
  const { user, isAuthenticated } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-[#090909] px-5 text-cream">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11100e] p-8 text-center shadow-2xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sand/10 text-sand"><LockKeyhole /></span>
        <h1 className="mt-6 font-serif text-3xl">{isAuthenticated ? 'Эрх хүрэлцэхгүй байна' : 'Нэвтрэх шаардлагатай'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-sand-400">
          {isAuthenticated
            ? `Энэ хэсэг зөвхөн ${roleNames[expectedRole]} эрхтэй хэрэглэгчид зориулагдсан. Та ${user ? roleNames[user.role] : ''} эрхээр нэвтэрсэн байна.`
            : `Энэ хэсэгт хандахын тулд ${roleNames[expectedRole]} эрхээр нэвтэрнэ үү.`}
        </p>
        <div className="mt-7 grid gap-3">
          <Link to={isAuthenticated && user ? roleHomes[user.role] : '/login'} className="rounded-xl bg-sand px-4 py-3 text-sm font-semibold text-onyx hover:bg-cream">
            {isAuthenticated ? 'Өөрийн самбар руу очих' : 'Нэвтрэх'}
          </Link>
          <Link to="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-sand-200 hover:bg-white/5"><ArrowLeft className="h-4 w-4" />Нүүр хуудас</Link>
        </div>
      </section>
    </main>
  );
}
