import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Droplets,
  FileText,
  ImagePlus,
  Megaphone,
  QrCode,
  ReceiptText,
  Send,
  Star,
  Trash2,
  WalletCards,
  Wrench,
  X,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useResidentPortal } from '../contexts/ResidentPortalContext';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, type ResidentBillingSummary } from '../services/api/client';

type Ticket = {
  id: string;
  displayId?: string;
  title: string;
  description: string;
  status: string;
  tone: 'info' | 'success';
  date: string;
  rating?: number;
};

type Notice = {
  id: string;
  title: string;
  audience: string;
  date: string;
  body: string;
  read: boolean;
};

const invoiceLines = [
  { label: 'СӨХ-ийн үйлчилгээ', detail: '42 м² × ₮1,800', amount: '₮75,600' },
  { label: 'Усны хэрэглээ', detail: '17 м³ × ₮1,200', amount: '₮20,400' },
  { label: 'Алданги', detail: 'Өмнөх сарын хоцролт', amount: '₮14,000' },
];

const paymentHistory = [
  { month: '2026 оны 6-р сар', amount: '₮110,000', method: 'QPay · 06.18', receipt: 'Баримт #260618-45' },
  { month: '2026 оны 5-р сар', amount: '₮108,000', method: 'QPay · 05.21', receipt: 'Баримт #260521-45' },
  { month: '2026 оны 4-р сар', amount: '₮108,000', method: 'Банкны шилжүүлэг · 04.17', receipt: 'Баримт #260417-45' },
];

