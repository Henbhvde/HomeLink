import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BellRing, CalendarClock, ChevronRight, Download, FileText, Megaphone, ShieldCheck, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useResidentPortal } from '../contexts/ResidentPortalContext';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import { PageStateWrapper } from '../components/ui';

type Notice = {
  id: string;
  title: string;
  audience: string;
  date: string;
  body: string;
  read: boolean;
  kind: 'service' | 'finance' | 'community';
};

const initialNotices: Notice[] = [
  {
    id: '1',
    title: 'Ус түр хаах мэдэгдэл',
    audience: 'B орц · 1–12 давхар',
    date: 'Маргааш, 10:00–14:00',
    body: 'Шугамын урсгал засварын улмаас маргааш 10:00–14:00 цагийн хооронд B орцны ус түр хаагдана. Усны хэрэгцээгээ урьдчилан базаана уу.',
    read: false,
    kind: 'service',
  },
  {
    id: '2',
    title: '7-р сарын нэхэмжлэл гарлаа',
    audience: 'Бүх оршин суугч',
    date: 'Өнөөдөр, 09:00',
    body: '7-р сарын СӨХ-ийн үйлчилгээ, усны хэрэглээ болон алдангийн нэхэмжлэл таны порталд байршууллаа.',
    read: false,
    kind: 'finance',
  },
  {
    id: '3',
    title: 'Сарын ил тод тайлан нээгдлээ',
    audience: 'Бүх оршин суугч',
    date: '07.20',
    body: '6-р сарын СӨХ-ийн орлого, зарлагын нэгтгэсэн тайланг оршин суугчдад нээлттэй болголоо.',
    read: true,
    kind: 'community',
  },
];

