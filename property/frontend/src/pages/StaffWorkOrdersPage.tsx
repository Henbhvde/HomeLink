import { useRef, useState } from 'react';
import { Camera, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Droplets, ImagePlus, MapPin, Play, ScanLine, Wrench, X } from 'lucide-react';
import { useBackendState } from '../hooks/useBackendState';
import { PageStateWrapper } from '../components/ui';

type WorkStatus = 'assigned' | 'in_progress' | 'done';
type WorkOrder = {
  id: string;
  title: string;
  unit: string;
  place: string;
  priority: 'Яаралтай' | 'Өндөр' | 'Дунд';
  createdAt: string;
  image: string;
  status: WorkStatus;
  description: string;
  completionImage?: string;
};

const initialOrders: WorkOrder[] = [
  {
    id: 'REQ-245',
    title: 'Угаалгын өрөөний ус гоожиж байна',
    unit: 'A-0045',
    place: 'A байр · 4-р давхар',
    priority: 'Яаралтай',
    createdAt: 'Өнөөдөр, 10:24',
    status: 'assigned',
    description: 'Угаалгын өрөөний доод шугамнаас ус дусалж байна. Яаралтай шалгаж өгнө үү.',
    image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'REQ-238',
    title: 'Гал тогооны усны цорго сул',
    unit: 'B-0801',
    place: 'B байр · 8-р давхар',
    priority: 'Дунд',
    createdAt: 'Өчигдөр, 16:40',
    status: 'in_progress',
    description: 'Цоргоны суурь сулраад ус бага зэрэг нэвчиж байна.',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82',
  },
];

const statusCopy: Record<WorkStatus, { label: string; className: string }> = {
  assigned: { label: 'Шинэ оноолт', className: 'border-amber-200/25 bg-amber-300/10 text-amber-100' },
  in_progress: { label: 'Хийгдэж буй', className: 'border-sand-300/25 bg-sand/[.12] text-sand-100' },
  done: { label: 'Дууссан', className: 'border-emerald-200/25 bg-emerald-300/10 text-emerald-100' },
};

