import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, CircleDollarSign, ShieldAlert } from 'lucide-react';

type Period = '7d' | '30d' | '90d';
type Point = { label: string; value: number };
type WidgetData = {
  forecast: Record<Period, Point[]>;
  occupancy: number;
  slaAtRisk: number;
  openRequests: number;
  activeResidents?: number;
  totalUnits?: number;
  forecastAmount?: number;
  forecastGrowth?: number;
};

const emptyForecast: Record<Period, Point[]> = {
  '7d': [],
  '30d': [],
  '90d': [],
};

const formatMnt = (amount: number) => {
  if (amount >= 1_000_000) return `₮${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₮${Math.round(amount / 1_000)}K`;
  return `₮${Math.round(amount).toLocaleString()}`;
};

export default function AdvancedDashboardWidgets({ data }: { data?: WidgetData }) {
  const [period, setPeriod] = useState<Period>('30d');
  const points = data?.forecast?.[period] ?? emptyForecast[period];
  const path = useMemo(() => {
    if (points.length === 0) return 'M 0 100';
    return points.map((point, index) => `${index ? 'L' : 'M'} ${index * (300 / Math.max(1, points.length - 1))} ${100 - point.value}`).join(' ');
  }, [points]);

  const occupancy = data?.occupancy ?? 0;
  const slaAtRisk = data?.slaAtRisk ?? 0;
  const openRequests = data?.openRequests ?? 0;
  const activeResidents = data?.activeResidents ?? 0;
  const totalUnits = data?.totalUnits ?? 0;
  const forecastAmount = data?.forecastAmount ?? 0;
  const forecastGrowth = data?.forecastGrowth ?? 0;

  return (
    <section className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_.75fr_.75fr]" aria-label="Advanced dashboard widgets">
      <article className="rounded-2xl border border-sand/25 bg-sand/[.035] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-bold tracking-[.18em] text-sand-500">CASHFLOW FORECAST</p>
            <h2 className="mt-1 font-serif text-lg text-cream">Орлогын төсөөлөл</h2>
          </div>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {(['7d', '30d', '90d'] as Period[]).map((item) => (
              <button type="button" key={item} onClick={() => setPeriod(item)} aria-pressed={period === item} className={`rounded-md px-2 py-1 text-[9px] font-bold ${period === item ? 'bg-sand text-onyx' : 'text-sand-400'}`}>{item}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
          <div>
            <svg viewBox="0 0 300 105" className="h-28 w-full overflow-visible" role="img" aria-label={points.map((point) => `${point.label}: ${point.value}%`).join(', ') || 'Мэдээлэл байхгүй'}>
              <path d={`${path} L 300 105 L 0 105 Z`} fill="rgba(197,168,128,.10)" />
              <path d={path} fill="none" stroke="#c5a880" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={point.label} cx={index * (300 / Math.max(1, points.length - 1))} cy={100 - point.value} r="4" fill="#171614" stroke="#e5d5bd" strokeWidth="2" />
              ))}
            </svg>
            <div className="flex justify-between text-[8px] text-sand-500">
              {points.map((point) => <span key={point.label}>{point.label}</span>)}
            </div>
          </div>
          <div className="border-l border-sand/15 pl-4">
            <CircleDollarSign className="h-4 w-4 text-sand" />
            <b className="mt-3 block text-2xl text-cream">{formatMnt(forecastAmount)}</b>
            <small className={`text-[9px] ${forecastGrowth >= 0 ? 'text-emerald-200' : 'text-rose-300'}`}>
              {forecastGrowth >= 0 ? `+${forecastGrowth}%` : `${forecastGrowth}%`} forecast
            </small>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-sand/25 bg-sand/[.035] p-4">
        <div className="flex justify-between"><Activity className="h-4 w-4 text-sand" /><ArrowUpRight className="h-4 w-4 text-emerald-200" /></div>
        <p className="mt-5 text-[8px] font-bold tracking-[.15em] text-sand-500">OCCUPANCY</p>
        <b className="mt-1 block text-3xl text-cream">{occupancy}%</b>
        <div className="mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${occupancy}%` }} /></div>
        <small className="mt-2 block text-[9px] text-sand-400">{totalUnits > 0 ? `${activeResidents} идэвхтэй · ${totalUnits} нэгж` : 'Нэгжийн мэдээлэл байхгүй'}</small>
      </article>

      <article className="rounded-2xl border border-amber-300/20 bg-amber-300/[.035] p-4">
        <ShieldAlert className="h-4 w-4 text-amber-200" />
        <p className="mt-5 text-[8px] font-bold tracking-[.15em] text-sand-500">SLA RISK</p>
        <b className="mt-1 block text-3xl text-cream">{slaAtRisk}</b>
        <small className="mt-1 block text-[9px] text-amber-100">{openRequests} нээлттэй хүсэлтээс</small>
        <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[.06] px-2.5 py-2 text-[9px] text-amber-100">
          {slaAtRisk > 0 ? '2 цагийн дотор арга хэмжээ авна' : 'Одоогоор SLA эрсдэл байхгүй'}
        </div>
      </article>
    </section>
  );
}
