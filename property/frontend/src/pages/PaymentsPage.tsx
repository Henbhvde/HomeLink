import { createPortal } from 'react-dom';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBackendState } from '../hooks/useBackendState';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileUp,
Landmark,
  Link2,
  Plus,
  Search,
  Unlink,
  WalletCards,
  X,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';
import { useUrlQueryState } from '../hooks/useUrlQueryState';
import { useToast } from '../contexts/ToastContext';

type PaymentStatus = 'confirmed' | 'pending';
type StatementStatus = 'pending' | 'matched' | 'ignored';
type AgingBucket = 'all' | '0-30' | '31-60' | '61-90' | '90+';
type PageTab = 'reconciliation' | 'receivables' | 'payments';

type Payment = {
  id: string;
  resident: string;
  unit: string;
  method: string;
  amount: number;
  time: string;
  status: PaymentStatus;
  source: 'bank' | 'manual';
  reference: string;
  receiptNote?: string;
};

type BankStatement = {
  id: string;
  payer: string;
  reference: string;
  receivedAt: string;
  amount: number;
  suggestedInvoice: string;
  suggestedUnit: string;
  status: StatementStatus;
  conflictReason?: string;
};

type Receivable = {
  id: string;
  unit: string;
  resident: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  bucket: Exclude<AgingBucket, 'all'>;
};


const formatMnt = (amount: number) => `₮${new Intl.NumberFormat('mn-MN').format(amount)}`;

const statementTone: Record<StatementStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  matched: 'success',
  ignored: 'neutral',
};

const statementLabel: Record<StatementStatus, string> = {
  pending: 'Тулгах шаардлагатай',
  matched: 'Тулгасан',
  ignored: 'Алгассан',
};

const agingMeta: { bucket: AgingBucket; label: string; hint: string }[] = [
  { bucket: 'all', label: 'Нийт авлага', hint: 'Бүх хугацаа' },
  { bucket: '0-30', label: '0–30 хоног', hint: 'Шинэ авлага' },
  { bucket: '31-60', label: '31–60 хоног', hint: 'Анхаарах' },
  { bucket: '61-90', label: '61–90 хоног', hint: 'Өндөр эрсдэл' },
  { bucket: '90+', label: '90+ хоног', hint: 'Шуурхай арга хэмжээ' },
];

