import { useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplets,
  ImagePlus,
  PhoneCall,
  Send,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useResidentPortal } from '../contexts/ResidentPortalContext';
import { useBackendState } from '../hooks/useBackendState';
import { PageStateWrapper } from '../components/ui';

type TicketStatus = 'submitted' | 'assigned' | 'inProgress' | 'done';

type ServiceTicket = {
  id: string;
  title: string;
  detail: string;
  category: string;
  createdAt: string;
  status: TicketStatus;
  hasPhoto?: boolean;
  rating?: number;
};

const statusCopy: Record<TicketStatus, string> = {
  submitted: 'Хүсэлт илгээгдсэн',
  assigned: 'Ажилтан оноосон',
  inProgress: 'Хийгдэж буй',
  done: 'Дууссан',
};

const statusTone: Record<TicketStatus, 'neutral' | 'success' | 'warning' | 'info'> = {
  submitted: 'info',
  assigned: 'warning',
  inProgress: 'warning',
  done: 'success',
};

const ticketStages: { key: TicketStatus; label: string }[] = [
  { key: 'submitted', label: 'Илгээсэн' },
  { key: 'assigned', label: 'Оноосон' },
  { key: 'inProgress', label: 'Ажиллаж буй' },
  { key: 'done', label: 'Дууссан' },
];

const initialTickets: ServiceTicket[] = [
  {
    id: '#245',
    title: 'Угаалгын өрөөний шугам',
    detail: 'Усны гоожилт үргэлжилж байна.',
    category: 'Сантехник',
    createdAt: 'Өнөөдөр, 10:40',
    status: 'inProgress',
    hasPhoto: true,
  },
  {
    id: '#236',
    title: '4-р давхрын гэрэлтүүлэг',
    detail: 'Орцны шатны гэрэл солигдсон.',
    category: 'Нийтийн талбай',
    createdAt: '07.16',
    status: 'done',
  },
];

function previewFromEvent(event: ChangeEvent<HTMLInputElement>, onChange: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  onChange(URL.createObjectURL(file));
}