const formatMnt = (amount: number) => {
  if (amount >= 1_000_000) return `₮${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `₮${Math.round(amount / 1_000)}K`;
  return `₮${Math.round(amount).toLocaleString()}`;
};

function NoticeDialog({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-3xl border border-sand/20 bg-[#161513] p-6 shadow-2xl shadow-black/60">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-sand-300 transition hover:bg-white/7" aria-label="Хаах">
          <X className="h-4 w-4" />
        </button>
        <Badge tone="info">{notice.audience}</Badge>
        <h2 className="mt-4 max-w-[18rem] font-serif text-2xl text-cream">{notice.title}</h2>
        <p className="mt-2 text-xs text-sand-400">{notice.date}</p>
        <p className="mt-6 text-sm leading-7 text-sand-200">{notice.body}</p>
      </div>
    </div>
  );
}

export default function ResidentCommunityPage() {
  const { selectedUnit } = useResidentPortal();
  const { token, user } = useAuth();
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [readNoticeIds, setReadNoticeIds] = useState<Set<string>>(() => new Set());
  const [downloaded, setDownloaded] = useState(false);

  const billingQuery = useQuery({
    queryKey: ['resident-community', token],
    queryFn: () => apiClient.getResidentBillingSummary(token || ''),
    enabled: !!token,
  });
  const notices = useMemo<Notice[]>(() => (billingQuery.data?.notices ?? []).map((notice) => ({
    ...notice,
    read: notice.read || readNoticeIds.has(notice.id),
    kind: 'community',
  })), [billingQuery.data?.notices, readNoticeIds]);
  const featuredNotice = notices[0] ?? null;
  const status = billingQuery.isError ? 'error' : billingQuery.isPending ? 'loading' : 'ready';
  const retry = () => { void billingQuery.refetch(); };

  const { data: transparency } = useQuery({
    queryKey: ['transparency-stats', token],
    queryFn: () => apiClient.getTransparencyStats(token || ''),
    enabled: !!token,
  });

  const reports = transparency?.reports ?? [];
  const [monthIndex, setMonthIndex] = useState(0);
  const report = reports[monthIndex];
  const communityCardClass = 'h-full overflow-hidden border-sand/20 bg-[linear-gradient(145deg,rgba(43,42,38,.92),rgba(25,26,23,.96))] shadow-[0_16px_38px_rgba(0,0,0,.16)]';

  const openNotice = (notice: Notice) => {
    const openedNotice = { ...notice, read: true };
    setSelectedNotice(openedNotice);
    setReadNoticeIds((current) => new Set(current).add(notice.id));
  };

  if (!selectedUnit) return <Navigate to="/resident" replace />;

  return (
    <section className="space-y-5">
      <PageStateWrapper
        status={status}
        isEmpty={false}
        onRetry={retry}
        emptyIcon={BellRing}
        emptyTitle="Одоогоор мэдэгдэл алга"
        emptyDescription="Энэ хэсэгт шинэ мэдээлэл гарах үед шууд харагдана."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">{selectedUnit} · {user?.workspace?.name ?? 'СӨХ'}</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Мэдээлэл, ил тод байдал.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-400">Таны орц, хотхоны мэдээ болон СӨХ-ийн нэгтгэсэн санхүүгийн тайлан нэг дор.</p>
        </div>
      </div>

      <div className="mb-8 grid items-stretch gap-8 lg:grid-cols-2">
        <Card className={communityCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">ОРЦНЫ ДАРААГИЙН ҮЙЛ ЯВДАЛ</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">{featuredNotice?.title ?? 'Төлөвлөсөн үйл явдал алга'}</h2>
                <p className="mt-2 text-sm leading-6 text-sand-400">{featuredNotice?.body ?? 'СӨХ-өөс шинэ мэдээлэл нийтлэгдээгүй байна.'}</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-sand/20 bg-sand/10 text-sand"><CalendarClock className="h-5 w-5" /></span>
            </div>
            <div className="mt-6 grid gap-3 border-y border-white/8 py-4 sm:grid-cols-3">
              {[[featuredNotice?.date ?? '-', 'Огноо'], [featuredNotice?.audience ?? '-', 'Хамрах хүрээ'], [String(notices.length), 'Нийт мэдэгдэл']].map(([value, label]) => <div key={label}><b className="block truncate font-serif text-xl text-cream">{value}</b><span className="mt-1 block text-[10px] font-bold tracking-[.12em] text-sand-500">{label}</span></div>)}
            </div>
            {featuredNotice && <button type="button" onClick={() => openNotice(featuredNotice)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-sand transition hover:text-cream">Мэдэгдэл дэлгэрэнгүй <ArrowUpRight className="h-3.5 w-3.5" /></button>}
          </CardContent>
        </Card>

        <Card className={communityCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-emerald-100">ИТГЭЛИЙН ТООЛУУР</p><h2 className="mt-2 font-serif text-2xl text-cream">Тайлан нээлттэй</h2></div><ShieldCheck className="h-5 w-5 text-emerald-200" /></div>
            <p className="mt-3 text-sm leading-6 text-sand-300">Хувийн өр, төлбөр харагдахгүй. Зөвхөн СӨХ-ийн сарын нэгтгэсэн орлого, зарлага нээлттэй.</p>
            <div className="mt-6 flex items-end justify-between"><div><b className="font-serif text-4xl text-cream">{report?.completion ?? 0}%</b><span className="mt-1 block text-xs text-emerald-100">Тайлангийн бүрдэл</span></div><div className="h-20 w-20 rounded-full p-1" style={{ background: `conic-gradient(#b7e2c8 ${report?.completion ?? 0}%, rgba(255,255,255,.10) 0)` }}><div className="grid h-full place-items-center rounded-full bg-[#17382f]"><FileText className="h-5 w-5 text-emerald-100" /></div></div></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-8 lg:grid-cols-2">
        <Card className={communityCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">СӨХ-ИЙН ЗАРЛАЛ</p><h2 className="mt-2 font-serif text-2xl text-cream">Шинэ мэдэгдлүүд</h2></div><Megaphone className="h-5 w-5 text-sand" /></div>
            <div className="mt-5 divide-y divide-white/7">
              {notices.map((notice) => (
                <button key={notice.id} type="button" onClick={() => openNotice(notice)} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[.025]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${notice.read ? 'bg-white/15' : notice.kind === 'finance' ? 'bg-amber-300' : 'bg-sand'}`} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm text-cream">{notice.title}</b><small className="mt-1 block truncate text-[11px] text-sand-400">{notice.audience} · {notice.date}</small></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-sand-500" />
                </button>
              ))}
              {!notices.length && <p className="py-8 text-center text-sm text-sand-400">Одоогоор мэдэгдэл алга.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className={communityCardClass}>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold tracking-[.16em] text-emerald-100">ИЛ ТОД ТАЙЛАН</p><h2 className="mt-2 font-serif text-2xl text-cream">Сарын орлого, зарлага</h2></div><div className="flex rounded-xl border border-white/10 bg-black/15 p-1">{reports.map((item: { key: string }, index: number) => <button key={item.key} type="button" onClick={() => setMonthIndex(index)} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${monthIndex === index ? 'bg-sand text-onyx' : 'text-sand-400 hover:text-cream'}`}>{item.key.split(' ').slice(-2).join(' ')}</button>)}</div></div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-y border-white/8 py-4">{[['Орлого', formatMnt(report?.income ?? 0), 'text-cream'], ['Зарлага', formatMnt(report?.expense ?? 0), 'text-sand-200'], ['Үлдэгдэл', formatMnt(report?.balance ?? 0), 'text-emerald-100']].map(([label, value, tone]) => <div key={label}><span className="text-[10px] text-sand-500">{label}</span><b className={`mt-1 block font-serif text-lg ${tone}`}>{value}</b></div>)}</div>
            <div className="mt-5 space-y-4">{(report?.rows ?? []).map((row: { label: string; amount: number; share: number }) => <div key={row.label}><div className="flex items-center justify-between gap-3 text-xs"><span className="text-sand-300">{row.label}</span><b className="text-cream">{formatMnt(row.amount)}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.08]"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#9dd8bf,#d9caac)]" style={{ width: `${row.share}%` }} /></div></div>)}</div>
            {!report && <p className="mt-6 text-center text-sm text-sand-400">Санхүүгийн тайлан бүртгэгдээгүй байна.</p>}
            <Button variant="outline" size="sm" className="mt-6 w-full" onClick={() => setDownloaded(true)}><Download className="h-3.5 w-3.5" />{downloaded ? 'Тайлан татахад бэлэн' : 'Тайлан татах'}</Button>
          </CardContent>
        </Card>
      </div>

      {selectedNotice && <NoticeDialog notice={selectedNotice} onClose={() => setSelectedNotice(null)} />}
      </PageStateWrapper>
    </section>
  );
}
