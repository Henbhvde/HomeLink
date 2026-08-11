import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, BarChart3, BellRing, Building2, CheckCircle2, Clock3, CreditCard, Gauge, MapPinned, MoreHorizontal, Pin, TriangleAlert, Users, WalletCards, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import { useUserPreference } from '../hooks/useUserPreference';
import AdvancedDashboardWidgets from '../components/dashboard/AdvancedDashboardWidgets';

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden rounded-2xl border border-sand/25 bg-sand/[.035] p-4 shadow-[0_12px_28px_rgba(93,70,38,.08)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_4%,rgba(197,168,128,.08),transparent_42%)]" />
      <div className="relative">{children}</div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[8px] font-bold tracking-[.18em] text-sand-500">{children}</p>;
}

const formatMnt = (amount: number) => {
  if (amount >= 1000000) return `₮${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₮${(amount / 1000).toFixed(0)}K`;
  return `₮${amount.toLocaleString()}`;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [pinnedWidgets, setPinnedWidgets] = useUserPreference<string[]>('manager:pinned-widgets', ['collection', 'billing']);
  const widgetOptions = [{ id: 'collection', label: 'Цуглуулалт', path: '/manager/payments' }, { id: 'billing', label: 'Нэхэмжлэл', path: '/manager/billing' }, { id: 'maintenance', label: 'Засвар', path: '/manager/maintenance' }];
  const togglePin = (id: string) => setPinnedWidgets((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['manager-dashboard-stats', token],
    queryFn: () => apiClient.getManagerDashboardStats(token || ''),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex h-[75vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sand border-t-transparent mx-auto"></div>
          <p className="mt-4 text-xs font-bold tracking-[.16em] text-sand-500">УДИРДЛАГЫН СИСТЕМ</p>
          <h2 className="mt-1 font-serif text-lg text-cream">Хяналтын самбарыг ачаалж байна...</h2>
        </div>
      </div>
    );
  }

  const collectionRate = stats?.collection?.rate ?? 0;
  const collectionTarget = stats?.collection?.target ?? 95;
  const collectionGrowth = stats?.collection?.growth ?? 0;
  const attention = stats?.attention ?? [];
  const receivablesTotal = stats?.receivables?.total ?? 0;
  const receivablesUnitCount = stats?.receivables?.unitCount ?? 0;
  const receivablesChange = stats?.receivables?.change ?? 0;
  const avgResolutionTime = stats?.resolution?.avgHours ?? 0;
  const resolutionTimeChange = stats?.resolution?.change ?? 0;
  const monthlyCollection = stats?.monthlyCollection ?? [];
  const serviceSla = stats?.serviceSla ?? { slaRate: 0, avgHours: 0, urgentHours: 0, openCount: 0 };
  const residence = stats?.residence ?? { activeCount: 0, totalCount: 0, newCount: 0 };
  const property = residence.property ?? { name: 'HomeLink', address: 'Ulaanbaatar' };
  const propertyMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(`${property.name}, ${property.address}`)}&z=19&iwloc=near&output=embed`;
  const agingValues = stats?.aging ?? { age0to30: 0, age31to60: 0, age61plus: 0 };
  const advancedWidgets = stats?.advancedWidgets;

  const totalAging = agingValues.age0to30 + agingValues.age31to60 + agingValues.age61plus;
  const aging = [
    { label: '0–30 хоног', value: formatMnt(agingValues.age0to30), width: totalAging > 0 ? `${(agingValues.age0to30 / totalAging * 100).toFixed(0)}%` : '54%', tone: 'from-sand-700 via-sand to-sand-200' },
    { label: '31–60 хоног', value: formatMnt(agingValues.age31to60), width: totalAging > 0 ? `${(agingValues.age31to60 / totalAging * 100).toFixed(0)}%` : '29%', tone: 'from-amber-800 via-amber-500 to-amber-300' },
    { label: '61+ хоног', value: formatMnt(agingValues.age61plus), width: totalAging > 0 ? `${(agingValues.age61plus / totalAging * 100).toFixed(0)}%` : '17%', tone: 'from-red-900 via-red-600 to-red-400' },
  ];

  // Dynamically calculate SVG paths for collection performance line chart
  const svgWidth = 620;
  const svgHeight = 100;
  const points = monthlyCollection.map((item: any, i: number) => {
    const x = i * (svgWidth / Math.max(1, monthlyCollection.length - 1));
    const y = 90 - (item.value / 100) * 70; // Map value (e.g. 0-100) to Y space (20 to 90)
    return { x, y };
  });
  const lineD = points.length > 0 ? points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') : 'M0,73 L620,24';
  const areaD = `${lineD} L${svgWidth},${svgHeight} L0,${svgHeight} Z`;

  return (
    <section className="residence-command relative isolate pb-5">
      <style>{`.residence-command .text-cream { color: #e3dbce; }.residence-command .metric-number { letter-spacing: -.04em; }`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-sand/[.055] blur-3xl" />
        <div className="absolute right-0 top-24 h-60 w-60 rounded-full bg-amber-400/[.035] blur-3xl" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-sand/25 bg-sand/[.10] text-sand"><Building2 className="h-4 w-4" /></span>
          <div><Label>EVERGREEN RESIDENCE · УДИРДЛАГЫН СИСТЕМ</Label><h1 className="mt-0.5 font-serif text-xl text-cream">Хяналтын самбар</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-sand/20 bg-sand/[.08] px-2.5 py-2 text-[9px] font-bold tracking-[.12em] text-sand-400 sm:inline-flex">
            2026 · {new Date().getMonth() + 1} САР
          </span>
          <button type="button" onClick={() => navigate('/pricing')} className="inline-flex items-center gap-2 rounded-lg border border-sand/30 bg-sand/[.10] px-3 py-2 text-[10px] font-bold text-sand-100 transition hover:bg-sand hover:text-onyx">
            <BarChart3 className="h-3.5 w-3.5" /> Pricing <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-sand/15 bg-sand/[.035] p-2.5" aria-label="Pinned widgets">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[9px] font-bold tracking-wide text-sand-500"><Pin className="h-3 w-3" /> ТОГТООСОН</span>
        {widgetOptions.map((widget) => <button type="button" key={widget.id} onClick={() => pinnedWidgets.includes(widget.id) ? navigate(widget.path) : togglePin(widget.id)} onContextMenu={(event) => { event.preventDefault(); togglePin(widget.id); }} title={pinnedWidgets.includes(widget.id) ? 'Нээх · салгахдаа right-click' : 'Pin хийх'} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${pinnedWidgets.includes(widget.id) ? 'border-sand/35 bg-sand/15 text-cream' : 'border-white/10 text-sand-500'}`}>{widget.label}{!pinnedWidgets.includes(widget.id) && ' +'}</button>)}
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-[238px_minmax(0,1fr)_288px]">
        <div className="grid gap-3">
          <Panel className="h-full">
            <div className="flex items-start justify-between"><div><Label>COLLECTION PULSE</Label><h2 className="mt-1 font-serif text-lg text-cream">Цуглуулалт</h2></div><Gauge className="h-4 w-4 text-sand" /></div>
            <div className="mt-4 flex justify-center">
              <div className="relative grid h-36 w-36 place-items-center rounded-full p-[9px] shadow-[0_0_28px_rgba(197,168,128,.10)]" style={{ background: `conic-gradient(#c99c63 0 ${collectionRate}%, rgba(236,224,202,.14) ${collectionRate}% 100%)` }}>
                <span className="absolute inset-[7px] rounded-full border border-sand/20 bg-[radial-gradient(circle_at_42%_35%,rgba(197,168,128,.18),rgba(197,168,128,.06)_68%)]" />
                <span className="absolute -left-1 top-8 h-3 w-3 rounded-full border-2 border-sand-100 bg-sand/[.12]" />
                <span className="absolute bottom-4 -right-1 h-3 w-3 rounded-full bg-sand shadow-[0_0_0_4px_rgba(197,168,128,.08)]" />
                <div className="relative text-center"><b className="metric-number text-4xl font-semibold leading-none text-cream">{collectionRate}%</b><small className="mt-1.5 block text-[8px] font-bold tracking-[.12em] text-sand-400">ЭНЭ САР</small></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 border-t border-sand/15 pt-3 text-center">
              <div><Label>ЗОРИЛТ</Label><b className="metric-number mt-1 block text-base font-semibold text-cream">{collectionTarget}%</b></div>
              <div className="border-l border-sand/15"><Label>ӨСӨЛТ</Label><b className={`metric-number mt-1 block text-base font-semibold ${collectionGrowth >= 0 ? 'text-emerald-200' : 'text-rose-300'}`}>{collectionGrowth >= 0 ? `+${collectionGrowth}%` : `${collectionGrowth}%`}</b></div>
            </div>
          </Panel>

          <Panel className="h-full">
            <div className="flex items-start justify-between"><div><Label>PRIORITY QUEUE</Label><h2 className="mt-1 font-serif text-lg text-cream">Анхаарах зүйлс</h2></div><BellRing className="h-4 w-4 text-sand" /></div>
            <div className="mt-4 space-y-0 divide-y divide-sand/10 rounded-xl border border-sand/15 bg-sand/[.045]">
              {attention.map((item: any, index: number) => (
                <div key={item.title} className="flex items-center gap-2.5 p-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[8px] font-bold ${item.tone === 'danger' ? 'border-red-300/30 bg-red-300/[.1] text-red-100' : item.tone === 'warning' ? 'border-amber-300/30 bg-amber-300/[.1] text-amber-100' : 'border-sand/30 bg-sand/[.1] text-sand-100'}`}>0{index + 1}</span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-[10px] text-cream">{item.title}</b><small className="mt-0.5 block text-[9px] text-sand-500">{item.note}</small></span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-sand-500" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="hidden h-full xl:block">
            <Label>SHIFT STATUS</Label><div className="mt-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/[.08] text-emerald-200"><CheckCircle2 className="h-4 w-4" /></span><div><b className="block text-xs text-cream">Систем хэвийн</b><small className="mt-1 block text-[9px] text-sand-500">Өнөөдрийн ажиллагаа нээлттэй</small></div></div>
          </Panel>
        </div>

        <div className="grid gap-3">
          <div className="grid h-full gap-3 sm:grid-cols-2">
            <Panel className="h-full min-h-[130px]">
              <div className="flex items-start justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-sand/20 bg-sand/[.10] text-sand"><WalletCards className="h-3.5 w-3.5" /></span>
                <span className={`metric-number text-[9px] font-bold ${receivablesChange >= 0 ? 'text-rose-300' : 'text-emerald-200'}`}>{receivablesChange >= 0 ? `+${receivablesChange}%` : `${receivablesChange}%`}</span>
              </div>
              <Label><span className="mt-4 block">АВЛАГЫН ҮЛДЭГДЭЛ</span></Label>
              <b className="metric-number mt-1 block text-3xl font-semibold text-cream">{formatMnt(receivablesTotal)}</b>
              <small className="mt-1 block text-[9px] text-sand-500">{receivablesUnitCount} айлын нэхэмжлэл</small>
            </Panel>
            <Panel className="h-full min-h-[130px]">
              <div className="flex items-start justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-sand/20 bg-sand/[.10] text-sand"><Clock3 className="h-3.5 w-3.5" /></span>
                <span className={`metric-number text-[9px] font-bold ${resolutionTimeChange <= 0 ? 'text-emerald-200' : 'text-rose-300'}`}>{resolutionTimeChange <= 0 ? `${resolutionTimeChange} цаг` : `+${resolutionTimeChange} цаг`}</span>
              </div>
              <Label><span className="mt-4 block">ДУНДАЖ ШИЙДВЭРЛЭЛТ</span></Label>
              <b className="metric-number mt-1 block text-3xl font-semibold text-cream">{avgResolutionTime} цаг</b>
              <small className="mt-1 block text-[9px] text-sand-500">Сүүлийн 30 хоног</small>
            </Panel>
          </div>

          <Panel className="h-full">
            <div className="flex items-start justify-between"><div><Label>FR-9.1 · COLLECTION PERFORMANCE</Label><h2 className="mt-1 font-serif text-xl text-cream">Төлбөрийн урсгал</h2></div><button type="button" aria-label="Төлбөрийн урсгалын нэмэлт үйлдэл" className="grid h-7 w-7 place-items-center rounded-lg border border-sand/15 text-sand-400"><MoreHorizontal className="h-4 w-4" /></button></div>
            <div className="relative mt-5 h-48 overflow-hidden rounded-xl border border-sand/15 bg-sand/[.045] px-3 pb-5 pt-6">
              <svg className="pointer-events-none absolute inset-x-0 top-8 h-24 w-full opacity-80" viewBox="0 0 620 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="collection-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#d0ad72" stopOpacity=".30" />
                    <stop offset="100%" stopColor="#d0ad72" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#collection-area)" />
                <path d={lineD} fill="none" stroke="#d0ad72" strokeWidth="2" />
              </svg>
              <div className="relative z-10 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full border border-sand/20 bg-sand/[.08] px-2 py-1 text-[8px] font-bold tracking-[.11em] text-sand-200"><CreditCard className="h-3 w-3" /> {collectionRate}% COLLECTION</span><span className="text-[9px] font-bold text-sand-300">Зорилтоос {collectionRate >= collectionTarget ? `+${(collectionRate - collectionTarget).toFixed(1)}%` : `${(collectionRate - collectionTarget).toFixed(1)}%`}</span></div>
              <div className="absolute inset-x-3 bottom-3 flex h-24 items-end gap-2">{monthlyCollection.map(({ month, value }: any, index: number) => <div key={month} className="group flex flex-1 flex-col items-center justify-end gap-1.5"><span className="relative w-full max-w-8 overflow-hidden rounded-t-md border border-sand/15 bg-sand/[.08]" style={{ height: `${value}%` }}><i className={`absolute inset-x-0 bottom-0 block rounded-t-md bg-gradient-to-t ${index === monthlyCollection.length - 1 ? 'from-sand-600 via-sand to-sand-200' : 'from-sand-900 via-sand-600 to-sand-300/80'}`} style={{ height: `${Math.max(44, value - 10)}%` }} /></span><small className="text-[8px] text-sand-500">{month}</small></div>)}</div>
            </div>
          </Panel>

          <Panel className="h-full">
            <div className="flex items-center justify-between"><div><Label>FR-9.1 · SERVICE SLA</Label><h2 className="mt-1 font-serif text-lg text-cream">Засварын ажиллагаа</h2></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/[.08] px-2 py-1 text-[8px] font-bold tracking-[.11em] text-emerald-100">SLA {serviceSla.slaRate}%</span></div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-sand/15 rounded-xl border border-sand/15 bg-sand/[.045]">
              {[[Clock3, `${serviceSla.avgHours} цаг`, 'Дундаж'], [Wrench, `${serviceSla.urgentHours} цаг`, 'Яаралтай'], [BellRing, `${serviceSla.openCount}`, 'Нээлттэй']].map(([Icon, value, label]) => {
                const StatIcon = Icon as typeof Clock3;
                return (
                  <div key={label as string} className="p-3">
                    <StatIcon className="h-3.5 w-3.5 text-sand" />
                    <b className="metric-number mt-3 block text-xl font-semibold text-cream">{value as string}</b>
                    <small className="mt-1 block text-[8px] text-sand-500">{label as string}</small>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="grid gap-3">
          <Panel className="h-full">
            <div className="flex items-start justify-between"><div><Label>RESIDENCE MATRIX</Label><h2 className="mt-1 font-serif text-lg text-cream">Хотхоны бүтэц</h2></div><MapPinned className="h-4 w-4 text-sand" /></div>
            <div className="relative mt-4 h-[177px] overflow-hidden rounded-xl border border-sand/15 bg-sand/[.045]">
              <iframe title={`${property.name} байршил`} src={propertyMapUrl} className="h-full w-full scale-[1.03] border-0 contrast-110 saturate-125" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#8b6b3f] text-white shadow-[0_4px_18px_rgba(0,0,0,.55)]"><Building2 className="h-5 w-5" /></span>
              <span className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-white/35 bg-[#27231d]/95 px-3 py-2 text-white shadow-lg"><b className="block truncate text-[10px]">{property.name}</b><small className="mt-0.5 block truncate text-[8px] text-white/70">{property.address}</small></span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <span className="flex items-center gap-1.5 text-[9px] text-sand-400"><Users className="h-3 w-3 text-sand" /> ИДЭВХТЭЙ ОРШИН СУУГЧ</span>
                <b className="metric-number mt-1 block text-3xl font-semibold text-cream">{residence.activeCount}</b>
                <small className="text-[9px] text-sand-500">Нийт {residence.totalCount} бүртгэлээс</small>
              </div>
              <span className="metric-number text-[9px] font-bold text-emerald-200">+{residence.newCount}</span>
            </div>
          </Panel>

          <Panel className="h-full">
            <div className="flex items-start justify-between"><div><Label>FR-9.1 · AR AGING</Label><h2 className="mt-1 font-serif text-lg text-cream">Авлагын насжилт</h2></div><WalletCards className="h-4 w-4 text-sand" /></div>
            <div className="mt-4 space-y-3">
              {aging.map((item, index) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] text-sand-300">{item.label}</span><b className="text-[10px] text-cream">{item.value}</b></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]"><i className={`block h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: item.width }} /></div>
                  {index === 2 && <p className="mt-2 flex gap-1.5 text-[9px] leading-relaxed text-red-100"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-red-300" /> 61 хоногоос хэтэрсэн авлагад сануулга илгээнэ.</p>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="hidden h-full xl:block">
            <div className="flex items-center justify-between"><div><Label>OPERATIONS SIGNAL</Label><h2 className="mt-1 font-serif text-lg text-cream">Өнөөдрийн тойм</h2></div><Activity className="h-4 w-4 text-sand" /></div><div className="mt-3 flex items-center gap-3 rounded-xl border border-sand/15 bg-sand/[.045] p-3"><span className="grid h-8 w-8 place-items-center rounded-full border border-sand/25 bg-sand/[.10] text-sand"><CheckCircle2 className="h-4 w-4" /></span><p className="text-[10px] leading-relaxed text-sand-300">Төлбөр, засвар болон зарлалын урсгал хяналтад байна.</p></div>
          </Panel>
        </div>
      </div>

      <AdvancedDashboardWidgets data={advancedWidgets ?? undefined} />

    </section>
  );
}
