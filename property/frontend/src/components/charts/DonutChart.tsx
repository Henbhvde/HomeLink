export type DonutSlice = { label: string; value: number; color: string };

export default function DonutChart({ data, center, caption }: { data: DonutSlice[]; center: string; caption: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let cursor = 0;
  const gradient = data.map((item) => { const start = cursor; cursor += (item.value / total) * 100; return `${item.color} ${start}% ${cursor}%`; }).join(', ');
  return <><div role="img" aria-label={data.map((item) => `${item.label}: ${Math.round(item.value / total * 100)}%`).join(', ')} className="mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-[#121211] text-center"><span><b className="block font-sans text-xl font-semibold text-cream">{center}</b><small className="text-[9px] text-sand-400">{caption}</small></span></div></div><div className="mt-5 space-y-2">{data.map((item) => <div key={item.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-sand-300"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><b className="text-cream">{Math.round(item.value / total * 100)}%</b></div>)}</div></>;
}
