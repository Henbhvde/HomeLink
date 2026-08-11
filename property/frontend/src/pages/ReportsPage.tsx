import { useState } from 'react';
import { ArrowDownToLine, BarChart3, FileText, PieChart, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';

const periodMap = { '1 сар': 1, '3 сар': 3, '6 сар': 6, '1 жил': 12 } as const;

const formatMnt = (amount: number) => {
  if (amount >= 1_000_000) return `₮${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₮${Math.round(amount / 1_000)}K`;
  return `₮${Math.round(amount).toLocaleString()}`;
};

const formatMetricValue = (metric: { value: number; isPercent?: boolean; isCount?: boolean }) => {
  if (metric.isPercent) return `${metric.value}%`;
  if (metric.isCount) return String(metric.value);
  return formatMnt(metric.value);
};

const formatChange = (value: number) => (value >= 0 ? `+${value}%` : `${value}%`);

export default function ReportsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<keyof typeof periodMap>('6 сар');
  const months = periodMap[period];

  const { data: stats, isLoading } = useQuery({
    queryKey: ['reports-stats', token, months],
    queryFn: () => apiClient.getReportsStats(token || '', months),
    enabled: !!token,
  });

  const chartData = stats?.revenueHistory ?? [];
  const revenueMix = stats?.revenueMix ?? [];
  const metrics = stats?.metrics ?? [];

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">REPORTS & ANALYTICS</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Тайлан, шинжилгээ.</h1>
          <p className="mt-2 text-sm text-sand-400">Хотхоны санхүү болон үйлчилгээний гол үзүүлэлтийг бодит цагт харна.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><ArrowDownToLine className="h-4 w-4" />Excel татах</Button>
          <Button><FileText className="h-4 w-4" />Тайлан үүсгэх</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(periodMap) as Array<keyof typeof periodMap>).map((item) => (
          <button key={item} onClick={() => setPeriod(item)} className={`rounded-full px-4 py-2 text-xs font-semibold ${period === item ? 'bg-sand text-onyx' : 'border border-white/10 text-sand-300 hover:bg-white/5'}`}>{item}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-sand-400">Тайлангийн мэдээлэл ачаалж байна...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric: { label: string; value: number; change: number; isPercent?: boolean; isCount?: boolean }) => (
              <Card key={metric.label}>
                <CardContent className="p-5">
                  <p className="text-[11px] text-sand-400">{metric.label}</p>
                  <b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{formatMetricValue(metric)}</b>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-sand">{formatChange(metric.change)} өмнөх үеэс</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
            <Card>
              <CardHeader>
                <div>
                  <h2 className="font-serif text-xl text-cream">Орлогын өсөлт</h2>
                  <p className="mt-1 text-xs text-sand-400">{period} хугацааны төлбөрийн гүйцэтгэл</p>
                </div>
                <Badge tone={stats?.revenueGrowth >= 0 ? 'success' : 'warning'}>{formatChange(stats?.revenueGrowth ?? 0)}</Badge>
              </CardHeader>
              <CardContent>
                <BarChart data={chartData} valueLabel={(value) => `₮${value}M`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <h2 className="font-serif text-xl text-cream">Орлогын бүтэц</h2>
                  <p className="mt-1 text-xs text-sand-400">Энэ сарын ангилал</p>
                </div>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={revenueMix}
                  center={formatMnt(stats?.currentMonthIncome ?? 0)}
                  caption="Нийт орлого"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {[['Төлбөрийн тайлан', 'Орлого, авлага, гүйлгээний дэлгэрэнгүй'], ['Засварын тайлан', 'SLA, багийн ачаалал, шийдвэрлэлт'], ['Оршин суугчийн идэвх', 'Порталын хандалт, мэдэгдлийн уншилт']].map(([title, detail], index) => (
          <Card key={title} className="hover:border-sand/25">
            <CardContent className="p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand/10 text-sand">{index === 0 ? <BarChart3 className="h-4 w-4" /> : index === 1 ? <TrendingUp className="h-4 w-4" /> : <PieChart className="h-4 w-4" />}</span>
              <h2 className="mt-4 font-serif text-xl text-cream">{title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-sand-400">{detail}</p>
              <button className="mt-5 text-xs font-semibold text-sand hover:text-cream">Тайлан харах →</button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