export default function PaymentsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useUrlQueryState<PageTab>('tab', 'reconciliation', ['reconciliation', 'receivables', 'payments']);
  const [statements, setStatements, statementsStatus, retryStatements] = useBackendState<BankStatement[]>('payment-statements', []);
  const [payments, setPayments, paymentsStatus, retryPayments] = useBackendState<Payment[]>('payment-records', []);
  const [receivables] = useState<Receivable[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>('STMT-007');
  const [selectedAging, setSelectedAging] = useState<AgingBucket>('all');
  const [search, setSearch] = useState('');
  const [statementFile, setStatementFile] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState('Бэлтгэж байна...');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ unit: '', resident: '', amount: '', method: 'Бэлэн мөнгө', reference: '' });
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, confirm } = useToast();

  const { data: paymentStats } = useQuery({
    queryKey: ['payment-stats', token],
    queryFn: () => apiClient.getPaymentStats(token || ''),
    enabled: !!token,
  });

  const pendingStatements = statements.filter((statement) => statement.status === 'pending').length;
  const selectedStatement = statements.find((statement) => statement.id === selectedStatementId) ?? null;
  const filteredStatements = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return statements;
    return statements.filter((statement) => `${statement.payer} ${statement.reference} ${statement.suggestedUnit}`.toLowerCase().includes(normalized));
  }, [search, statements]);
  const filteredPayments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return payments;
    return payments.filter((payment) => `${payment.id} ${payment.resident} ${payment.unit} ${payment.method}`.toLowerCase().includes(normalized));
  }, [payments, search]);
  const visibleReceivables = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return receivables.filter((row) => (selectedAging === 'all' || row.bucket === selectedAging) && `${row.unit} ${row.resident}`.toLowerCase().includes(normalized));
  }, [receivables, search, selectedAging]);
  const agingTotal = (bucket: AgingBucket) => receivables.filter((row) => bucket === 'all' || row.bucket === bucket).reduce((total, row) => total + row.amount, 0);

  const importStatementFile = (fileName: string) => {
    setStatementFile(fileName);
    setImportProgress(0);
    setImportStage('Бэлтгэж байна...');

    const steps = [
      { progress: 22, stage: 'Файл уншиж байна...' },
      { progress: 58, stage: 'Мөрүүдийг таньж байна...' },
      { progress: 84, stage: 'Тулгах санал бэлдэж байна...' },
      { progress: 100, stage: 'Бэлэн боллоо' },
    ];

    steps.forEach((step, index) => {
      window.setTimeout(() => {
        setImportProgress(step.progress);
        setImportStage(step.stage);
        if (index === steps.length - 1) {
          const importedStatement: BankStatement = {
            id: `STMT-IMP-${String(statements.length + 1).padStart(3, '0')}`,
            payer: 'Импортолсон мөр',
            reference: `${fileName} · A-0604`,
            receivedAt: 'Дөнгөж сая',
            amount: 110000,
            suggestedInvoice: 'INV-2026-0708',
            suggestedUnit: 'A-0604',
            status: 'pending',
            conflictReason: 'Олон боломжит нэхэмжлэлтэй тул автомат тулгалт хийх боломжгүй.',
          };
          setStatements((rows) => [importedStatement, ...rows]);
          setSelectedStatementId(importedStatement.id);
          setTab('reconciliation');
          showToast({ title: `${fileName} хуулгаас 1 шинэ мөр импортлогдлоо.`, tone: 'success' });
        }
      }, 280 * (index + 1));
    });
  };

  const reconcileStatement = (statementId: string) => {
    const statement = statements.find((row) => row.id === statementId);
    if (!statement || statement.status !== 'pending') return;
    if (statement.conflictReason || statement.suggestedUnit === '—' || statement.amount > 250000) {
      setStatements((rows) => rows.map((row) => row.id === statementId ? { ...row, conflictReason: row.conflictReason ?? 'Олон боломжит нэхэмжлэлтэй тул дахин шалгах шаардлагатай.' } : row));
      showToast({ title: 'Тулгалтонд зөрүү илэрлээ.', description: 'Доорх шийдвэрлэх сонголт руу шилжье.', tone: 'warning' });
      return;
    }
    setStatements((rows) => rows.map((row) => row.id === statementId ? { ...row, status: 'matched', conflictReason: undefined } : row));
    setPayments((rows) => [
      { id: `TXN-${statement.id.slice(-3)}-${rows.length + 31}`, resident: statement.payer, unit: statement.suggestedUnit, method: 'Банкны хуулга', amount: statement.amount, time: 'Дөнгөж сая', status: 'confirmed', source: 'bank', reference: statement.reference, receiptNote: 'Автоматаар тулгагдсан банкны хуулга.' },
      ...rows,
    ]);
    showToast({ title: `${statement.suggestedUnit} төлбөр нэхэмжлэлтэй тулгагдлаа.`, tone: 'success' });
  };

  const resolveConflict = async (statementId: string, action: 'match' | 'ignore') => {
    const statement = statements.find((row) => row.id === statementId);
    if (!statement || statement.status !== 'pending') return;

    if (action === 'match') {
      setStatements((rows) => rows.map((row) => row.id === statementId ? { ...row, status: 'matched', conflictReason: undefined } : row));
      setPayments((rows) => [
        { id: `TXN-${statement.id.slice(-3)}-${rows.length + 41}`, resident: statement.payer, unit: statement.suggestedUnit, method: 'Банкны хуулга', amount: statement.amount, time: 'Дөнгөж сая', status: 'confirmed', source: 'bank', reference: statement.reference, receiptNote: 'Зөрүүг шийдвэрлэсэн төлбөрийн баримт.' },
        ...rows,
      ]);
      showToast({ title: 'Зөрүүг шийдэж, төлбөрийг баталгаажууллаа.', tone: 'success' });
      return;
    }

    const shouldIgnore = await confirm({
      title: 'Тулгалтыг алгасах уу?',
      description: 'Энэ гүйлгээг нэхэмжлэлтэй холбохгүйгээр үлдээх бөгөөд дараагийн алхмаар дахин ажиллуулж болно.',
      confirmLabel: 'Алгасах',
      cancelLabel: 'Болих',
      tone: 'danger',
    });
    if (!shouldIgnore) return;

    setStatements((rows) => rows.map((row) => row.id === statementId ? { ...row, status: 'ignored', conflictReason: undefined } : row));
    showToast({ title: 'Тулгалтын зөрүүг алгассан боллоо.', tone: 'info' });
  };

  const ignoreStatement = async (statementId: string) => {
    const shouldIgnore = await confirm({
      title: 'Энэ хуулганы мөрийг алгасах уу?',
      description: 'Энэ үйлдэл нь мөрийг үл тоомсорлож, дараагийн шалгалтын жагсаалт руу шилжүүлнэ.',
      confirmLabel: 'Алгасах',
      cancelLabel: 'Болих',
      tone: 'danger',
    });
    if (!shouldIgnore) return;

    setStatements((rows) => rows.map((row) => row.id === statementId ? { ...row, status: 'ignored' } : row));
    showToast({ title: 'Хуулганы мөрийг алгассан төлөвт шилжүүллээ.', tone: 'info' });
  };

  const saveManualPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(manualForm.amount.replaceAll(',', ''));
    if (!manualForm.unit.trim() || !manualForm.resident.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setPayments((rows) => [
      {
        id: `MAN-${String(rows.filter((row) => row.source === 'manual').length + 1).padStart(3, '0')}`,
        resident: manualForm.resident.trim(),
        unit: manualForm.unit.trim().toUpperCase(),
        method: manualForm.method,
        amount,
        time: 'Өнөөдөр, гар бүртгэл',
        status: 'confirmed',
        source: 'manual',
        reference: manualForm.reference.trim() || 'Гар бүртгэл',
        receiptNote: 'Гарын үүсгэсэн төлбөрийн баримт.',
      },
      ...rows,
    ]);
    setManualForm({ unit: '', resident: '', amount: '', method: 'Бэлэн мөнгө', reference: '' });
    setIsManualOpen(false);
    setTab('payments');
    showToast({ title: `${manualForm.unit.toUpperCase()} гар төлбөр бүртгэгдлээ.`, tone: 'success' });
  };

  const overallStatus: 'loading' | 'ready' | 'error' = statementsStatus === 'error' || paymentsStatus === 'error' ? 'error' : statementsStatus === 'loading' || paymentsStatus === 'loading' ? 'loading' : 'ready';
  const overallRetry = () => {
    retryStatements();
    retryPayments();
  };

  const topStats = [
    { label: 'Өнөөдрийн орлого', value: formatMnt(paymentStats?.todayIncome ?? 0), note: 'Банк, QPay, гар төлбөр', icon: WalletCards },
    { label: 'Тулгах мөр', value: String(pendingStatements), note: 'Банкны хуулгаас', icon: ArrowRightLeft },
    { label: 'Баталгаажсан төлбөр', value: String(paymentStats?.confirmedThisMonth ?? payments.filter((payment) => payment.status === 'confirmed').length), note: 'Энэ сарын мөчлөг', icon: CheckCircle2 },
    { label: 'Авлагын үлдэгдэл', value: formatMnt(paymentStats?.receivablesTotal ?? agingTotal('all')), note: '30/60/90 насжилттай', icon: CircleDollarSign },
  ];

  return (
    <>
    <PageStateWrapper
      status={overallStatus}
      isEmpty={statements.length === 0 && payments.length === 0}
      onRetry={overallRetry}
      emptyIcon={WalletCards}
      emptyTitle="Одоогоор төлбөрийн бүртгэл алга"
      emptyDescription="Эхний төлбөр, хуулгаар дамжуулан бүртгэлээ эхлүүлээрэй."
      emptyAction={<Button onClick={() => setIsManualOpen(true)}>Гар төлбөр бүртгэх</Button>}
    >
      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">FR-4 · PAYMENT OPERATIONS</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Төлбөр ба авлага.</h1>
          <p className="mt-2 max-w-2xl text-sm text-sand-400">Банкны хуулга тулгах, гар төлбөр бүртгэх болон авлагын насжилтыг нэг дор хянана.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => { const fileName = event.target.files?.[0]?.name; if (fileName) importStatementFile(fileName); event.target.value = ''; }} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" />Хуулга импортлох</Button>
          <Button onClick={() => setIsManualOpen(true)}><Plus className="h-4 w-4" />Гар төлбөр бүртгэх</Button>
        </div>
      </div>

      {statementFile && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-100"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><span className="font-semibold">{statementFile}</span><span className="text-emerald-200/70">хуулгыг боловсруулж байна.</span></div><div className="mt-3"><div className="mb-1 flex items-center justify-between text-[11px] text-emerald-200/90"><span>{importStage}</span><span>{importProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-emerald-300/90 transition-all duration-300" style={{ width: `${importProgress}%` }} /></div></div></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {topStats.map(({ label, value, note, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-[11px] text-sand-400">{label}</p><b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{value}</b><small className="mt-1 block text-[10px] text-sand-500">{note}</small></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/10 text-sand"><Icon className="h-4 w-4" /></span></CardContent></Card>)}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-col gap-4 border-b border-white/7 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full overflow-x-auto rounded-xl bg-black/25 p-1 md:w-auto">
            {([
              ['reconciliation', 'Банкны тулгалт'],
              ['receivables', 'Авлагын насжилт'],
              ['payments', 'Бүртгэгдсэн төлбөр'],
            ] as [PageTab, string][]).map(([value, label]) => <button key={value} onClick={() => { setTab(value); setSearch(''); }} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${tab === value ? 'bg-sand text-onyx' : 'text-sand-400 hover:text-cream'}`}>{label}</button>)}
          </div>
          <div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9" placeholder={tab === 'receivables' ? 'Айл, оршин суугч хайх...' : 'Дугаар, айл эсвэл нэрээр хайх...'} /></div>
        </CardHeader>

        {tab === 'reconciliation' && <CardContent className="grid gap-5 p-5 xl:grid-cols-[1.45fr_.75fr]">
          <div className="overflow-hidden rounded-xl border border-white/8">
            <div className="flex items-center justify-between border-b border-white/7 bg-white/[.02] px-4 py-3"><div><p className="text-[10px] font-bold tracking-[.14em] text-sand">FR-4.2 · BANK STATEMENT</p><p className="mt-1 text-xs text-sand-400">Орсон гүйлгээг санал болгосон нэхэмжлэлтэй тулгана.</p></div><Badge tone="warning">{pendingStatements} мөр</Badge></div>
            {filteredStatements.length === 0 ? <div className="p-6"><EmptyState icon={Search} title="Хуулганы мөр олдсонгүй" description="Хайлтын нөхцөлөө өөрчлөөд дахин оролдоно уу." /></div> : <div className="divide-y divide-white/7">{filteredStatements.map((statement) => <button key={statement.id} onClick={() => setSelectedStatementId(statement.id)} className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${selectedStatementId === statement.id ? 'bg-sand/[.08]' : 'hover:bg-white/[.025]'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-sand"><Landmark className="h-4 w-4" /></span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-cream">{statement.payer}</b><small className="mt-1 block truncate text-[10px] text-sand-500">{statement.reference} · {statement.receivedAt}</small></div><div className="shrink-0 text-right"><b className="block text-xs text-cream">{formatMnt(statement.amount)}</b><Badge tone={statementTone[statement.status]} className="mt-1">{statementLabel[statement.status]}</Badge></div></button>)}</div>}
          </div>

          <div className="rounded-xl border border-white/8 bg-black/20 p-5">
            {selectedStatement ? <>
              <p className="text-[10px] font-bold tracking-[.16em] text-sand">TULGALТЫН ДЭЛГЭРЭНГҮЙ</p>
              <div className="mt-4 flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl text-cream">{formatMnt(selectedStatement.amount)}</h2><p className="mt-1 text-xs text-sand-400">{selectedStatement.payer}</p></div><Badge tone={statementTone[selectedStatement.status]}>{statementLabel[selectedStatement.status]}</Badge></div>
              <div className="mt-6 space-y-4 border-y border-white/7 py-5">
                <div><p className="text-[10px] text-sand-500">ГҮЙЛГЭЭНИЙ УТГА</p><p className="mt-1 text-xs text-sand-200">{selectedStatement.reference}</p></div>
                <div><p className="text-[10px] text-sand-500">САНАЛ БОЛГОСОН НЭХЭМЖЛЭЛ</p><p className="mt-1 text-xs font-semibold text-cream">{selectedStatement.suggestedInvoice}</p><p className="mt-1 text-[11px] text-sand-400">Айл: {selectedStatement.suggestedUnit}</p></div>
              </div>
              {selectedStatement.conflictReason && <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-50"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Тулгалтын зөрүү</div><p className="mt-2 text-amber-100/90">{selectedStatement.conflictReason}</p><div className="mt-3 flex flex-wrap gap-2"><Button className="" onClick={() => resolveConflict(selectedStatement.id, 'match')}><Link2 className="h-4 w-4" />Энэ мэтээр батлах</Button><Button variant="ghost" onClick={() => resolveConflict(selectedStatement.id, 'ignore')}><Unlink className="h-4 w-4" />Алгасах</Button></div></div>}
              {selectedStatement.status === 'pending' && !selectedStatement.conflictReason ? <div className="mt-5 space-y-2"><Button className="w-full" onClick={() => reconcileStatement(selectedStatement.id)} disabled={selectedStatement.suggestedUnit === '—'}><Link2 className="h-4 w-4" />Нэхэмжлэлтэй тулгаж батлах</Button><Button variant="ghost" className="w-full" onClick={() => ignoreStatement(selectedStatement.id)}><Unlink className="h-4 w-4" />Одоогоор алгасах</Button></div> : selectedStatement.status !== 'pending' ? <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[.025] p-3 text-xs text-sand-300"><CheckCircle2 className="h-4 w-4 text-emerald-300" />Энэ мөр дээр дахин үйлдэл хийхгүй.</div> : null}
            </> : <EmptyState icon={Landmark} title="Хуулганы мөр сонгоно уу" description="Сонгосон гүйлгээний санал болгосон нэхэмжлэл энд харагдана." />}
          </div>
        </CardContent>}

        {tab === 'receivables' && <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {agingMeta.map(({ bucket, label, hint }) => <button key={bucket} onClick={() => setSelectedAging(bucket)} className={`rounded-xl border p-4 text-left transition-colors ${selectedAging === bucket ? 'border-sand/55 bg-sand/[.08]' : 'border-white/8 bg-black/20 hover:border-white/20'}`}><p className="text-[11px] text-sand-400">{label}</p><b className="mt-2 block font-sans text-xl font-semibold tracking-tight text-cream">{formatMnt(agingTotal(bucket))}</b><small className="mt-1 block text-[10px] text-sand-500">{hint}</small></button>)}
          </div>
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500">
                  <tr>
                    <th className="px-5 py-3">АЙЛ / ОРШИН СУУГЧ</th>
                    <th className="px-5 py-3">ДҮН</th>
                    <th className="px-5 py-3">ТӨЛӨХ ХУГАЦАА</th>
                    <th className="px-5 py-3">ХОЦРОЛТ</th>
                    <th className="px-5 py-3">НАСЖИЛТ</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReceivables.map((row) => (
                    <tr key={row.id} className="border-b border-white/[.06] text-xs hover:bg-white/[.025]">
                      <td className="px-5 py-4">
                        <b className="block text-cream">{row.unit}</b>
                        <small className="text-[10px] text-sand-500">{row.resident}</small>
                      </td>
                      <td className="px-5 py-4 font-semibold text-cream">{formatMnt(row.amount)}</td>
                      <td className="px-5 py-4 text-sand-300">{row.dueDate}</td>
                      <td className="px-5 py-4 text-sand-200">{row.daysOverdue} хоног</td>
                      <td className="px-5 py-4">
                        <Badge tone={row.bucket === '90+' ? 'danger' : row.bucket === '61-90' ? 'warning' : 'neutral'}>{row.bucket} хоног</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => setSelectedReceivable(row)} className="inline-flex items-center gap-1 text-xs font-semibold text-sand transition-colors hover:text-cream">
                          Дэлгэрэнгүй <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card List */}
            <div className="grid gap-3 md:hidden">
              {visibleReceivables.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/8 bg-black/15 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-cream text-xs">{row.unit}</b>
                      <small className="block text-[10px] text-sand-500">{row.resident}</small>
                    </div>
                    <Badge tone={row.bucket === '90+' ? 'danger' : row.bucket === '61-90' ? 'warning' : 'neutral'}>{row.bucket} хоног</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-sand-400 border-t border-white/[.04] pt-2.5">
                    <div>
                      <span className="block text-[10px] text-sand-500">Хоцролт: {row.daysOverdue} хоног</span>
                      <span>Төлөх: {row.dueDate}</span> 
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <b className="block text-cream">{formatMnt(row.amount)}</b>
                      <button type="button" onClick={() => setSelectedReceivable(row)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-sand transition-colors hover:text-cream">
                        Дэлгэрэнгүй <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {visibleReceivables.length === 0 && (
              <div className="p-7 rounded-xl border border-white/8 bg-black/15 mt-3">
                <EmptyState icon={Search} title="Авлага олдсонгүй" description="Сонгосон насжилт болон хайлтад тохирох айл байхгүй байна." />
              </div>
            )}
          </div>
        </CardContent>}

        {tab === 'payments' && <CardContent className="p-5">
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500">
                  <tr>
                    <th className="px-5 py-3">ГҮЙЛГЭЭ</th>
                    <th className="px-5 py-3">АЙЛ / ОРШИН СУУГЧ</th>
                    <th className="px-5 py-3">СУВАГ</th>
                    <th className="px-5 py-3">ДҮН</th>
                    <th className="px-5 py-3">ТӨЛӨВ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} onClick={() => setSelectedPayment(payment)} className="cursor-pointer border-b border-white/[.06] text-xs hover:bg-white/[.025]">
                      <td className="px-5 py-4">
                        <b className="block text-cream">{payment.id}</b>
                        <small className="text-[10px] text-sand-500">{payment.time}</small>
                      </td>
                      <td className="px-5 py-4">
                        <b className="block text-cream">{payment.unit}</b>
                        <small className="text-[10px] text-sand-500">{payment.resident}</small>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-sand-300">
                          {payment.source === 'manual' ? <WalletCards className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                          {payment.method}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-cream">{formatMnt(payment.amount)}</td>
                      <td className="px-5 py-4">
                        <Badge tone={payment.status === 'confirmed' ? 'success' : 'warning'}>
                          {payment.status === 'confirmed' ? 'Баталгаажсан' : 'Тулгаж байна'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card List */}
            <div className="grid gap-3 md:hidden">
              {filteredPayments.map((payment) => (
                <div key={payment.id} onClick={() => setSelectedPayment(payment)} className="cursor-pointer rounded-xl border border-white/8 bg-black/15 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cream text-xs">{payment.id}</span>
                    <Badge tone={payment.status === 'confirmed' ? 'success' : 'warning'}>
                      {payment.status === 'confirmed' ? 'Баталгаажсан' : 'Тулгаж байна'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-sand-400">
                    <div>
                      <b className="block text-cream">{payment.unit}</b>
                      <small className="text-[10px] text-sand-500">{payment.resident}</small>
                    </div>
                    <div className="text-right">
                      <b className="block text-cream">{formatMnt(payment.amount)}</b>
                      <span className="inline-flex items-center gap-1 mt-0.5">
                        {payment.source === 'manual' ? <WalletCards className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                        {payment.method}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-sand-500 border-t border-white/[.04] pt-1.5">{payment.time}</span>
                </div>
              ))}
            </div>
            {filteredPayments.length === 0 && (
              <div className="p-7 rounded-xl border border-white/8 bg-black/15 mt-3">
                <EmptyState icon={Search} title="Төлбөр олдсонгүй" description="Хайлтын нөхцөлөө өөрчлөөд дахин оролдоно уу." />
              </div>
            )}
          </div>
        </CardContent>}
      </Card>

      </section>
    </PageStateWrapper>

      {isManualOpen && createPortal(<div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm"><form onSubmit={saveManualPayment} className="accountant-modal-panel my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">FR-4.2 · MANUAL PAYMENT</p><h2 className="mt-2 font-serif text-2xl text-cream">Гар төлбөр бүртгэх</h2><p className="mt-1 text-xs text-sand-400">Банкны хуулганд ороогүй бэлэн болон гар шилжүүлгийг бүртгэнэ.</p></div><button type="button" onClick={() => setIsManualOpen(false)} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-sand-200">Айлын дугаар<Input required value={manualForm.unit} onChange={(event) => setManualForm((form) => ({ ...form, unit: event.target.value }))} className="mt-2" placeholder="A-1203" /></label><label className="text-xs font-semibold text-sand-200">Оршин суугч<Input required value={manualForm.resident} onChange={(event) => setManualForm((form) => ({ ...form, resident: event.target.value }))} className="mt-2" placeholder="Бат-Эрдэнэ" /></label><label className="text-xs font-semibold text-sand-200">Төлсөн дүн<Input required type="number" min="1" value={manualForm.amount} onChange={(event) => setManualForm((form) => ({ ...form, amount: event.target.value }))} className="mt-2" placeholder="120000" /></label><label className="text-xs font-semibold text-sand-200">Төлбөрийн төрөл<select value={manualForm.method} onChange={(event) => setManualForm((form) => ({ ...form, method: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-cream outline-none focus:border-sand/55"><option>Бэлэн мөнгө</option><option>Банкны шилжүүлэг</option><option>ПОС төлбөр</option></select></label></div>
        <label className="mt-4 block text-xs font-semibold text-sand-200">Гүйлгээний тайлбар / баримтын дугаар<Input value={manualForm.reference} onChange={(event) => setManualForm((form) => ({ ...form, reference: event.target.value }))} className="mt-2" placeholder="Жишээ: Касс-017" /></label>
        <div className="mt-7 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setIsManualOpen(false)}>Болих</Button><Button type="submit"><CheckCircle2 className="h-4 w-4" />Төлбөр баталгаажуулах</Button></div>
      </form></div>, document.body)}

      {selectedReceivable && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={() => setSelectedReceivable(null)}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">RECEIVABLE DETAIL</p><h2 className="mt-2 font-serif text-2xl text-cream">{selectedReceivable.unit}</h2><p className="mt-1 text-xs text-sand-400">{selectedReceivable.resident}</p></div><button type="button" onClick={() => setSelectedReceivable(null)} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{[['Үлдэгдэл', formatMnt(selectedReceivable.amount)], ['Төлөх хугацаа', selectedReceivable.dueDate], ['Хоцролт', `${selectedReceivable.daysOverdue} хоног`], ['Насжилт', `${selectedReceivable.bucket} хоног`]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] text-sand-500">{label}</p><b className="mt-1 block text-sm text-cream">{value}</b></div>)}</div><Button className="mt-6 w-full" onClick={() => { setSelectedReceivable(null); setIsManualOpen(true); setManualForm((form) => ({ ...form, unit: selectedReceivable.unit, resident: selectedReceivable.resident, amount: String(selectedReceivable.amount), reference: selectedReceivable.id })); }}>Төлбөр бүртгэх</Button></div></div>}

      {selectedPayment && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={() => setSelectedPayment(null)}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">PAYMENT RECEIPT</p><h2 className="mt-2 font-serif text-2xl text-cream">{selectedPayment.id}</h2><p className="mt-1 text-xs text-sand-400">{selectedPayment.unit} · {selectedPayment.resident}</p></div><button type="button" onClick={() => setSelectedPayment(null)} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div><div className="mt-6 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[.04] to-black/20 p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold tracking-[.16em] text-sand-500">ТӨЛБӨРИЙН БАРИМТ</p><p className="mt-2 text-sm text-cream">{selectedPayment.reference}</p></div><div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-200">Баталгаажсан</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[['Дүн', formatMnt(selectedPayment.amount)], ['Суваг', selectedPayment.method], ['Огноо', selectedPayment.time], ['Эх сурвалж', selectedPayment.source === 'manual' ? 'Гар бүртгэл' : 'Банкны хуулга']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-4 py-3"><p className="text-[10px] text-sand-500">{label}</p><b className="mt-1 block text-sm text-cream">{value}</b></div>)}</div><div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-sand-300"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-sand-500">Тэмдэглэл</p><p className="mt-2 text-sm text-sand-200">{selectedPayment.receiptNote ?? 'Төлбөрийн баримт амжилттай бэлэн болсон.'}</p></div></div><Button className="mt-6 w-full" variant="outline" onClick={() => showToast({ title: `${selectedPayment.id} баримт татахад бэлэн боллоо.`, tone: 'info' })}>Баримт татах</Button></div></div>}
    </>
  );
}