const priorityStyle: Record<WorkOrder['priority'], string> = {
  Яаралтай: 'border-rose-200/25 bg-rose-400/15 text-rose-100',
  Өндөр: 'border-amber-200/25 bg-amber-300/10 text-amber-100',
  Дунд: 'border-sand-400/20 bg-sand/[.10] text-sand-200',
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[.03em] ${className}`}>{children}</span>;
}

export default function StaffWorkOrdersPage() {
  const [orders, setOrders, status, retry] = useBackendState<WorkOrder[]>('staff-work-orders', initialOrders);
  const [selectedId, setSelectedId] = useState(initialOrders[0].id);
  const [completionPreview, setCompletionPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = orders.find((order) => order.id === selectedId) ?? orders[0] ?? initialOrders[0];
  const activeOrders = orders.filter((order) => order.status !== 'done');
  const assignedCount = orders.filter((order) => order.status === 'assigned').length;
  const progressCount = orders.filter((order) => order.status === 'in_progress').length;
  const doneCount = orders.filter((order) => order.status === 'done').length;
  const completionPercent = orders.length ? Math.round((doneCount / orders.length) * 100) : 0;
  const statusIndex: Record<WorkStatus, number> = { assigned: 0, in_progress: 1, done: 2 };

  const updateOrder = (id: string, update: Partial<WorkOrder>) => {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, ...update } : order));
  };

  const startWork = () => {
    updateOrder(selected.id, { status: 'in_progress' });
    setNotice(`${selected.id} ажлыг эхлүүллээ.`);
  };

  const attachCompletion = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCompletionPreview(url);
    updateOrder(selected.id, { completionImage: url });
  };

  const completeWork = () => {
    if (!selected.completionImage) {
      setNotice('Дууссан ажлын зургийг эхлээд хавсаргана уу.');
      return;
    }
    updateOrder(selected.id, { status: 'done' });
    setNotice(`${selected.id} хүсэлтийг дууссанд тэмдэглэлээ.`);
  };

  const selectOrder = (order: WorkOrder) => {
    setSelectedId(order.id);
    setCompletionPreview(order.completionImage ?? null);
  };

  return (
    <section className="space-y-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:pb-0">
      <PageStateWrapper
        status={status}
        isEmpty={orders.length === 0}
        onRetry={retry}
        emptyIcon={ClipboardCheck}
        emptyTitle="Одоогоор ажлын захиа алга"
        emptyDescription="Шинэ ажлын захиаг оноох үед энэ талбар автоматаар харагдана."
      >
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.45fr_.85fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-sand/25 bg-[radial-gradient(circle_at_85%_0%,rgba(197,168,128,.17),transparent_38%),linear-gradient(135deg,#1a1814_0%,#0d0c0b_62%,#11100e_100%)] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(197,168,128,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(197,168,128,.04)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border-[22px] border-sand/10" />
          <div className="absolute -bottom-16 right-20 h-36 w-36 rounded-full bg-sand/[.07] blur-2xl" />
          <div className="absolute right-5 top-5 flex overflow-hidden rounded-full border border-sand/20 bg-black/20 text-[8px] font-bold tracking-[.14em] text-sand-300 sm:right-7 sm:top-7"><span className="px-2.5 py-1.5">FIELD DESK</span><span className="border-l border-sand/20 bg-sand/[.12] px-2.5 py-1.5 text-sand-100">{String(activeOrders.length).padStart(2, '0')} OPEN</span></div>
          <div className="relative grid h-full gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[.19em] text-sand-300/75">ӨНӨӨДРИЙН ЭЭЛЖ</p>
              <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-cream sm:text-4xl">Сайн байна уу, Дорж.</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-200/70">Танд оноогдсон засварын ажлуудыг эндээс хурдан удирдаарай.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-xl border border-sand/15 bg-black/10 px-3 py-2 text-xs text-sand-200/80"><b className="mr-1.5 text-base text-cream">{activeOrders.length}</b> идэвхтэй ажил</span>
                <span className="rounded-xl border border-sand/15 bg-black/10 px-3 py-2 text-xs text-sand-200/80"><b className="mr-1.5 text-base text-cream">{assignedCount}</b> шинэ оноолт</span>
              </div>
            </div>
            <div className="rounded-2xl border border-sand/25 bg-black/20 p-3.5 backdrop-blur-sm sm:w-44">
              <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[.16em] text-sand-300/65"><ScanLine className="h-3 w-3" /> ОДООГИЙН АЖИЛ</span>
              <b className="mt-1.5 block font-serif text-3xl leading-none text-cream">{selected.unit}</b>
              <span className="mt-2 block text-[11px] leading-relaxed text-sand-200/65">{selected.place}</span>
              <span className="mt-3 inline-flex rounded-md border border-sand/20 bg-sand/[.10] px-2 py-1 text-[9px] font-bold text-sand-100">{selected.priority}</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-sand/20 bg-charcoal/80 p-5 shadow-xl shadow-black/10">
          <span className="absolute -right-1 top-3 rotate-90 text-[8px] font-bold tracking-[.25em] text-sand/25">WORK LOG</span>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-bold tracking-[.18em] text-sand-400">АЖЛЫН ТӨЛӨВ</p>
            <div className="relative grid h-12 w-12 place-items-center rounded-full p-[3px]" style={{ background: `conic-gradient(#c5a880 ${completionPercent}%, rgba(255,255,255,.10) 0)` }}><span className="grid h-full w-full place-items-center rounded-full bg-charcoal text-[10px] font-bold text-sand-100">{completionPercent}%</span></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Шинэ', value: assignedCount, color: 'text-amber-200' },
              { label: 'Явц', value: progressCount, color: 'text-sand-200' },
              { label: 'Дууссан', value: doneCount, color: 'text-emerald-200' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/[.07] bg-black/10 p-3">
                <b className={`block text-2xl font-semibold ${item.color}`}>{item.value}</b>
                <span className="mt-1 block text-[10px] font-medium text-white/45">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/[.07] bg-black/10 p-3">
            <div className="flex items-center justify-between gap-3 text-[11px]"><span className="flex items-center gap-2 text-white/55"><Wrench className="h-3.5 w-3.5 text-sand-300" /> Өнөөдрийн ахиц</span><b className="text-sand-100">{doneCount} / {orders.length}</b></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full bg-gradient-to-r from-sand-600 via-sand to-sand-200 transition-all" style={{ width: `${completionPercent}%` }} /></div>
          </div>
        </div>
      </div>

      {notice && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs shadow-lg ${notice.includes('эхлээд') ? 'border-amber-200/20 bg-amber-300/[.09] text-amber-50' : 'border-emerald-200/20 bg-emerald-300/[.09] text-emerald-50'}`} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="grid h-6 w-6 shrink-0 place-items-center rounded-lg hover:bg-white/10" aria-label="Мэдэгдэл хаах"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]">
        <aside className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-bold tracking-[.18em] text-sand-400">МИНИЙ ДАРААЛАЛ</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Ажлын дараалал</h2>
            </div>
            <span className="text-xs text-white/45">{activeOrders.length} нээлттэй</span>
          </div>

          <div className="relative lg:pl-7">
            <span className="absolute bottom-5 left-[9px] top-5 hidden border-l border-dashed border-sand/25 lg:block" aria-hidden="true" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {orders.map((order, index) => {
              const isSelected = selectedId === order.id;
              return (
                <div key={order.id} className="relative min-w-[82vw] snap-start sm:min-w-[300px] lg:min-w-0">
                  <span className={`absolute -left-7 top-5 z-10 hidden h-[19px] w-[19px] place-items-center rounded-full border text-[7px] font-bold lg:grid ${isSelected ? 'border-sand-200 bg-sand text-onyx shadow-[0_0_0_4px_rgba(197,168,128,.10)]' : 'border-sand/25 bg-onyx text-sand-400'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={() => selectOrder(order)}
                    aria-pressed={isSelected}
                    className={`relative min-h-44 w-full touch-manipulation overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[.99] ${isSelected ? 'border-sand-300/40 bg-sand/[.10] shadow-lg shadow-black/40' : 'border-white/[.09] bg-white/[.035] hover:border-sand/30 hover:bg-white/[.06]'}`}
                  >
                    {isSelected && <><span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-sand-200" /><span className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(135deg,rgba(197,168,128,.07)_1px,transparent_1px)] [background-size:10px_10px]" /></>}
                    <div className="relative flex items-start justify-between gap-2">
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${order.priority === 'Яаралтай' ? 'bg-rose-400/15 text-rose-100' : 'bg-sand/[.10] text-sand-200'}`}><Droplets className="h-4 w-4" /></span>
                      <Pill className={priorityStyle[order.priority]}>{order.priority}</Pill>
                    </div>
                    <b className="relative mt-3 line-clamp-2 block text-sm leading-snug text-cream">{order.title}</b>
                    <p className="relative mt-2 text-[11px] text-white/50">{order.unit} · {order.place}</p>
                    <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/[.07] pt-3">
                      <span className="flex items-center gap-2"><Pill className={statusCopy[order.status].className}>{statusCopy[order.status].label}</Pill>{isSelected && <span className="h-1.5 w-1.5 rounded-full bg-sand-200 shadow-[0_0_0_4px_rgba(197,168,128,.08)]" />}</span>
                      <ChevronRight className={`h-4 w-4 transition ${isSelected ? 'text-sand-100' : 'text-white/35'}`} />
                    </div>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </aside>

        <article className="overflow-hidden rounded-[2rem] border border-sand/20 bg-charcoal/95 shadow-2xl shadow-black/20 lg:grid lg:grid-cols-[minmax(220px,.76fr)_minmax(0,1.24fr)]">
          <div className="relative h-52 overflow-hidden sm:h-60 lg:h-auto lg:min-h-[610px]">
            <img src={selected.image} alt="Оршин суугчийн илгээсэн зураг" className="h-full w-full object-cover opacity-75" />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/25 to-black/20" />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-5 sm:top-5">
              <Pill className={priorityStyle[selected.priority]}>{selected.priority}</Pill>
              <Pill className={statusCopy[selected.status].className}>{statusCopy[selected.status].label}</Pill>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[11px] font-medium text-cream/85 sm:left-5"><Camera className="h-4 w-4 text-sand-200" /> Оршин суугчийн илгээсэн зураг</div>
            <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-sand/25 bg-black/35 px-2.5 py-1.5 text-[8px] font-bold tracking-[.12em] text-sand-100 sm:right-5"><ScanLine className="h-3 w-3" /> BEFORE / 01</span>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-sand-400"><span className="h-px w-5 bg-sand/50" />{selected.id}<span className="text-sand-600">WORK ORDER</span></p>
                <h2 className="mt-2 max-w-xl font-serif text-2xl font-medium leading-tight text-cream sm:text-3xl">{selected.title}</h2>
              </div>
              <span className="rounded-xl border border-sand/25 bg-sand/[.10] px-3 py-2 text-xs font-bold text-sand-100">{selected.unit}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <span className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-black/10 px-3 py-2.5 text-xs text-white/65"><MapPin className="h-4 w-4 text-sand-300" />{selected.place}</span>
              <span className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-black/10 px-3 py-2.5 text-xs text-white/65"><Clock3 className="h-4 w-4 text-sand-300" />Ирсэн: {selected.createdAt}</span>
            </div>

            <p className="mt-4 rounded-2xl border border-white/[.07] bg-black/10 p-4 text-sm leading-relaxed text-white/72">{selected.description}</p>

            <div className="mt-5 rounded-2xl border border-sand/15 bg-black/10 p-4">
              <p className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-sand-400"><ClipboardCheck className="h-3.5 w-3.5 text-sand-300" /> АЖЛЫН ЯВЦЫН ХЯНАЛТ</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['Оноогдсон', 'Хийгдэж буй', 'Дууссан'].map((step, index) => {
                  const complete = index <= statusIndex[selected.status];
                  return (
                    <div key={step} className="relative text-center">
                      {index < 2 && <span className={`absolute left-[calc(50%+15px)] top-3 h-px w-[calc(100%-30px)] ${index < statusIndex[selected.status] ? 'bg-sand-200/60' : 'bg-white/10'}`} />}
                      <span className={`relative mx-auto grid h-6 w-6 place-items-center rounded-full border text-[10px] ${complete ? 'border-sand-200/50 bg-sand-200 text-onyx' : 'border-white/15 bg-white/[.03] text-white/35'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                      <span className={`mt-1.5 block text-[10px] ${complete ? 'text-sand-100' : 'text-white/35'}`}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {selected.status === 'assigned' && (
              <div className="mt-6 rounded-2xl border border-sand/20 bg-[linear-gradient(120deg,rgba(197,168,128,.13),rgba(0,0,0,.08))] p-3">
                <p className="px-1 text-[9px] font-bold tracking-[.17em] text-sand-400">TOOLBOX · START WORK</p>
                <button type="button" onClick={startWork} className="mt-3 flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-sand px-4 py-3.5 text-sm font-bold text-onyx shadow-lg shadow-black/30 transition hover:bg-sand-200 active:scale-[.99]">
                  <Play className="h-4 w-4 fill-current" /> Ажил эхлүүлэх
                </button>
              </div>
            )}

            {selected.status === 'in_progress' && (
              <div className="mt-6 space-y-3 rounded-2xl border border-sand/20 bg-[linear-gradient(120deg,rgba(197,168,128,.1),rgba(0,0,0,.08))] p-3">
                <p className="px-1 text-[9px] font-bold tracking-[.17em] text-sand-400">TOOLBOX · PROOF OF WORK</p>
                <div className="rounded-2xl border border-sand/20 bg-sand/[.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <b className="block text-sm text-white">Дууссан ажлын зураг</b>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">Ажил дууссаныг баталгаажуулахын тулд зураг заавал хавсаргана.</p>
                    </div>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => attachCompletion(event.target.files?.[0])} />
                    <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 shrink-0 touch-manipulation items-center gap-2 rounded-xl border border-sand/30 bg-white/[.06] px-4 py-2.5 text-xs font-bold text-sand-100 transition hover:bg-white/[.12]">
                      <ImagePlus className="h-4 w-4" /> Зураг нэмэх
                    </button>
                  </div>
                  {(completionPreview || selected.completionImage) ? <img src={completionPreview ?? selected.completionImage} alt="Дууссан ажлын зураг" className="mt-4 h-40 w-full rounded-xl object-cover" /> : <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-sand/35 bg-black/10 p-3 text-left transition hover:bg-white/[.05]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand/[.10] text-sand-200"><Camera className="h-5 w-5" /></span><span><b className="block text-xs text-sand-100">Дууссан ажлын зургаа дарна уу</b><small className="mt-0.5 block text-[10px] text-white/45">Camera эсвэл gallery-гээс сонгох</small></span></button>}
                </div>
                <button type="button" onClick={completeWork} className="flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3.5 text-sm font-bold text-[#073226] shadow-lg shadow-emerald-400/15 transition hover:bg-emerald-200 active:scale-[.99]">
                  <CheckCircle2 className="h-4 w-4" /> Дууссан гэж тэмдэглэх
                </button>
              </div>
            )}

            {selected.status === 'done' && (
              <div className="mt-6 rounded-2xl border border-emerald-200/20 bg-[linear-gradient(120deg,rgba(110,231,183,.12),rgba(0,0,0,.08))] p-4">
                <div className="flex items-center gap-3 text-sm text-emerald-50"><span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-100/40 bg-emerald-300 text-[#063326] shadow-[0_0_0_4px_rgba(110,231,183,.08)]"><CheckCircle2 className="h-5 w-5" /></span><span><b className="block">Ажил амжилттай дууссан</b><small className="mt-0.5 block text-emerald-100/65">Дууссан ажлын зураг хавсаргагдсан.</small></span></div>
                {selected.completionImage && <img src={selected.completionImage} alt="Дууссан ажлын зураг" className="mt-4 h-40 w-full rounded-xl object-cover" />}
              </div>
            )}
          </div>
        </article>
      </div>

      {selected.status !== 'done' && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 sm:hidden">
          <div className="flex items-center gap-2 rounded-[1.35rem] border border-sand/25 bg-[#11100e]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <span className="min-w-[64px] border-r border-sand/15 px-2 text-center"><b className="block text-xs text-sand-100">{selected.unit}</b><small className="mt-0.5 flex items-center justify-center gap-1 text-[8px] font-bold tracking-[.08em] text-sand-500"><i className="h-1.5 w-1.5 rounded-full bg-sand-200" /> LIVE</small></span>
            <button type="button" onClick={selected.status === 'assigned' ? startWork : selected.completionImage ? completeWork : () => inputRef.current?.click()} className={`flex min-h-14 flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold shadow-lg active:scale-[.99] ${selected.status === 'assigned' ? 'bg-sand text-onyx shadow-black/30' : 'bg-emerald-300 text-[#073226] shadow-emerald-950/40'}`}>
              {selected.status === 'assigned' ? <><Play className="h-4 w-4 fill-current" /> Ажил эхлүүлэх</> : selected.completionImage ? <><CheckCircle2 className="h-4 w-4" /> Дууссан гэж тэмдэглэх</> : <><ImagePlus className="h-4 w-4" /> Дууссан зургийг нэмэх</>}
            </button>
          </div>
        </div>
      )}
      </PageStateWrapper>
    </section>
  );
}