function MiniTimeline({ status }: { status: TicketStatus }) {
  const activeIndex = ticketStages.findIndex((stage) => stage.key === status);

  return (
    <div className="mt-4 grid grid-cols-4 gap-1" aria-label={`Хүсэлтийн явц: ${statusCopy[status]}`}>
      {ticketStages.map((stage, index) => {
        const isComplete = index <= activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <div key={stage.key} className="relative min-w-0">
            {index < ticketStages.length - 1 && (
              <span className={`absolute left-1/2 top-[9px] h-px w-full ${index < activeIndex ? 'bg-emerald-300/80' : 'bg-white/10'}`} />
            )}
            <span className={`relative z-10 mx-auto grid h-[19px] w-[19px] place-items-center rounded-full border text-[9px] ${isComplete ? 'border-emerald-300/60 bg-emerald-300 text-onyx' : 'border-white/15 bg-[#151513] text-sand-500'} ${isCurrent ? 'motion-soft-pulse' : ''}`}>
              {isComplete ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className={`mt-1.5 block truncate text-center text-[9px] font-medium ${isComplete ? 'text-sand-200' : 'text-sand-500'}`}>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ResidentServicesPage() {
  const { selectedUnit } = useResidentPortal();
  const meterInputRef = useRef<HTMLInputElement>(null);
  const repairInputRef = useRef<HTMLInputElement>(null);
  const [meterPhoto, setMeterPhoto] = useState<string | null>(null);
  const [meterValue, setMeterValue] = useState('');
  const [meterSubmitted, setMeterSubmitted] = useState(false);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [repairTitle, setRepairTitle] = useState('');
  const [repairDetail, setRepairDetail] = useState('');
  const [repairCategory, setRepairCategory] = useState('Сантехник');
  const [repairPhoto, setRepairPhoto] = useState<string | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [tickets, setTickets, status, retry] = useBackendState<ServiceTicket[]>('resident-service-tickets', initialTickets);
  const [toast, setToast] = useState<string | null>(null);
  const serviceCardClass = 'relative h-full overflow-hidden border-sand/20 bg-[linear-gradient(145deg,rgba(43,42,38,.92),rgba(25,26,23,.96))] shadow-[0_16px_38px_rgba(0,0,0,.16)]';

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const meterStep = meterSubmitted ? 3 : meterValue.trim() ? 2 : meterPhoto ? 1 : 0;
  const householdReadiness = meterSubmitted ? 100 : meterPhoto && meterValue.trim() ? 78 : 54;

  const submitMeter = () => {
    if (!meterPhoto || !meterValue.trim()) {
      setMeterError('Тоолуурын зураг болон одоогийн заалтаа оруулна уу.');
      return;
    }
    setMeterError(null);
    setMeterSubmitted(true);
    notify('Усны заалт хянуулахаар амжилттай илгээгдлээ.');
  };

  if (!selectedUnit) return <Navigate to="/resident" replace />;

  const submitRepair = () => {
    if (!repairTitle.trim()) {
      setRepairError('Асуудлын гарчгийг оруулна уу.');
      return;
    }

    setTickets((current) => [
      {
        id: `#${246 + current.length}`,
        title: repairTitle.trim(),
        detail: repairDetail.trim() || 'Таны хүсэлтийг СӨХ-ийн баг хүлээн авч байна.',
        category: repairCategory,
        createdAt: 'Дөнгөж сая',
        status: 'submitted',
        hasPhoto: Boolean(repairPhoto),
      },
      ...current,
    ]);
    setRepairTitle('');
    setRepairDetail('');
    setRepairCategory('Сантехник');
    setRepairPhoto(null);
    setRepairError(null);
    notify('Засварын хүсэлт илгээгдлээ. Ажилтан оноогдоход мэдэгдэнэ.');
  };

  const rateTicket = (id: string, rating: number) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, rating } : ticket));
    notify('Үнэлгээ өгсөнд баярлалаа.');
  };

  return (
    <section className="space-y-5 pb-4">
      <PageStateWrapper
        status={status}
        isEmpty={tickets.length === 0}
        onRetry={retry}
        emptyIcon={Wrench}
        emptyTitle="Одоогоор үйлчилгээний хүсэлт алга"
        emptyDescription="Шинэ засварын хүсэлтээ үлдээхэд энэ хэсэг автоматаар харагдана."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">{selectedUnit} · EVERGREEN RESIDENCE</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream sm:text-4xl">Гэрийн үйлчилгээ.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-400">Тоолуурын заалтаа илгээж, засварын хүсэлтээ үүсгээд явцыг нь нэг дороос дагаарай.</p>
        </div>
        <a href="tel:77778888" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sand/25 bg-sand/5 px-4 text-xs font-semibold text-sand-200 transition hover:border-sand/60 hover:bg-sand/10">
          <PhoneCall className="h-3.5 w-3.5 text-sand" /> Яаралтай тусламж <span className="text-sand">7777-8888</span>
        </a>
      </div>

      <Card className={serviceCardClass}>
        <CardContent className="relative grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-sand"><Sparkles className="h-3.5 w-3.5" /> ГЭРИЙН ИМПУЛЬС</div>
            <h2 className="mt-2 font-serif text-2xl text-cream">Энэ сарын анхаарах зүйлс</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${meterSubmitted ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`}>
                <Droplets className="mr-1 inline h-3.5 w-3.5" /> {meterSubmitted ? 'Заалт илгээгдсэн' : 'Усны заалт хүлээгдэж буй'}
              </span>
              <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100"><Wrench className="mr-1 inline h-3.5 w-3.5" /> 1 засвар хийгдэж буй</span>
              <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-[11px] font-semibold text-sand-200"><Clock3 className="mr-1 inline h-3.5 w-3.5" /> 07.24 хүртэл</span>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-black/20 p-3.5 sm:min-w-[216px]">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-[5px]" style={{ background: `conic-gradient(#c5a880 ${householdReadiness}%, rgba(255,255,255,.09) 0)` }}>
              <div className="grid h-full w-full place-items-center rounded-full bg-[#171715] text-center">
                <b className="text-lg leading-none text-cream">{householdReadiness}%</b>
                <span className="mt-0.5 text-[8px] font-bold tracking-wide text-sand-400">БЭЛЭН</span>
              </div>
            </div>
            <div>
              <b className="block text-xs text-cream">Гэрийн төлөв</b>
              <span className="mt-1 block max-w-[120px] text-[10px] leading-relaxed text-sand-400">Сар бүрийн 3 гол үйлдлийг эндээс дуусгана.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Card className={serviceCardClass}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">САР БҮРИЙН ЗААЛТ · ≤3 АЛХАМ</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">Усны заалт илгээх</h2>
                <p className="mt-2 text-xs leading-relaxed text-sand-400">Зураг → заалт → илгээх. Илгээсэн мэдээллийг СӨХ хянаад баталгаажуулна.</p>
              </div>
              <Badge tone={meterSubmitted ? 'success' : 'warning'}>{meterSubmitted ? 'Илгээгдсэн' : '07.24 хүртэл'}</Badge>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {['Зураг', 'Заалт', 'Илгээх'].map((label, index) => {
                const isDone = meterStep > index;
                const isCurrent = !meterSubmitted && meterStep === index;
                return <div key={label} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 ${isDone ? 'border-emerald-300/25 bg-emerald-300/10' : isCurrent ? 'border-sand/35 bg-sand/10' : 'border-white/7 bg-black/15'}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-300 text-onyx' : isCurrent ? 'bg-sand text-onyx' : 'bg-white/8 text-sand-500'}`}>{isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}</span>
                  <span className={`truncate text-[10px] font-semibold ${isDone || isCurrent ? 'text-cream' : 'text-sand-500'}`}>{label}</span>
                </div>;
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_.9fr]">
              <input ref={meterInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { previewFromEvent(event, setMeterPhoto); setMeterError(null); }} />
              <button type="button" onClick={() => meterInputRef.current?.click()} className="group flex min-h-[106px] items-center gap-3 rounded-2xl border border-dashed border-sand/35 bg-sand/[.045] p-3.5 text-left transition hover:border-sand/70 hover:bg-sand/10">
                {meterPhoto ? <img src={meterPhoto} alt="Тоолуурын зураг" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sand/10 text-sand transition group-hover:bg-sand/20"><Camera className="h-5 w-5" /></span>}
                <span className="min-w-0">
                  <b className="block text-sm text-cream">{meterPhoto ? 'Зураг сонгогдлоо' : 'Тоолуурын зураг нэмэх'}</b>
                  <small className="mt-1 block text-[11px] leading-relaxed text-sand-400">Камераар авах эсвэл галерейгаас сонгох</small>
                </span>
                {meterPhoto && <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-sand-300"><Check className="h-3.5 w-3.5" /></span>}
              </button>
              <label className="rounded-2xl border border-white/8 bg-black/15 p-3.5">
                <span className="text-[10px] font-bold tracking-[.13em] text-sand-300">ОДООГИЙН ЗААЛТ · М³</span>
                <Input inputMode="decimal" value={meterValue} onChange={(event) => { setMeterValue(event.target.value); setMeterError(null); }} className="mt-2 border-0 bg-transparent px-0 text-lg font-semibold text-cream focus:ring-0" placeholder="Жишээ: 24" />
                <span className="mt-1 block text-[10px] text-sand-500">Өмнөх заалт: 17 м³</span>
              </label>
            </div>

            {meterError && <p className="mt-3 text-xs text-red-200">{meterError}</p>}
            {meterSubmitted && <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] p-3 text-xs leading-relaxed text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Таны заалтыг хянуулахаар илгээлээ. Баталгаажмагц нэхэмжлэлд тусна.</div>}
            <Button className="mt-4 w-full" onClick={submitMeter} disabled={meterSubmitted}><Send className="h-4 w-4" />{meterSubmitted ? 'Илгээсэн' : 'Заалтаа илгээх'}</Button>
          </CardContent>
        </Card>

        <Card className={serviceCardClass}>
          <CardContent className="relative p-5 sm:p-6">
            <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sand/10 blur-2xl" />
            <p className="text-[10px] font-bold tracking-[.16em] text-sand">ШУУРХАЙ ТУСЛАМЖ</p>
            <h2 className="mt-2 font-serif text-2xl text-cream">Яаралтай асуудал уу?</h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-sand-400">Ус алдах, цахилгааны аюултай гэмтэл зэрэг үед засварын хүсэлт үүсгэхээс гадна жижүүрт шууд мэдэгдээрэй.</p>

            <a href="tel:77778888" className="mt-5 flex items-center justify-between rounded-2xl border border-sand/25 bg-sand/[.06] p-4 transition hover:border-sand/60 hover:bg-sand/10">
              <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sand text-onyx"><PhoneCall className="h-4 w-4" /></span><span><b className="block text-sm text-cream">Жижүүрийн утас</b><small className="block text-[10px] text-sand-400">24/7 холбогдоно</small></span></span>
              <span className="text-sm font-semibold text-sand">7777-8888</span>
            </a>

            <div className="mt-5 border-t border-white/8 pt-4">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-[.14em] text-sand-400"><span>ХҮСЭЛТИЙН АМЛАЛТ</span><span className="text-emerald-200">SLA 92%</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-black/18 p-3"><b className="block font-serif text-2xl text-cream">1.1ц</b><span className="mt-1 block text-[10px] text-sand-400">Яаралтай хүсэлт</span></div>
                <div className="rounded-xl bg-black/18 p-3"><b className="block font-serif text-2xl text-cream">4.2ц</b><span className="mt-1 block text-[10px] text-sand-400">Дундаж шийдэл</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <Card className={serviceCardClass}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">ЗАСВАРЫН ДУУДЛАГА</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">Шинэ хүсэлт</h2>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Wrench className="h-4 w-4" /></span>
            </div>

            <label className="mt-5 block text-[10px] font-bold tracking-[.13em] text-sand-300">ТӨРӨЛ
              <select value={repairCategory} onChange={(event) => setRepairCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-cream outline-none transition focus:border-sand/50 focus:ring-2 focus:ring-sand/10">
                <option>Сантехник</option>
                <option>Цахилгаан</option>
                <option>Нийтийн талбай</option>
                <option>Бусад</option>
              </select>
            </label>
            <label className="mt-4 block text-[10px] font-bold tracking-[.13em] text-sand-300">АСУУДЛЫН ГАРЧИГ
              <Input value={repairTitle} onChange={(event) => { setRepairTitle(event.target.value); setRepairError(null); }} className="mt-2" placeholder="Жишээ: Угаалгын өрөөний шугам гоожиж байна" />
            </label>
            <label className="mt-4 block text-[10px] font-bold tracking-[.13em] text-sand-300">ТАЙЛБАР <span className="normal-case tracking-normal text-sand-500">(сонголтоор)</span>
              <textarea value={repairDetail} onChange={(event) => setRepairDetail(event.target.value)} className="mt-2 min-h-[88px] w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-cream outline-none transition placeholder:text-sand-500 focus:border-sand/50 focus:ring-2 focus:ring-sand/10" placeholder="Хаана, хэр удаан үргэлжилсэн зэргийг товч бичээрэй." />
            </label>

            <input ref={repairInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => previewFromEvent(event, setRepairPhoto)} />
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-white/18 bg-white/[.018] p-3">
              {repairPhoto ? <img src={repairPhoto} alt="Хүсэлтийн хавсралт" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/7 text-sand"><ImagePlus className="h-4 w-4" /></span>}
              <button type="button" onClick={() => repairInputRef.current?.click()} className="min-w-0 flex-1 text-left"><b className="block text-xs text-cream">{repairPhoto ? 'Зураг хавсаргасан' : 'Зураг хавсаргах'}</b><small className="mt-0.5 block text-[10px] text-sand-400">Сонголтоор · Асуудлыг хурдан тодорхойлоход тусална</small></button>
              {repairPhoto && <button type="button" onClick={() => setRepairPhoto(null)} className="grid h-8 w-8 place-items-center rounded-lg text-sand-400 transition hover:bg-white/8 hover:text-cream" aria-label="Зургийг арилгах"><X className="h-4 w-4" /></button>}
            </div>

            {repairError && <p className="mt-3 text-xs text-red-200">{repairError}</p>}
            <Button className="mt-4 w-full" onClick={submitRepair}><Send className="h-4 w-4" />Хүсэлт илгээх</Button>
          </CardContent>
        </Card>

        <Card className={serviceCardClass}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">МИНИЙ ХҮСЭЛТҮҮД</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">Явцаа хянах</h2>
              </div>
              <Badge tone="info">{tickets.filter((ticket) => ticket.status !== 'done').length} идэвхтэй</Badge>
            </div>

            <div className="mt-5 space-y-3">
              {tickets.map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-white/8 bg-black/[.13] p-4 transition hover:border-sand/25">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><b className="text-sm text-cream">{ticket.title}</b><span className="text-[10px] font-semibold text-sand-500">{ticket.id}</span></div>
                      <p className="mt-1 text-xs leading-relaxed text-sand-400">{ticket.detail}</p>
                    </div>
                    <Badge tone={statusTone[ticket.status]} className="self-start whitespace-nowrap">{statusCopy[ticket.status]}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-sand-500"><span>{ticket.category}</span><span className="h-1 w-1 rounded-full bg-sand-700" /><span>{ticket.createdAt}</span>{ticket.hasPhoto && <><span className="h-1 w-1 rounded-full bg-sand-700" /><span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> зурагтай</span></>}</div>
                  <MiniTimeline status={ticket.status} />
                  {ticket.status === 'done' && (
                    <div className="mt-4 flex flex-col gap-2 border-t border-white/7 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[11px] text-sand-400">{ticket.rating ? 'Таны үнэлгээ' : 'Ажил дууссан уу? Үнэлгээ үлдээгээрэй.'}</span>
                      {ticket.rating ? <span className="inline-flex items-center gap-1 text-amber-200">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < ticket.rating! ? 'fill-current' : 'text-sand-700'}`} />)}<span className="ml-1 text-[10px] text-sand-400">{ticket.rating}/5</span></span> : <span className="flex items-center gap-1">{Array.from({ length: 5 }).map((_, index) => <button type="button" key={index} onClick={() => rateTicket(ticket.id, index + 1)} className="rounded p-0.5 text-sand-500 transition hover:scale-110 hover:text-amber-200" aria-label={`${index + 1} одоор үнэлэх`}><Star className="h-4 w-4" /></button>)}</span>}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-sand/18 bg-sand/[.045] px-4 py-3 text-xs text-sand-300"><span>Явц өөрчлөгдөх бүрд мэдэгдэл илгээнэ.</span><ChevronRight className="h-4 w-4 text-sand" /></div>
          </CardContent>
        </Card>
      </div>

      {toast && <div className="fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-[#17352d] px-4 py-3 text-center text-sm text-emerald-50 shadow-xl sm:bottom-6"><CheckCircle2 className="h-4 w-4 shrink-0" />{toast}</div>}
      </PageStateWrapper>
    </section>
  );
}
