export type BarChartPoint = { label: string; value: number };

export default function BarChart({ data, valueLabel = String }: { data: BarChartPoint[]; valueLabel?: (value: number) => string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex h-60 items-end gap-2 border-b border-white/8 pb-1" role="img" aria-label={data.map((item) => `${item.label}: ${valueLabel(item.value)}`).join(', ')}>{data.map((item) => <div key={item.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span title={valueLabel(item.value)} className="w-full rounded-t-md bg-gradient-to-t from-sand/20 to-sand transition-all group-hover:from-sand/40" style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }} /><small className="truncate text-[8px] text-sand-500">{item.label}</small></div>)}</div>;
}
