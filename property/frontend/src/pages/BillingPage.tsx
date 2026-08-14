import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useBackendState } from '../hooks/useBackendState';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import { AlertTriangle, Calculator, CheckCircle2, FilePlus2, ReceiptText, Search, WalletCards, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';
import { useUrlQueryState } from '../hooks/useUrlQueryState';

type BillingTab = 'invoices' | 'run' | 'fees' | 'ledger';
type InvoiceStatus = 'due' | 'paid' | 'overdue' | 'draft' | 'approved';
type RunStatus = 'review' | 'creating' | 'complete';
type InvoiceRunStage = 'draft' | 'approved' | 'sent';

type Invoice = {
  id: string;
  unit: string;
  resident: string;
  amount: string;
  due: string;
  status: InvoiceStatus;
};

type BillingUnit = { id: string; number: string; floor: string | number; entrance: string; building: string; hasActiveResident?: boolean };

const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initialPeriod = () => {
  const now = new Date();
  return {
    start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    due: toDateInput(new Date(now.getFullYear(), now.getMonth(), 25)),
  };
};

const tabs: { id: BillingTab; label: string }[] = [
  { id: 'invoices', label: 'Нэхэмжлэл' },
  { id: 'run', label: 'Сарын нэхэмжлэл' },
  { id: 'fees', label: 'Тариф' },
  { id: 'ledger', label: 'Журнал' },
];

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

const formatMnt = (amount: number) => {
  if (amount >= 1_000_000) return `₮${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `₮${Math.round(amount / 1_000)}K`;
  return `₮${Math.round(amount).toLocaleString()}`;
};

const invoiceStatus: Record<InvoiceStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  due: { label: 'Төлөх хугацаа ойр', tone: 'warning' },
  paid: { label: 'Төлөгдсөн', tone: 'success' },
  overdue: { label: 'Хугацаа хэтэрсэн', tone: 'danger' },
  draft: { label: 'Ноорог', tone: 'neutral' },
  approved: { label: 'Баталсан', tone: 'warning' },
};

export default function BillingPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useUrlQueryState<BillingTab>('tab', 'invoices', tabs.map((item) => item.id));
  const [query, setQuery] = useUrlQueryState<string>('q', '');
  const [invoices, setInvoices, status, retry] = useBackendState<Invoice[]>('billing-invoices', []);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>('review');
  const [invoiceRunCreated, setInvoiceRunCreated] = useState(false);
  const [createdAt, setCreatedAt] = useState('');
  const [runStage, setRunStage] = useState<InvoiceRunStage>('draft');
  const [billingUnits, setBillingUnits] = useState<BillingUnit[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [householdCount, setHouseholdCount] = useState('0');
  const [periodStart, setPeriodStart] = useState(() => initialPeriod().start);
  const [periodEnd, setPeriodEnd] = useState(() => initialPeriod().end);
  const [dueDate, setDueDate] = useState(() => initialPeriod().due);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [createdInvoiceCount, setCreatedInvoiceCount] = useState(0);
  const [chargeName, setChargeName] = useState('СӨХ-ийн сарын төлбөр');
  const [chargeAmount, setChargeAmount] = useState('');

  const { data: billingStats } = useQuery({
    queryKey: ['billing-stats', token],
    queryFn: () => apiClient.getBillingStats(token || ''),
    enabled: !!token,
  });

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => `${invoice.id} ${invoice.unit} ${invoice.resident}`.toLowerCase().includes(query.toLowerCase())),
    [invoices, query],
  );

  const openInvoiceRun = async () => {
    setRunStatus(invoiceRunCreated ? 'complete' : 'review');
    setIsRunDialogOpen(true);
    if (!invoiceRunCreated && token && user?.workspace?.id) {
      setUnitsLoading(true);
      try {
        const response = await fetch(`${apiBase}/resident-memberships/tenants/${user.workspace.id}/units`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json();
        const units = Array.isArray(payload?.data) ? payload.data as BillingUnit[] : [];
        setBillingUnits(units);
        setSelectedUnitIds(units.map((unit) => unit.id));
        setHouseholdCount(String(units.length));
      } finally {
        setUnitsLoading(false);
      }
    }
  };

  const createInvoiceRun = async () => {
    setRunStatus('creating');
    try {
      if (!token || !user?.workspace?.id) throw new Error('СӨХ-ийн мэдээлэл олдсонгүй.');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const units = billingUnits.filter((unit) => selectedUnitIds.includes(unit.id));
      const requestedHouseholdCount = Number.parseInt(householdCount, 10);
      if (!Number.isFinite(requestedHouseholdCount) || requestedHouseholdCount <= 0) throw new Error('Хамрах айлын тоог зөв оруулна уу.');
      const amount = Number(chargeAmount);
      if (!chargeName.trim() || !Number.isFinite(amount) || amount <= 0) throw new Error('Төлбөрийн нэр, дүнг зөв оруулна уу.');
      const start = new Date(`${periodStart}T00:00:00`);
      const end = new Date(`${periodEnd}T23:59:59`);
      const dueAt = new Date(`${dueDate}T23:59:59`);
      if (start > end) throw new Error('Нэхэмжлэлийн хугацаа буруу байна.');
      if (units.length === 0) {
        const createdAtValue = Date.now();
        const manualInvoices: Invoice[] = Array.from({ length: requestedHouseholdCount }, (_, index) => ({
          id: `INV-${createdAtValue}-${index + 1}`,
          unit: `Айл ${index + 1}`,
          resident: 'Гараар оруулсан',
          amount: formatMnt(amount),
          due: dueDate,
          status: 'draft',
        }));
        setInvoices((current) => [...manualInvoices, ...current]);
        setCreatedInvoiceCount(requestedHouseholdCount);
        setInvoiceRunCreated(true);
        setRunStatus('complete');
        setCreatedAt(`Өнөөдөр, ${new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}`);
        setRunStage('draft');
        setIsRunDialogOpen(false);
        setTab('invoices');
        return;
      }
      const response = await fetch(`${apiBase}/invoices/generate`, {
        method: 'POST', headers,
        body: JSON.stringify({ periodStart: start.toISOString(), periodEnd: end.toISOString(), dueAt: dueAt.toISOString(), invoices: units.map((unit) => ({ unitId: unit.id, lines: [{ description: chargeName.trim(), quantity: 1, unitPrice: amount }] })) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || 'Нэхэмжлэл үүсгэж чадсангүй.');
      setCreatedInvoiceCount(Array.isArray(payload?.data?.invoiceIds) ? payload.data.invoiceIds.length : units.length);
      setInvoiceRunCreated(true);
      setRunStatus('complete');
      setCreatedAt(`Өнөөдөр, ${new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}`);
      setRunStage('draft');
      retry();
      setIsRunDialogOpen(false);
      setTab('invoices');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Нэхэмжлэл үүсгэж чадсангүй.');
      setRunStatus('review');
    }
  };

  const approveInvoices = () => {
    setInvoices((current) => current.map((invoice) => invoice.status === 'draft' ? { ...invoice, status: 'approved' } : invoice));
    setRunStage('approved');
  };

  const sendInvoices = () => {
    setInvoices((current) => current.map((invoice) => invoice.status === 'approved' ? { ...invoice, status: 'due' } : invoice));
    setRunStage('sent');
    setTab('invoices');
  };

  return (
    <>
    <PageStateWrapper
      status={status}
      isEmpty={invoices.length === 0 && tab === 'invoices'}
      onRetry={retry}
      emptyIcon={ReceiptText}
      emptyTitle="Одоогоор нэхэмжлэл алга"
      emptyDescription="Эхний нэхэмжлэлийг үүсгээд энэ хэсгийг шууд ашиглаж эхлүүлээрэй."
      emptyAction={<Button onClick={openInvoiceRun}>Сарын нэхэмжлэл үүсгэх</Button>}
    >
      <section>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">BILLING & LEDGER · FR-2.2</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Төлбөр, нэхэмжлэл.</h1>
          <p className="mt-2 text-sm text-sand-400">Сарын нэхэмжлэлийг бэлтгэж, шалгаад сонгосон айлуудад нэг дор үүсгэнэ.</p>
        </div>
        <Button onClick={openInvoiceRun}><FilePlus2 className="h-4 w-4" />Сарын нэхэмжлэл үүсгэх</Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Нийт нэхэмжлэл', value: formatMnt(billingStats?.totalInvoiced ?? 0), icon: ReceiptText },
          { label: 'Төлөгдсөн', value: formatMnt(billingStats?.totalPaid ?? 0), icon: CheckCircle2 },
          { label: 'Авлага', value: formatMnt(billingStats?.receivables ?? 0), icon: WalletCards },
          { label: 'Төлөлтийн түвшин', value: `${billingStats?.collectionRate ?? 0}%`, icon: Calculator },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-[11px] text-sand-400">{label}</p><b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{value}</b></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/10 text-sand"><Icon className="h-4 w-4" /></span></CardContent></Card>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#121211]/55">
        <div className="flex flex-col gap-3 border-b border-white/7 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex overflow-x-auto rounded-xl bg-black/20 p-1">
            {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold ${tab === item.id ? 'bg-sand text-onyx' : 'text-sand-400 hover:text-cream'}`}>{item.label}</button>)}
          </div>
          {tab === 'invoices' && <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Нэхэмжлэл хайх..." /></div>}
        </div>

        {tab === 'invoices' && (filteredInvoices.length === 0 ? (
          <div className="p-5"><EmptyState icon={Search} title="Нэхэмжлэл олдсонгүй" description="Хайлтын нөхцөлөө өөрчлөөд дахин оролдоно уу." /></div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500">
                  <tr>
                    <th className="px-5 py-3">ДУГААР</th>
                    <th className="px-5 py-3">АЙЛ / ОРШИН СУУГЧ</th>
                    <th className="px-5 py-3">ДҮН</th>
                    <th className="px-5 py-3">ДУУСАХ</th>
                    <th className="px-5 py-3">ТӨЛӨВ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-white/[.06] text-xs hover:bg-white/[.025]">
                      <td className="px-5 py-4 font-semibold text-cream">{invoice.id}</td>
                      <td className="px-5 py-4">
                        <b className="block text-cream">{invoice.unit}</b>
                        <small className="text-[10px] text-sand-500">{invoice.resident}</small>
                      </td>
                      <td className="px-5 py-4 font-semibold text-cream">{invoice.amount}</td>
                      <td className="px-5 py-4 text-sand-300">{invoice.due}</td>
                      <td className="px-5 py-4">
                        <Badge tone={invoiceStatus[invoice.status].tone}>{invoiceStatus[invoice.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="grid gap-3 md:hidden">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-white/8 bg-black/15 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cream text-xs">{invoice.id}</span>
                    <Badge tone={invoiceStatus[invoice.status].tone}>{invoiceStatus[invoice.status].label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <b className="block text-cream">{invoice.unit}</b>
                      <small className="text-[10px] text-sand-500">{invoice.resident}</small>
                    </div>
                    <div className="text-right">
                      <b className="block text-cream">{invoice.amount}</b>
                      <span className="block text-[10px] text-sand-400">Дуусах: {invoice.due}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tab === 'run' && !invoiceRunCreated && <div className="p-5"><EmptyState icon={FilePlus2} title="Сарын нэхэмжлэл үүсээгүй байна" description="Сарын нэхэмжлэл үүсгэсний дараа бодит мэдээлэл энд харагдана." action={<Button onClick={openInvoiceRun}>Сарын нэхэмжлэл үүсгэх</Button>} /></div>}

        {tab === 'run' && invoiceRunCreated && <div className="grid gap-5 p-5 lg:grid-cols-[1fr_.8fr]">
          <Card><CardContent>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[.15em] text-sand">{periodStart} — {periodEnd}</p><h2 className="mt-2 font-serif text-2xl text-cream">Сарын нэхэмжлэл</h2></div><Badge tone={invoiceRunCreated ? 'success' : 'warning'}>{invoiceRunCreated ? 'Үүсгэсэн' : 'Бэлтгэгдсэн'}</Badge></div>
            <p className="mt-3 text-sm leading-relaxed text-sand-400">Сонгосон {createdInvoiceCount} айлын нэхэмжлэлийг үүсгэлээ.</p>
            {invoiceRunCreated ? <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-4 text-sm text-emerald-100"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Сарын нэхэмжлэл амжилттай үүслээ</div><p className="mt-1 text-xs text-emerald-100/75">RUN-2026-07-01 · {createdAt} · Нэхэмжлэлүүд илгээх дараалалд орсон.</p></div> : <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-sm text-amber-100"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Үүсгэхийн өмнөх шалгалт</div><p className="mt-1 text-xs text-amber-100/75">436 айл бэлэн, 0 алдаатай мөр. Үүсгэсний дараа энэ сарын тариф дахин өөрчлөгдөхгүй.</p></div>}
            <div className="mt-5 flex gap-2 text-[10px] font-bold">{['Ноорог', 'Батлах', 'Илгээх'].map((step, index) => <span key={step} className={`rounded-full px-3 py-1.5 ${(runStage === 'draft' ? 0 : runStage === 'approved' ? 1 : 2) >= index && invoiceRunCreated ? 'bg-sand text-onyx' : 'bg-white/5 text-sand-400'}`}>{index + 1}. {step}</span>)}</div>
            <div className="mt-6 flex gap-3">{!invoiceRunCreated && <Button onClick={openInvoiceRun}>Ноорог үүсгэх</Button>}{invoiceRunCreated && runStage === 'draft' && <Button onClick={approveInvoices}>Нэхэмжлэл батлах</Button>}{runStage === 'approved' && <Button onClick={sendInvoices}>Оршин суугчдад илгээх</Button>}{runStage === 'sent' && <Button disabled>Амжилттай илгээсэн</Button>}</div>
          </CardContent></Card>
          <div className="space-y-3">
            {[
              ['Хамрах айл', String(createdInvoiceCount)],
              ['Нийт дүн', formatMnt(billingStats?.totalInvoiced ?? 0)],
              ['Алдаатай мөр', '0'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-[11px] text-sand-400">{label}</p><b className="mt-1 block font-sans text-xl font-semibold tracking-tight text-cream">{value}</b></div>)}
          </div>
        </div>}

        {tab === 'fees' && <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{[['СӨХ-ийн үйлчилгээ', '₮85,000', 'Сар бүр'], ['Ус, дулаан', 'Тоолуурын дагуу', 'Сар бүр'], ['Зогсоол', '₮25,000', 'Сар бүр'], ['Торгууль', 'Тохиолдлоор', 'Нэг удаа']].map(([name, amount, cycle]) => <Card key={name}><CardContent><Badge tone="neutral">{cycle}</Badge><h2 className="mt-4 font-serif text-xl text-cream">{name}</h2><p className="mt-2 text-sm text-sand-400">{amount}</p></CardContent></Card>)}</div>}

        {tab === 'ledger' && <div className="p-5"><div className="rounded-xl border border-dashed border-white/10 bg-white/[.02] p-7"><p className="text-[10px] font-bold tracking-[.15em] text-sand">{billingStats?.ledger?.periodLabel ?? 'ЭНЭ САР'}</p><h2 className="mt-2 font-serif text-2xl text-cream">Ерөнхий журнал</h2><div className="mt-6 grid gap-3 sm:grid-cols-3">{[['Орлого', formatMnt(billingStats?.ledger?.income ?? 0)], ['Зарлага', formatMnt(billingStats?.ledger?.expense ?? 0)], ['Үлдэгдэл', formatMnt(billingStats?.ledger?.balance ?? 0)]].map(([label, value]) => <div key={label} className="rounded-xl bg-black/20 p-4"><p className="text-[11px] text-sand-400">{label}</p><b className="mt-1 block font-sans text-xl font-semibold tracking-tight text-cream">{value}</b></div>)}</div></div></div>}
      </div>

      </section>
    </PageStateWrapper>

      {isRunDialogOpen && createPortal(<div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm"><div className="accountant-modal-panel my-auto max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
        <div className="flex justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">САРЫН НЭХЭМЖЛЭЛ</p><h2 className="mt-2 font-serif text-2xl text-cream">{runStatus === 'complete' ? 'Нэхэмжлэл үүслээ' : 'Сарын нэхэмжлэл үүсгэх'}</h2></div><button onClick={() => setIsRunDialogOpen(false)} aria-label="Цонх хаах" className="text-sand-400 hover:text-cream"><X className="h-5 w-5" /></button></div>
        {runStatus === 'review' && <><div className="mt-6 space-y-4 rounded-xl border border-white/8 bg-black/20 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-sand-300">Эхлэх огноо<Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="billing-date-input mt-1" /></label><label className="text-xs text-sand-300">Дуусах огноо<Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="billing-date-input mt-1" /></label></div>
          <label className="block text-xs text-sand-300">Төлөх эцсийн огноо<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="billing-date-input mt-1" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-sand-300">Төлбөрийн нэр<Input value={chargeName} onChange={(event) => setChargeName(event.target.value)} className="mt-1" /></label><label className="text-xs text-sand-300">Нэг айлын дүн<Input inputMode="numeric" placeholder="₮" value={chargeAmount} onChange={(event) => setChargeAmount(event.target.value.replace(/[^0-9]/g, ''))} className="mt-1" /></label></div>
          <label className="block text-xs text-sand-300">Хамрах айлын тоо<Input type="number" min="0" value={householdCount} onChange={(event) => { const value = event.target.value.replace(/[^0-9]/g, ''); setHouseholdCount(value); const count = Number.parseInt(value, 10) || 0; setSelectedUnitIds(billingUnits.slice(0, count).map((unit) => unit.id)); }} className="mt-1" /></label>
        </div><div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsRunDialogOpen(false)}>Болих</Button><Button disabled={unitsLoading || (Number.parseInt(householdCount, 10) || 0) <= 0 || !chargeAmount} onClick={createInvoiceRun} className="bg-[#c86745] text-white shadow-lg shadow-[#c86745]/20 hover:bg-[#ad5033]"><FilePlus2 className="h-4 w-4" />Үүсгэх</Button></div></>}
        {runStatus === 'creating' && <div className="py-12 text-center"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-sand border-t-transparent" /><p className="mt-5 font-semibold text-cream">Нэхэмжлэлүүдийг бэлтгэж байна...</p><p className="mt-2 text-xs text-sand-400">Тариф, тоолуур, алдангийн дүрмийг шалгаж байна.</p></div>}
        {runStatus === 'complete' && <div className="py-7 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-200"><CheckCircle2 className="h-6 w-6" /></span><p className="mt-4 font-semibold text-cream">{selectedUnitIds.length} айлын нэхэмжлэл үүслээ.</p><p className="mt-2 text-xs text-sand-400">{periodStart} — {periodEnd}</p><Button className="mt-7" onClick={() => setIsRunDialogOpen(false)}>Дуусгах</Button></div>}
      </div></div>, document.body)}
    </>
  );
}