const startingNotices: Notice[] = [
  {
    id: 'legacy-1',
    title: 'Ус түр хаах мэдэгдэл',
    audience: 'B орц · 1–12 давхар',
    date: 'Маргааш, 10:00–14:00',
    body: 'Шугамын урсгал засварын улмаас маргааш 10:00–14:00 цагийн хооронд B орцны ус түр хаагдана. Усны хэрэгцээгээ урьдчилан базаана уу.',
    read: false,
  },
  {
    id: 'legacy-2',
    title: '7-р сарын нэхэмжлэл гарлаа',
    audience: 'Бүх оршин суугч',
    date: 'Өнөөдөр, 09:00',
    body: '7-р сарын СӨХ-ийн үйлчилгээ, усны хэрэглээ болон алдангийн нэхэмжлэл таны порталд байршууллаа.',
    read: false,
  },
  {
    id: 'legacy-3',
    title: 'Сарын ил тод тайлан нээгдлээ',
    audience: 'Бүх оршин суугч',
    date: '07.20',
    body: '6-р сарын СӨХ-ийн орлого, зарлагын нэгтгэсэн тайланг оршин суугчдад нээлттэй болголоо.',
    read: true,
  },
];

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-sand/25 bg-[#151513] p-6 shadow-2xl shadow-black/60">
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-sand-300 transition hover:bg-white/7" aria-label="Хаах">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function ResidentPortalPage() {
  const { token, user } = useAuth();
  const { selectedUnit, tenantName, isLoadingUnit } = useResidentPortal();
  const [showPay, setShowPay] = useState(false);
  const [showMeter, setShowMeter] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [activeDetail, setActiveDetail] = useState<'balance' | 'meter' | 'requests' | 'notices' | 'history' | null>(null);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const [meterValue, setMeterValue] = useState('');
  const [meterPhoto, setMeterPhoto] = useState<string | null>(null);
  const [meterSubmitted, setMeterSubmitted] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestPhoto, setRequestPhoto] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [billing, setBilling] = useState<ResidentBillingSummary | null>(null);
  const meterPhotoInput = useRef<HTMLInputElement>(null);
  const requestPhotoInput = useRef<HTMLInputElement>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const currentInvoice = billing?.currentInvoice;
  const currentLines = currentInvoice?.lines ?? [];
  const currentPayments = billing?.payments ?? [];
  const currentAmount = currentInvoice?.amount ?? '₮0';
  const currentDue = currentInvoice?.due ?? '-';
  const currentMeter = billing?.meter;

  const { data: transparency } = useQuery({
    queryKey: ['transparency-stats', token],
    queryFn: () => apiClient.getTransparencyStats(token || ''),
    enabled: !!token,
  });
  const latestReport = transparency?.reports?.[0];

  const formatMnt = (amount: number) => {
    if (amount >= 1_000_000) return `₮${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `₮${Math.round(amount / 1_000)}K`;
    return `₮${Math.round(amount).toLocaleString()}`;
  };

  useEffect(() => {
    if (!token) return;
    void apiClient.getResidentBillingSummary(token).then((summary) => { setBilling(summary); setTickets(summary.tickets); setNotices(summary.notices); }).catch(() => { setBilling(null); setTickets([]); setNotices([]); });
  }, [token]);

  const openCardDetail = (detail: NonNullable<typeof activeDetail>) => (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    setActiveDetail(detail);
  };

  const detailCardClass = 'cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-sand/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand/35';

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const openAnnouncement = (notice: Notice) => {
    const openedNotice = { ...notice, read: true };
    setOpenNotice(openedNotice);
    setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, read: true } : item));
  };

  const handleMeterPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMeterPhoto(URL.createObjectURL(file));
  };

  const submitMeter = () => {
    if (!meterValue.trim() || !meterPhoto) return;
    setMeterSubmitted(true);
    setShowMeter(false);
    notify('Усны заалт зурагтайгаа амжилттай илгээгдлээ.');
  };

  const handleRequestPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRequestPhoto(URL.createObjectURL(file));
  };

  const submitRequest = async () => {
    if (!token || !requestTitle.trim() || requestSubmitting) return;
    setRequestSubmitting(true);
    try {
      const ticket = await apiClient.createResidentMaintenanceRequest(token, { title: requestTitle.trim(), description: requestDescription.trim() });
      setTickets((current) => [ticket, ...current]);
      setRequestTitle('');
      setRequestDescription('');
      setRequestPhoto(null);
      setShowRequest(false);
      notify('Таны засварын хүсэлтийг СӨХ-д илгээлээ.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Хүсэлт илгээж чадсангүй.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const rateTicket = (id: string, rating: number) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, rating } : ticket));
    notify('Үнэлгээ өгсөнд баярлалаа.');
  };

  const deleteTicket = async (id: string) => {
    if (!token || deletingTicketId) return;
    setDeletingTicketId(id);
    try {
      await apiClient.deleteResidentMaintenanceRequest(token, id);
      setTickets((current) => current.filter((ticket) => ticket.id !== id));
      notify('Засварын хүсэлт устгагдлаа.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Хүсэлтийг устгаж чадсангүй.');
    } finally {
      setDeletingTicketId(null);
    }
  };

  if (isLoadingUnit) return <div className="py-20 text-center text-sm text-sand-400">Байрны мэдээлэл ачаалж байна...</div>;

  if (!selectedUnit) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-11rem)] max-w-3xl items-center justify-center">
        <Card className="w-full max-w-2xl border-sand/20">
          <CardContent className="p-7 sm:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sand/12 text-sand"><Building2 className="h-5 w-5" /></span>
            <p className="mt-6 text-[10px] font-bold tracking-[.18em] text-sand">ТАНЫ БАЙР</p>
            <h1 className="mt-2 font-serif text-3xl font-light text-cream">Идэвхтэй байр олдсонгүй</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-sand-400">СӨХ-ийн менежертэй холбогдож гишүүнчлэлийн байр, тоотын мэдээллээ шалгуулна уу.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Сайн байна уу, {user?.fullName ?? 'Оршин суугч'}.</h1>
          <p className="mt-2 text-sm text-sand-400">Таны төлбөр, заалт болон СӨХ-ийн шинэ мэдээлэл энд байна.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:hidden" aria-label="Шуурхай үйлдэл">
        <button type="button" onClick={() => setShowPay(true)} className="flex min-h-20 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl bg-sand px-2 text-xs font-bold text-onyx shadow-lg active:scale-[.98]"><CreditCard className="h-5 w-5" />Төлбөр төлөх</button>
        <button type="button" onClick={() => setShowRequest(true)} className="flex min-h-20 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border border-sand/20 bg-sand/[.08] px-2 text-xs font-bold text-cream active:scale-[.98]"><Wrench className="h-5 w-5 text-sand" />Хүсэлт өгөх</button>
        <button type="button" onClick={() => setActiveDetail('notices')} className="relative flex min-h-20 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border border-sand/20 bg-sand/[.08] px-2 text-xs font-bold text-cream active:scale-[.98]"><Megaphone className="h-5 w-5 text-sand" />Мэдэгдэл{notices.some((notice) => !notice.read) && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-amber-300" />}</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { key: 'balance' as const, label: 'Balance', value: currentAmount, note: `due ${currentDue}`, icon: CreditCard, tone: 'bg-amber-300/10 text-amber-100' },
          { key: 'meter' as const, label: 'Усны заалт', value: currentMeter?.value ?? '0 м³', note: meterSubmitted ? 'Хянаж байна' : currentMeter?.readAt ?? 'Мэдээлэлгүй', icon: Droplets, tone: 'bg-sky-300/10 text-sky-100' },
          { key: 'requests' as const, label: 'Миний хүсэлт', value: `${tickets.length} хүсэлт`, note: tickets[0]?.status ?? 'Хүсэлт байхгүй', icon: Wrench, tone: 'bg-emerald-300/10 text-emerald-100' },
          { key: 'notices' as const, label: 'Мэдэгдэл', value: `${notices.filter((notice) => !notice.read).length} шинэ`, note: 'СӨХ-ийн зарлал', icon: Megaphone, tone: 'bg-orange-300/10 text-orange-100' },
          { key: 'history' as const, label: 'Payment history', value: ` ${currentPayments.length} payments`, note: 'Latest payments', icon: ReceiptText, tone: 'bg-violet-300/10 text-violet-100' },
        ].map(({ key, label, value, note, icon: Icon, tone }) => (
          <Card key={key} role="button" tabIndex={0} onClick={openCardDetail(key)} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail(key)} className={`group min-h-36 min-w-0 overflow-hidden ${detailCardClass}`}>
            <CardContent className="flex h-full flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
                <ChevronRight className="h-4 w-4 text-sand-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sand" />
              </div>
              <div className="mt-auto pt-5">
                <p className="text-[10px] font-bold tracking-[.12em] text-sand-400">{label.toUpperCase()}</p>
                <b className="mt-1.5 block text-lg text-cream">{value}</b>
                <span className="mt-1 block truncate text-[11px] text-sand-500">{note}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card role="button" tabIndex={0} onClick={openCardDetail('balance')} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail('balance')} className={`overflow-hidden border-sand/25 bg-[radial-gradient(circle_at_85%_0%,rgba(217,202,172,.18),transparent_35%),#151513] ${detailCardClass}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">МИНИЙ ҮЛДЭГДЭЛ · 2026 ОНЫ 7-Р САР</p>
                <b className="mt-3 block text-4xl font-semibold tracking-tight text-cream">{currentAmount}</b>
              </div>
              <Badge tone="warning">due {currentDue}</Badge>
            </div>
            <div className="mt-6 space-y-3 border-y border-white/8 py-4">
              {currentLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-4 text-sm">
                  <div><b className="block text-cream">{line.label}</b><span className="text-xs text-sand-400">{line.detail}</span></div>
                  <b className="shrink-0 text-cream">{line.amount}</b>
                </div>
              ))}
            </div>
            <Button size="lg" className="mt-5 w-full" onClick={() => setShowPay(true)}><CreditCard className="h-4 w-4" />Төлөх</Button>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={openCardDetail('meter')} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail('meter')} className={detailCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold tracking-[.16em] text-sand">САР БҮРИЙН ЗААЛТ</p><h2 className="mt-2 font-serif text-xl text-cream">Усны хэрэглээ</h2></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-200"><Droplets className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-sand-400">Сүүлийн заалт: <b className="text-sand-200">{currentMeter?.value ?? '0 м³'}</b> · {currentMeter?.readAt ?? 'Мэдээлэлгүй'}</p>
            {meterSubmitted ? <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-xs text-emerald-100"><CheckCircle2 className="mr-2 inline h-4 w-4" />Энэ сарын заалтыг хянахаар илгээлээ.</div> : <Button variant="outline" className="mt-5 w-full" onClick={() => setShowMeter(true)}><Camera className="h-4 w-4" />Зурагтай заалт илгээх</Button>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card role="button" tabIndex={0} onClick={openCardDetail('requests')} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail('requests')} className={detailCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">ДУУДЛАГА, ЗАСВАР</p><h2 className="mt-2 font-serif text-xl text-cream">Миний хүсэлтүүд</h2></div><Button size="sm" variant="outline" onClick={() => setShowRequest(true)}><Wrench className="h-3.5 w-3.5" />Дуудлага өгөх</Button></div>
            <div className="mt-5 space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3"><div><b className="block text-sm text-cream">{ticket.title}</b><span className="mt-1 block text-xs text-sand-400">{ticket.displayId ?? `#${ticket.id.slice(-6).toUpperCase()}`} · {ticket.description}</span></div><Badge tone={ticket.tone}>{ticket.status}</Badge></div>
                  {ticket.status !== 'Дууссан' && <div className="mt-3 flex items-center gap-1.5 text-[10px] text-sand-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Хүлээн авсан <span className="h-px w-4 bg-emerald-300/50" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Ажилтан оноосон <span className="h-px w-4 bg-sand/50" /><span className="h-1.5 w-1.5 rounded-full bg-sand" />{ticket.status}</div>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-sand-500">{ticket.date}</span>{ticket.status === 'Дууссан' && (ticket.rating ? <span className="text-xs text-amber-200">{Array.from({ length: ticket.rating }).map((_, index) => <Star key={index} className="inline h-3.5 w-3.5 fill-current" />)} Үнэлсэн</span> : <span className="flex items-center gap-1 text-xs text-sand-300">Үнэлэх {Array.from({ length: 5 }).map((_, index) => <button key={index} onClick={() => rateTicket(ticket.id, index + 1)} className="text-sand-500 transition hover:text-amber-200" aria-label={`${index + 1} од`}><Star className="h-4 w-4" /></button>)}</span>)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={openCardDetail('notices')} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail('notices')} className={detailCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">СӨХ-ИЙН ЗАРЛАЛ</p><h2 className="mt-2 font-serif text-xl text-cream">Шинэ мэдэгдлүүд</h2></div><Megaphone className="h-5 w-5 text-sand" /></div>
            <div className="mt-5 divide-y divide-white/7">
              {notices.map((notice) => (
                <button key={notice.id} onClick={() => openAnnouncement(notice)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/[.025]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${notice.read ? 'bg-transparent' : 'bg-sand'}`} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm text-cream">{notice.title}</b><small className="block truncate text-[11px] text-sand-400">{notice.audience} · {notice.date}</small></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-sand-500" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
        <Card role="button" tabIndex={0} onClick={openCardDetail('history')} onKeyDown={(event) => event.key === 'Enter' && setActiveDetail('history')} className={detailCardClass}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">ТӨЛБӨРИЙН ТҮҮХ</p><h2 className="mt-2 font-serif text-xl text-cream">Сүүлийн төлөлтүүд</h2></div><ReceiptText className="h-5 w-5 text-sand" /></div>
            <div className="mt-5 divide-y divide-white/7">
              {currentPayments.map((payment) => <div key={payment.month} className="flex items-center justify-between gap-3 py-3"><div><b className="block text-sm text-cream">{payment.month}</b><small className="block text-[11px] text-sand-400">{payment.method} · {payment.receipt}</small></div><div className="text-right"><b className="block text-sm text-cream">{payment.amount}</b><Badge tone="success" className="mt-1">Төлөгдсөн</Badge></div></div>)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-300/20 bg-[linear-gradient(120deg,rgba(18,79,63,.22),rgba(18,18,17,.85))]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.16em] text-emerald-100">ИЛ ТОД ТАЙЛАН · 2026 ОНЫ 6-Р САР</p><h2 className="mt-2 font-serif text-xl text-cream">Манай СӨХ-ийн орлого, зарлага</h2></div><FileText className="h-5 w-5 text-emerald-100" /></div>
            <p className="mt-3 text-sm leading-relaxed text-sand-300">Айлуудын хувийн өр, төлбөр харагдахгүй. Зөвхөн СӨХ-ийн нэгтгэсэн тайлан нээлттэй.</p>
            <div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl bg-black/20 p-3"><small className="block text-[10px] text-sand-400">Орлого</small><b className="mt-1 block text-sm text-cream">{formatMnt(latestReport?.income ?? 0)}</b></div><div className="rounded-xl bg-black/20 p-3"><small className="block text-[10px] text-sand-400">Зарлага</small><b className="mt-1 block text-sm text-cream">{formatMnt(latestReport?.expense ?? 0)}</b></div><div className="rounded-xl bg-black/20 p-3"><small className="block text-[10px] text-sand-400">Үлдэгдэл</small><b className="mt-1 block text-sm text-emerald-100">{formatMnt(latestReport?.balance ?? 0)}</b></div></div>
            <div className="mt-4 space-y-2 text-xs text-sand-300">{(latestReport?.rows ?? []).slice(0, 3).map((row: { label: string; amount: number }) => <div key={row.label} className="flex justify-between"><span>{row.label}</span><b>{formatMnt(row.amount)}</b></div>)}</div>
          </CardContent>
        </Card>
      </div>

      </div>

      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setActiveDetail(null)}>
          <div className="resident-detail-sheet flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-sand/20 bg-[#1b1e19] shadow-[0_24px_80px_rgba(0,0,0,.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/7 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[9px] font-bold tracking-[.18em] text-sand">ДЭЛГЭРЭНГҮЙ МЭДЭЭЛЭЛ</p>
                <h2 className="mt-1 font-serif text-2xl text-cream">
                  {activeDetail === 'balance' && 'Энэ сарын нэхэмжлэл'}
                  {activeDetail === 'meter' && 'Тоолуурын заалтын мэдээлэл'}
                  {activeDetail === 'requests' && 'Засварын хүсэлтүүд'}
                  {activeDetail === 'notices' && 'СӨХ-ийн мэдэгдлүүд'}
                  {activeDetail === 'history' && 'Төлбөрийн түүх'}
                </h2>
              </div>
              <button type="button" onClick={() => setActiveDetail(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-sand-300 transition hover:bg-white/10 hover:text-cream" aria-label="Хаах"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {activeDetail === 'balance' && (
                <div>
              <Badge tone="warning">due {currentDue}</Badge>
                  <div className="mt-3 divide-y divide-white/7 rounded-2xl border border-white/8 px-4">{currentLines.map((line) => <div key={line.label} className="flex items-center justify-between gap-4 py-3"><div><b className="text-sm text-cream">{line.label}</b><p className="mt-0.5 text-xs text-sand-400">{line.detail}</p></div><b className="text-sm text-cream">{line.amount}</b></div>)}</div>
                  <Button className="mt-4 w-full" onClick={() => { setActiveDetail(null); setShowPay(true); }}><CreditCard className="h-4 w-4" />Төлбөр төлөх</Button>
                </div>
              )}
              {activeDetail === 'meter' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[['Сүүлийн заалт', currentMeter?.value ?? '0 м³'], ['Огноо', currentMeter?.readAt ?? '-'], ['Төлөв', meterSubmitted ? 'Хянаж байна' : currentMeter?.status ?? 'Мэдээлэлгүй']].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><span className="text-[10px] text-sand-400">{label}</span><b className="mt-2 block text-lg text-cream">{value}</b></div>)}
                  {!meterSubmitted && <Button variant="outline" className="sm:col-span-3" onClick={() => { setActiveDetail(null); setShowMeter(true); }}><Camera className="h-4 w-4" />Зурагтай заалт илгээх</Button>}
                </div>
              )}
              {activeDetail === 'requests' && (
                <div className="space-y-3">{tickets.map((ticket) => <div key={ticket.id} className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><div className="flex items-start justify-between gap-3"><div><b className="text-sm text-cream">{ticket.title}</b><p className="mt-1 text-xs text-sand-400">{ticket.displayId ?? `#${ticket.id.slice(-6).toUpperCase()}`} · {ticket.description}</p></div><div className="flex items-center gap-2"><Badge tone={ticket.tone}>{ticket.status}</Badge><button type="button" disabled={deletingTicketId === ticket.id} onClick={() => void deleteTicket(ticket.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-300/20 text-red-200 transition hover:bg-red-400/10 disabled:opacity-40" aria-label="Хүсэлт устгах"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-3 text-[11px] text-sand-500">Шинэчлэгдсэн: {ticket.date}</p></div>)}<Button variant="outline" className="w-full" onClick={() => { setActiveDetail(null); setShowRequest(true); }}><Wrench className="h-4 w-4" />Шинэ дуудлага өгөх</Button></div>
              )}
              {activeDetail === 'notices' && (
                <div className="space-y-3">{notices.map((notice) => <button type="button" key={notice.id} onClick={() => { setActiveDetail(null); openAnnouncement(notice); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-4 text-left transition hover:border-sand/25 hover:bg-sand/[.05]"><span className={`h-2 w-2 shrink-0 rounded-full ${notice.read ? 'bg-sand/20' : 'bg-sand'}`} /><span className="min-w-0 flex-1"><b className="block text-sm text-cream">{notice.title}</b><small className="mt-1 block text-[11px] text-sand-400">{notice.audience} · {notice.date}</small></span><ChevronRight className="h-4 w-4 text-sand-500" /></button>)}</div>
              )}
              {activeDetail === 'history' && (
                <div className="divide-y divide-white/7 rounded-2xl border border-white/8 px-4">{currentPayments.map((payment) => <div key={payment.month} className="flex items-center justify-between gap-4 py-4"><div><b className="text-sm text-cream">{payment.month}</b><p className="mt-1 text-xs text-sand-400">{payment.method}</p><small className="text-[10px] text-sand-500">{payment.receipt}</small></div><div className="text-right"><b className="text-sm text-cream">{payment.amount}</b><Badge tone="success" className="mt-1">Төлөгдсөн</Badge></div></div>)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPay && <Dialog onClose={() => setShowPay(false)}>
        <p className="text-[10px] font-bold tracking-[.16em] text-sand">QPAY</p><h2 className="mt-2 font-serif text-2xl text-cream">Pay {currentAmount}</h2><p className="mt-2 text-sm text-sand-400">Scan QR with your bank app.</p>
        <div className="mx-auto mt-6 grid h-56 w-56 place-items-center rounded-2xl bg-cream p-4 shadow-lg shadow-sand/10"><QrCode className="h-44 w-44 text-onyx" strokeWidth={1.25} /></div>
        <div className="mt-5 rounded-xl border border-white/9 bg-black/20 p-4 text-center"><b className="block text-sm text-cream">{tenantName ?? 'СӨХ'} · {selectedUnit}</b><span className="mt-1 block text-xs text-sand-400">QR хүчинтэй хугацаа: 15 минут</span></div>
        <Button className="mt-5 w-full" onClick={() => { setShowPay(false); notify('Төлбөрийн баталгаажуулалтыг хүлээж байна.'); }}><WalletCards className="h-4 w-4" />Би төлсөн</Button>
      </Dialog>}

      {showMeter && <Dialog onClose={() => setShowMeter(false)}>
        <p className="text-[10px] font-bold tracking-[.16em] text-sand">3 АЛХМААР ИЛГЭЭНЭ</p><h2 className="mt-2 font-serif text-2xl text-cream">Усны заалт илгээх</h2><p className="mt-2 text-sm text-sand-400">1. Тоолуурын зургийг оруулна · 2. Заалтаа бичнэ · 3. Илгээнэ</p>
        <input ref={meterPhotoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMeterPhoto} />
        <button onClick={() => meterPhotoInput.current?.click()} className="mt-5 flex w-full items-center gap-4 rounded-2xl border border-dashed border-sand/35 bg-sand/5 p-4 text-left transition hover:bg-sand/10">
          {meterPhoto ? <img src={meterPhoto} alt="Тоолуурын зураг" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-white/8 text-sand"><ImagePlus className="h-5 w-5" /></span>}
          <span><b className="block text-sm text-cream">{meterPhoto ? 'Зураг сонгогдлоо' : 'Тоолуурын зураг оруулах'}</b><small className="mt-1 block text-xs text-sand-400">Камер эсвэл галерейгаас сонгоно</small></span>
        </button>
        <label className="mt-4 block text-xs font-semibold text-sand-200">Одоогийн заалт (м³)<Input inputMode="decimal" value={meterValue} onChange={(event) => setMeterValue(event.target.value)} className="mt-2" placeholder="Жишээ: 24" /></label>
        <Button disabled={!meterPhoto || !meterValue.trim()} className="mt-5 w-full" onClick={submitMeter}><Send className="h-4 w-4" />Заалтаа илгээх</Button>
      </Dialog>}

      {showRequest && <Dialog onClose={() => setShowRequest(false)}>
        <p className="text-[10px] font-bold tracking-[.16em] text-sand">ЗАСВАРЫН ДУУДЛАГА</p><h2 className="mt-2 font-serif text-2xl text-cream">Шинэ хүсэлт илгээх</h2><p className="mt-2 text-sm text-sand-400">Асуудлаа товч бичихэд СӨХ танд ажилтан онооно.</p>
        <label className="mt-5 block text-xs font-semibold text-sand-200">Асуудлын гарчиг<Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} className="mt-2" placeholder="Жишээ: Угаалгын өрөөний шугам" /></label>
        <label className="mt-4 block text-xs font-semibold text-sand-200">Тайлбар<textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-sm text-cream outline-none placeholder:text-sand-500 focus:border-sand/55 focus:ring-2 focus:ring-sand/10" placeholder="Хаана, ямар асуудал гарсныг бичээрэй." /></label>
        <input ref={requestPhotoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleRequestPhoto} />
        <button onClick={() => requestPhotoInput.current?.click()} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-white/18 px-4 py-3 text-left transition hover:border-sand/35 hover:bg-white/[.025]">{requestPhoto ? <img src={requestPhoto} alt="Хүсэлтийн зураг" className="h-10 w-10 rounded-lg object-cover" /> : <Camera className="h-4 w-4 text-sand" />}<span><b className="block text-xs text-cream">{requestPhoto ? 'Зураг хавсаргалаа' : 'Зураг хавсаргах (сонголтоор)'}</b><small className="block text-[10px] text-sand-400">Асуудлыг хурдан шийдэхэд тусална</small></span></button>
        <Button disabled={!requestTitle.trim()} loading={requestSubmitting} className="mt-5 w-full" onClick={() => void submitRequest()}><Send className="h-4 w-4" />Хүсэлт илгээх</Button>
      </Dialog>}

      {openNotice && <Dialog onClose={() => setOpenNotice(null)}>
        <Badge tone="info">{openNotice.audience}</Badge><h2 className="mt-4 font-serif text-2xl text-cream">{openNotice.title}</h2><p className="mt-2 text-xs text-sand-400">{openNotice.date}</p><p className="mt-6 text-sm leading-7 text-sand-200">{openNotice.body}</p>
      </Dialog>}

      {toast && <div className="fixed bottom-20 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-400/25 bg-[#17352d] px-4 py-3 text-center text-sm text-emerald-50 shadow-xl sm:bottom-6"><CheckCircle2 className="mr-2 inline h-4 w-4" />{toast}</div>}
    </section>
  );
}

