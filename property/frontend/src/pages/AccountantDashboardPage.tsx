import { useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, CalendarClock, CheckCircle2, Clock3, CreditCard, FileSpreadsheet, ReceiptText, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type FinancePanelProps = { children: ReactNode; className?: string };

function FinancePanel({ children, className = '' }: FinancePanelProps) {
  return <div className={`rounded-2xl border border-[#c99b3d]/20 bg-[linear-gradient(145deg,rgba(27,23,15,.94),rgba(13,12,9,.94))] shadow-[0_18px_45px_rgba(0,0,0,.18)] ${className}`}>{children}</div>;
}

const CalendarLock = CalendarClock;

const formatMnt = (amount: number) => {
  if (amount >= 1000000) return `₮${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₮${(amount / 1000).toFixed(0)}K`;
  return `₮${amount.toLocaleString()}`;
};

export default function AccountantDashboardPage() {
  const { token } = useAuth();
  const [locked, setLocked] = useState(false);
  const [exported, setExported] = useState(false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['accountant-dashboard-stats', token],
    queryFn: () => apiClient.getAccountantDashboardStats(token || ''),
    enabled: !!token,
  });

  const exportAnnualReport = () => {
    const rows = [
      ['Төрөл', 'Дүн'],
      ['Орлого', String(stats?.cashPosition?.amount ?? 0)],
      ['Зарлага', String(stats?.metrics?.expense ?? 0)],
      ['Авлага', String(stats?.metrics?.receivables ?? 0)],
      ['Үлдэгдэл', String((stats?.cashPosition?.amount ?? 0) - (stats?.metrics?.expense ?? 0))],
    ];
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homelink-${new Date().getFullYear()}-finance-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-[75vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5bb58] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-xs font-bold tracking-[.16em] text-[#ad8e4c] uppercase">FINANCE OPERATIONS</p>
          <h2 className="mt-1 font-serif text-lg text-[#f6efdf]">Санхүүгийн мэдээллийг ачаалж байна...</h2>
        </div>
      </div>
    );
  }

  const cashAmount = stats?.cashPosition?.amount ?? 0;
  const unitCount = stats?.cashPosition?.unitCount ?? 0;
  const collectionRate = stats?.cashPosition?.collectionRate ?? 0;
  const pendingTulgah = stats?.cashPosition?.pendingTulgah ?? 0;
  const invoicesCount = stats?.metrics?.invoicesCount ?? 0;
  const receivables = stats?.metrics?.receivables ?? 0;
  const receiptsCount = stats?.metrics?.receiptsCount ?? 0;

  const statusList = stats?.statusList ?? { batlahZaaltt: 0, zuruuteiZaaltt: 0, tulgahGuilgee: 0, zarlaгынБаримт: 0 };
  const cycle = stats?.cycle ?? { approvalRate: 0, collectionRate: 0, zuruuteiCount: 0 };

  const incomeData = stats?.charts?.income ?? [0, 0, 0, 0];
  const expenseData = stats?.charts?.expense ?? [0, 0, 0, 0];

  // Dynamically calculate lines paths for cashflow line chart
  const getPathD = (data: number[]) => {
    const pts = data.map((val, i) => {
      const x = i * (900 / Math.max(1, data.length - 1));
      const y = 220 - (val / 100) * 180;
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  };
  const cashLineD = getPathD(incomeData);
  const expenseLineD = getPathD(expenseData);

  const steps = [
    { label: 'Заалт шалгах', note: `${statusList.batlahZaaltt} заалт батлах · ${statusList.zuruuteiZaaltt} зөрүүтэй`, icon: Zap, to: '/accountant/meters', status: 'Анхаарах' },
    { label: 'Сарын нэхэмжлэл', note: `${invoicesCount} айлд сарын нэхэмжлэл үүсгэх`, icon: FileSpreadsheet, to: '/accountant/billing', status: 'Бэлэн' },
    { label: 'Төлбөр тулгах', note: `${statusList.tulgahGuilgee} гүйлгээ нэхэмжлэлтэй холбогдоогүй`, icon: CreditCard, to: '/accountant/payments', status: 'Анхаарах' },
    { label: 'Зарлага бүртгэх', note: `${statusList.zarlaгынБаримт} баримт бүртгэгдсэн байна`, icon: ReceiptText, to: '/accountant/expenses', status: 'Бэлэн' },
  ];

  const currentMonthName = ['Нэгдүгээр', 'Хоёрдугаар', 'Гуравдугаар', 'Дөрөвдүгээр', 'Тавдугаар', 'Зургаадугаар', 'Долоодугаар', 'Наймдугаар', 'Есдүгээр', 'Аравдугаар', 'Арван нэгдүгээр', 'Арван хоёрдугаар'][new Date().getMonth()];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d9b55e]">
            {currentMonthName.toUpperCase()} 2026 · FINANCE OPERATIONS
          </p>
          <h1 className="mt-2 font-serif text-[2rem] font-light leading-[1.05] text-[#f6efdf] sm:text-[2.35rem] lg:text-[2.7rem]">Няравын санхүүгийн control center.</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-7 text-[#a99d82] sm:text-sm">Заалт, нэхэмжлэл, банкны тулгалт, зарлага болон сарын хаалтыг нэг урсгалаар удирдана.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d7ad55]/25 bg-[#c89e43]/[.08] px-3 py-2 text-[10px] font-bold tracking-[.13em] text-[#eccb7b]"><span className="h-1.5 w-1.5 rounded-full bg-[#f2c65d] shadow-[0_0_10px_#f2c65d]" />MONTH IN PROGRESS</span>
          <Badge tone={locked ? 'neutral' : 'success'}>{locked ? 'PERIOD LOCKED' : 'PERIOD OPEN'}</Badge>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_350px]">
        <FinancePanel className="relative overflow-hidden p-5 lg:p-6">
          <span className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d49b2a]/[.09] blur-3xl" />
          <span className="absolute right-16 top-8 h-2 w-2 rounded-full bg-[#f2c65d] shadow-[0_0_14px_#f2c65d]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">MONTHLY CASH POSITION</p>
              <b className="mt-3 block font-serif text-[2.05rem] font-light tracking-[-0.03em] text-[#fff8e8] sm:text-[2.5rem]">{formatMnt(cashAmount)}</b>
              <p className="mt-2 text-sm text-[#b8aa8b]">2026 оны {new Date().getMonth() + 1}-р сарын үүсгэх нэхэмжлэлийн дүн</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-lg border border-[#e0b95a]/20 bg-[#d49b2a]/[.08] px-3 py-2 text-[#e9ca84]">{unitCount} айл</span>
                <span className="rounded-lg border border-white/[.08] bg-black/15 px-3 py-2 text-[#b8aa8b]">{collectionRate}% цуглуулалт</span>
                <span className="rounded-lg border border-white/[.08] bg-black/15 px-3 py-2 text-[#b8aa8b]">{pendingTulgah} гүйлгээ тулгах</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#d9ae50]/20 bg-black/20 p-4 text-center">
              <div><span className="text-[9px] font-bold tracking-[.12em] text-[#8f7b52]">INVOICE</span><b className="mt-2 block text-[1.05rem] font-light tracking-[0.01em] text-[#f4e6c7]">{invoicesCount}</b></div>
              <div className="border-x border-white/[.08]"><span className="text-[9px] font-bold tracking-[.12em] text-[#8f7b52]">AVALAGA</span><b className="mt-2 block text-[1.05rem] font-light tracking-[0.01em] text-[#f4e6c7]">{formatMnt(receivables)}</b></div>
              <div><span className="text-[9px] font-bold tracking-[.12em] text-[#8f7b52]">RECEIPTS</span><b className="mt-2 block text-[1.05rem] font-light tracking-[0.01em] text-[#f4e6c7]">{receiptsCount}</b></div>
            </div>
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">MONTHLY STATUS</p>
              <h2 className="mt-1 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">Санхүүгийн хяналт</h2>
            </div>
            <Activity className="h-5 w-5 text-[#e5bb58]" />
          </div>
          <div className="mt-5 space-y-2.5">
            {[
              { label: 'Батлах заалт', value: statusList.batlahZaaltt, tone: 'bg-[#e5bb58]' },
              { label: 'Зөрүүтэй заалт', value: statusList.zuruuteiZaaltt, tone: 'bg-[#e89643]' },
              { label: 'Тулгах гүйлгээ', value: statusList.tulgahGuilgee, tone: 'bg-[#ea604d]' },
              { label: 'Зарлагын баримт', value: statusList.zarlaгынБаримт, tone: 'bg-[#64d2a8]' }
            ].map(({ label, value, tone }) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-3">
                <span className="flex items-center gap-2 text-xs text-[#c6b99a]"><i className={`h-2 w-2 rounded-full ${tone}`} />{label}</span>
                <b className="text-[0.95rem] font-medium tracking-[0.01em] text-[#f6ebd3]">{value}</b>
              </div>
            ))}
          </div>
        </FinancePanel>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_350px]">
        <FinancePanel className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#c99b3d]/15 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">COLLECTION & CASHFLOW</p>
              <h2 className="mt-1 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">Санхүүгийн урсгал</h2>
              <p className="mt-1 text-xs text-[#a99d82]">Сарын цуглуулалт, авлага болон зарлагын хандлага</p>
            </div>
            <span className="rounded-lg border border-[#e3b753]/25 bg-[#d49b2a]/[.08] px-3 py-2 text-[10px] font-bold text-[#eaca82]">{collectionRate >= 95 ? `+${(collectionRate - 95).toFixed(1)}%` : `${(collectionRate - 95).toFixed(1)}%`} зорилтоос</span>
          </div>
          <div className="relative h-64 px-4 pb-7 pt-5 sm:px-6">
            <div className="pointer-events-none absolute inset-x-5 top-5 bottom-9 opacity-50 [background-image:linear-gradient(rgba(231,187,83,.11)_1px,transparent_1px),linear-gradient(90deg,rgba(231,187,83,.08)_1px,transparent_1px)] [background-size:100%_25%,12.5%_100%]" />
            <svg viewBox="0 0 900 250" className="relative h-full w-full" preserveAspectRatio="none" aria-label="Санхүүгийн урсгалын график">
              <defs>
                <linearGradient id="cashFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#ffbd3d" stopOpacity=".65" />
                  <stop offset=".46" stopColor="#dd6b2a" stopOpacity=".35" />
                  <stop offset="1" stopColor="#a90b64" stopOpacity=".1" />
                </linearGradient>
                <linearGradient id="cashLine" x1="0" y1="0" x2="1" y2="0">
                  <stop stopColor="#e49a2b" />
                  <stop offset=".48" stopColor="#ffd661" />
                  <stop offset="1" stopColor="#ef6a35" />
                </linearGradient>
              </defs>
              <path d={`${cashLineD} L 900 250 L 0 250 Z`} fill="url(#cashFill)" />
              <path d={cashLineD} fill="none" stroke="url(#cashLine)" strokeWidth="4" />
              <path d={expenseLineD} fill="none" stroke="#b74476" strokeOpacity=".7" strokeWidth="2" strokeDasharray="5 8" />
            </svg>
            <div className="absolute bottom-3 left-6 right-6 flex justify-between text-[9px] font-bold text-[#806d4c]">
              <span>1 долоо хоног</span>
              <span>2 долоо хоног</span>
              <span>3 долоо хоног</span>
              <span>4 долоо хоног</span>
              <span>Сарын хаалт</span>
            </div>
          </div>
        </FinancePanel>

        <FinancePanel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">CYCLE COMPLETION</p>
              <h2 className="mt-1 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">Мөчлөгийн явц</h2>
            </div>
            <Clock3 className="h-5 w-5 text-[#e5bb58]" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#e0b956]/20 bg-black/15 p-4 text-center">
              <div className="mx-auto relative grid h-20 w-20 place-items-center rounded-full p-[7px]" style={{ background: `conic-gradient(#e7bf5c 0 ${cycle.approvalRate}%, #3b311d ${cycle.approvalRate}% 100%)` }}>
                <span className="absolute inset-[5px] rounded-full bg-[#17140f]" />
                <b className="relative text-[1.05rem] font-light tracking-[0.02em] text-[#fff0c9] sm:text-[1.3rem]">{cycle.approvalRate}%</b>
              </div>
              <p className="mt-3 text-[10px] font-bold tracking-[.11em] text-[#bca778]">БАТЛАЛТ</p>
            </div>
            <div className="rounded-2xl border border-[#e0b956]/20 bg-black/15 p-4 text-center">
              <div className="mx-auto relative grid h-20 w-20 place-items-center rounded-full p-[7px]" style={{ background: `conic-gradient(#e89643 0 ${cycle.collectionRate}%, #3b311d ${cycle.collectionRate}% 100%)` }}>
                <span className="absolute inset-[5px] rounded-full bg-[#17140f]" />
                <b className="relative text-[1.05rem] font-light tracking-[0.02em] text-[#fff0c9] sm:text-[1.3rem]">{cycle.collectionRate}%</b>
              </div>
              <p className="mt-3 text-[10px] font-bold tracking-[.11em] text-[#bca778]">ЦУГЛУУЛАЛТ</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[#e5bd5b]/15 bg-[#d49b2a]/[.06] p-3 text-xs leading-5 text-[#c7b995]">
            <AlertTriangle className="mr-2 inline h-4 w-4 text-[#e7bb58]" />
            Сарын нэхэмжлэл үүсгэхээс өмнө {cycle.zuruuteiCount} зөрүүтэй заалтыг шийднэ үү.
          </div>
        </FinancePanel>
      </div>

      <FinancePanel className="p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">MONTH-END CHECKLIST</p>
            <h2 className="mt-1 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">Сарын мөчлөг</h2>
            <p className="mt-1 text-xs text-[#a99d82]">Нэхэмжлэлээс эхлээд тайлан экспортлох хүртэлх ажлын урсгал.</p>
          </div>
          <span className="text-xs text-[#c8b88f]">4 алхам · {steps.filter((s) => s.status === 'Анхаарах').length} анхаарах</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map(({ label, note, icon: Icon, to, status }, index) => (
            <Link key={label} to={to} className="group rounded-xl border border-[#c99b3d]/18 bg-black/[.16] p-4 transition hover:-translate-y-0.5 hover:border-[#e3bc61]/45 hover:bg-[#d49b2a]/[.07]">
              <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#d7aa4c]/25 bg-[#d49b2a]/[.1] text-[#eac86e]"><Icon className="h-4 w-4" /></span><span className="text-[10px] text-[#7c6947]">0{index + 1}</span></div>
              <b className="mt-5 block text-[15px] text-[#f4e9d4]">{label}</b>
              <p className="mt-2 min-h-9 text-[12px] leading-6 text-[#9f9276]">{note}</p>
              <span className={`mt-4 inline-flex text-[11px] font-bold ${status === 'Анхаарах' ? 'text-[#f0b558]' : 'text-[#ddc17c]'}`}>{status} →</span>
            </Link>
          ))}
        </div>
      </FinancePanel>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <FinancePanel className="p-6">
          <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">FR-7.3 · PERIOD LOCK</p>
          <h2 className="mt-2 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">2026 оны {new Date().getMonth() + 1}-р сар</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a99d82]">Сар хаасны дараа тухайн үеийн invoice, гүйлгээ, зарлагын бүртгэлд өөрчлөлт хийхгүй. Засвар шаардлагатай бол дараагийн нээлттэй үеэс adjustment хийнэ.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" className="border-[#d7ad55]/45 text-[#f1d58c] hover:bg-[#d49b2a]/10" onClick={() => locked ? setLocked(false) : setIsLockConfirmOpen(true)}>
              <CalendarLock className="h-4 w-4" />{locked ? 'Period дахин нээх' : 'Сарыг хаах'}
            </Button>
            <span className="inline-flex items-center gap-2 text-xs text-[#b6a685]"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{invoicesCount} invoice бэлэн</span>
          </div>
        </FinancePanel>
        <FinancePanel className="p-6">
          <p className="text-[10px] font-bold tracking-[.16em] text-[#ad8e4c]">FR-7.3 · YEAR-END EXPORT</p>
          <h2 className="mt-2 font-serif text-[1.3rem] font-medium leading-tight text-[#f8efdd]">Хурлын тайлан</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#a99d82]">Орлого, зарлага, авлага болон засварын нэгтгэлийг жилийн хурлын Excel/PDF тайлан болгож гаргана.</p>
          <Button variant="outline" className="mt-6 w-full border-[#d7ad55]/45 text-[#f1d58c] hover:bg-[#d49b2a]/10" onClick={exportAnnualReport}>
            <ArrowDownToLine className="h-4 w-4" />2026 оны тайлан экспортлох
          </Button>
          {exported && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><ShieldCheck className="h-4 w-4" />Тайлан CSV файлаар татагдлаа.</p>}
        </FinancePanel>
      </div>
      <ConfirmDialog open={isLockConfirmOpen} title="Сарын мөчлөгийг хаах уу?" description="Хаасны дараа энэ сарын нэхэмжлэл, гүйлгээ, зарлагыг өөрчлөх боломжгүй." confirmLabel="Сарын мөчлөг хаах" onCancel={() => setIsLockConfirmOpen(false)} onConfirm={() => { setLocked(true); setIsLockConfirmOpen(false); }} />
    </section>
  );
}
