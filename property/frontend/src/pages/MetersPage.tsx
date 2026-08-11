import { useMemo, useState } from 'react';
import { useBackendState } from '../hooks/useBackendState';
import { AlertTriangle, Camera, Check, CheckCircle2, Droplets, PencilLine, Plus, Sparkles, X, Zap } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';

type ReadingStatus = 'approved' | 'pending' | 'flagged' | 'missing';

type MeterReading = {
  id: string;
  unit: string;
  resident: string;
  type: 'Цахилгаан' | 'Ус';
  previous: number;
  current: number | null;
  averageUsage: number;
  status: ReadingStatus;
  issue?: string;
  estimated?: boolean;
  proofName?: string;
};

const initialReadings: MeterReading[] = [
  { id: 'A-1203-electricity', unit: 'A-1203', resident: 'Бат-Эрдэнэ', type: 'Цахилгаан', previous: 12840, current: 13012, averageUsage: 148, status: 'approved' },
  { id: 'B-0801-water', unit: 'B-0801', resident: 'Ариунтуяа', type: 'Ус', previous: 1421, current: 1438, averageUsage: 15, status: 'pending' },
  { id: 'C-1408-electricity', unit: 'C-1408', resident: 'Мөнх-Эрдэнэ', type: 'Цахилгаан', previous: 8991, current: 9123, averageUsage: 93, status: 'flagged', issue: 'Өмнөх 3 сарын дунджаас 42% өндөр' },
  { id: 'D-0202-water', unit: 'D-0202', resident: 'Чингүүн', type: 'Ус', previous: 980, current: null, averageUsage: 14, status: 'missing' },
];

const statusMeta: Record<ReadingStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  approved: { label: 'Баталгаажсан', tone: 'success' },
  pending: { label: 'Батлах хүлээгдэж буй', tone: 'warning' },
  flagged: { label: 'Зөрүү шалгах', tone: 'danger' },
  missing: { label: 'Заалт өгөөгүй', tone: 'neutral' },
};

const number = new Intl.NumberFormat('mn-MN');

export default function MetersPage() {
  const [readings, setReadings, status, retry] = useBackendState<MeterReading[]>('meter-readings', initialReadings);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ unit: '', type: 'Цахилгаан', previous: '', current: '' });
  const [notice, setNotice] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const previousValue = Number(form.previous);
  const currentValue = Number(form.current);
  const usage = currentValue - previousValue;
  const editingReading = readings.find((reading) => reading.id === editingId);
  const expectedUsage = editingReading?.averageUsage ?? (form.type === 'Ус' ? 20 : 200);
  const invalidReading = Boolean(form.previous && form.current && currentValue < previousValue);
  const unusualUsage = !invalidReading && Number.isFinite(usage) && usage > expectedUsage * 1.5;

  const summary = useMemo(() => {
    const approved = readings.filter((reading) => reading.status === 'approved').length;
    const missing = readings.filter((reading) => reading.status === 'missing').length;
    const flagged = readings.filter((reading) => reading.status === 'flagged').length;
    return { approved, missing, flagged, completion: Math.round((approved / readings.length) * 100) };
  }, [readings]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const updateReading = (id: string, update: Partial<MeterReading>) => {
    setReadings((current) => current.map((reading) => reading.id === id ? { ...reading, ...update } : reading));
  };

  const approveReading = (reading: MeterReading) => {
    updateReading(reading.id, { status: 'approved', issue: undefined, estimated: false });
    showNotice(`${reading.unit}-ийн заалтыг баталгаажууллаа.`);
  };

  const applyAverage = (reading: MeterReading) => {
    const current = reading.previous + reading.averageUsage;
    updateReading(reading.id, { current, status: 'approved', estimated: true, issue: undefined });
    showNotice(`${reading.unit}-д ${reading.averageUsage} ${reading.type === 'Ус' ? 'м³' : 'kWh'} дундаж хэрэглээ тооцлоо.`);
  };

  const openNewReading = () => {
    setEditingId(null);
    setForm({ unit: '', type: 'Цахилгаан', previous: '', current: '' });
    setProofFile(null);
    setIsDialogOpen(true);
  };

  const openCorrection = (reading: MeterReading) => {
    setEditingId(reading.id);
    setForm({ unit: reading.unit, type: reading.type, previous: String(reading.previous), current: String(reading.current ?? '') });
    setProofFile(null);
    setIsDialogOpen(true);
  };

  const saveReading = () => {
    const previous = Number(form.previous);
    const current = Number(form.current);
    if (!form.unit.trim() || !Number.isFinite(previous) || !Number.isFinite(current) || current < previous) return;

    if (editingId) {
      const existing = readings.find((reading) => reading.id === editingId);
      const usage = current - previous;
      const isAnomaly = Boolean(existing && usage > existing.averageUsage * 1.5);
      updateReading(editingId, {
        previous,
        current,
        status: isAnomaly ? 'flagged' : 'pending',
        issue: isAnomaly ? 'Дундаж хэрэглээнээс 50%-иас өндөр зөрүү илэрлээ' : undefined,
        estimated: false,
        proofName: proofFile?.name,
      });
      showNotice(isAnomaly ? 'Зассан заалт дахин шалгах төлөвт орлоо.' : 'Заалтыг засаж, баталгаажуулах дараалалд орууллаа.');
    } else {
      const type = form.type as MeterReading['type'];
      setReadings((currentReadings) => [
        ...currentReadings,
        {
          id: `${form.unit}-${type}-${Date.now()}`,
          unit: form.unit.trim().toUpperCase(),
          resident: 'Гараар оруулсан',
          type,
          previous,
          current,
          averageUsage: current - previous,
          status: 'pending',
          proofName: proofFile?.name,
        },
      ]);
      showNotice('Шинэ заалтыг баталгаажуулах дараалалд нэмлээ.');
    }

    setIsDialogOpen(false);
  };

  return (
    <PageStateWrapper
      status={status}
      isEmpty={readings.length === 0 && !isDialogOpen}
      onRetry={retry}
      emptyIcon={Zap}
      emptyTitle="Одоогоор тоолуурын заалт алга"
      emptyDescription="Шинэ заалтыг оруулаад хэрэглээний хяналтыг үргэлжлүүлээрэй."
      emptyAction={<Button onClick={openNewReading}>Заалт оруулах</Button>}
    >
      <section>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">METER READINGS · FR-3.3 / FR-3.4</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Тоолуурын заалт.</h1>
          <p className="mt-2 text-sm text-sand-400">Оршин суугчийн илгээсэн заалтыг шалгаж батлах, зөрүүг засах, дутууг дундажлаар тооцно.</p>
        </div>
        <Button onClick={openNewReading}><Plus className="h-4 w-4" />Заалт оруулах</Button>
      </div>

      {notice && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Баталгаажсан', value: `${summary.completion}%`, icon: CheckCircle2, note: `${summary.approved} / ${readings.length} заалт` },
          { label: 'Зөрүүтэй заалт', value: String(summary.flagged), icon: AlertTriangle, note: 'Шалгаж засах шаардлагатай' },
          { label: 'Дутуу заалт', value: String(summary.missing), icon: Sparkles, note: 'Дундаж хэрэглэх боломжтой' },
        ].map(({ label, value, icon: Icon, note }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sand/10 text-sand"><Icon className="h-4 w-4" /></span><small className="text-[10px] text-sand-500">{note}</small></div>
              <p className="mt-5 text-[11px] text-sand-400">{label}</p>
              <b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{value}</b>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-white/7 p-4">
            <div>
              <h2 className="font-serif text-xl text-cream">2026 оны 7-р сарын заалт</h2>
              <p className="mt-1 text-xs text-sand-400">Дундажлах дүрэм: өмнөх 3 сарын хэрэглээний дундаж</p>
            </div>
            <Badge tone={summary.missing > 0 || summary.flagged > 0 ? 'warning' : 'success'}>{summary.missing + summary.flagged} шалгах мөр</Badge>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[930px] text-left">
              <thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500">
                <tr><th className="px-5 py-3">АЙЛ</th><th className="px-5 py-3">ТӨРӨЛ</th><th className="px-5 py-3">ӨМНӨХ</th><th className="px-5 py-3">ОДООГИЙН</th><th className="px-5 py-3">ХЭРЭГЛЭЭ</th><th className="px-5 py-3">ТӨЛӨВ</th><th className="px-5 py-3 text-right">ҮЙЛДЭЛ</th></tr>
              </thead>
              <tbody>
                {readings.map((reading) => {
                  const usage = reading.current === null ? null : reading.current - reading.previous;
                  const unit = reading.type === 'Ус' ? 'м³' : 'kWh';
                  return (
                    <tr key={reading.id} className="border-b border-white/[.06] text-xs hover:bg-white/[.025]">
                      <td className="px-5 py-4"><b className="block text-cream">{reading.unit}</b><small className="text-[10px] text-sand-500">{reading.resident}</small></td>
                      <td className="px-5 py-4 text-sand-300"><span className="inline-flex items-center gap-1.5">{reading.type === 'Ус' ? <Droplets className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}{reading.type}</span></td>
                      <td className="px-5 py-4 text-sand-300">{number.format(reading.previous)}</td>
                      <td className="px-5 py-4 font-semibold text-cream">{reading.current === null ? '—' : number.format(reading.current)}</td>
                      <td className="px-5 py-4 text-sand">{usage === null ? '—' : `${number.format(usage)} ${unit}`}{reading.estimated && <small className="ml-2 text-[10px] text-amber-200">дундаж</small>}</td>
                      <td className="px-5 py-4"><Badge tone={statusMeta[reading.status].tone}>{statusMeta[reading.status].label}</Badge>{reading.issue && <small className="mt-1 block text-[10px] text-red-200">{reading.issue}</small>}</td>
                      <td className="px-5 py-4 text-right">
                        {reading.status === 'approved' && <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><Check className="h-3.5 w-3.5" />Баталгаажсан</span>}
                        {reading.status === 'pending' && <Button size="sm" onClick={() => approveReading(reading)}><Check className="h-3.5 w-3.5" />Батлах</Button>}
                        {reading.status === 'flagged' && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openCorrection(reading)}><PencilLine className="h-3.5 w-3.5" />Засах</Button><Button size="sm" onClick={() => approveReading(reading)}>Батлах</Button></div>}
                        {reading.status === 'missing' && <Button size="sm" variant="outline" onClick={() => applyAverage(reading)}><Sparkles className="h-3.5 w-3.5" />Дундажлах</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card List */}
          <div className="grid gap-3 p-4 md:hidden">
            {readings.map((reading) => {
              const usage = reading.current === null ? null : reading.current - reading.previous;
              const unit = reading.type === 'Ус' ? 'м³' : 'kWh';
              return (
                <div key={reading.id} className="rounded-xl border border-white/8 bg-black/15 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-cream text-xs">{reading.unit}</b>
                      <small className="block text-[10px] text-sand-500">{reading.resident}</small>
                    </div>
                    <Badge tone={statusMeta[reading.status].tone}>{statusMeta[reading.status].label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-sand-400">
                    <span className="inline-flex items-center gap-1">
                      {reading.type === 'Ус' ? <Droplets className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                      {reading.type}
                    </span>
                    <div>
                      <span className="block text-[10px] text-sand-500">Өмнөх: {number.format(reading.previous)} · Одоо: {reading.current === null ? '—' : number.format(reading.current)}</span>
                      <b className="block text-cream text-right mt-0.5">{usage === null ? '—' : `${number.format(usage)} ${unit}`}{reading.estimated && <small className="ml-1 text-[9px] text-amber-200">дундаж</small>}</b>
                    </div>
                  </div>
                  {reading.issue && <p className="text-[10px] text-red-200 border-t border-white/[.04] pt-2">{reading.issue}</p>}
                  <div className="flex justify-end gap-2 border-t border-white/[.04] pt-2.5">
                    {reading.status === 'approved' && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-200"><Check className="h-3.5 w-3.5" />Баталгаажсан</span>}
                    {reading.status === 'pending' && <Button size="sm" onClick={() => approveReading(reading)}><Check className="h-3.5 w-3.5" />Батлах</Button>}
                    {reading.status === 'flagged' && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openCorrection(reading)}><PencilLine className="h-3.5 w-3.5" />Засах</Button><Button size="sm" onClick={() => approveReading(reading)}>Батлах</Button></div>}
                    {reading.status === 'missing' && <Button size="sm" variant="outline" onClick={() => applyAverage(reading)}><Sparkles className="h-3.5 w-3.5" />Дундажлах</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex justify-between">
              <div><p className="text-[10px] font-bold tracking-[.18em] text-sand">{editingId ? 'CORRECT READING' : 'NEW READING'}</p><h2 className="mt-2 font-serif text-2xl text-cream">{editingId ? 'Заалт засах' : 'Заалт оруулах'}</h2></div>
              <button onClick={() => setIsDialogOpen(false)} aria-label="Цонх хаах" className="text-sand-400 hover:text-cream"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Айл<Input value={form.unit} onChange={(event) => setForm((value) => ({ ...value, unit: event.target.value }))} className="mt-2" placeholder="A-1203" disabled={Boolean(editingId)} /></label>
              <label className="block text-xs font-semibold text-sand-200">Тоолуурын төрөл<Input value={form.type} onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))} className="mt-2" placeholder="Цахилгаан" disabled={Boolean(editingId)} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-sand-200">Өмнөх заалт<Input value={form.previous} type="number" onChange={(event) => setForm((value) => ({ ...value, previous: event.target.value }))} className="mt-2" placeholder="12840" /></label><label className="block text-xs font-semibold text-sand-200">Шинэ заалт<Input value={form.current} type="number" onChange={(event) => setForm((value) => ({ ...value, current: event.target.value }))} className="mt-2" placeholder="13012" /></label></div>
              {invalidReading && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">Шинэ заалт өмнөх заалтаас бага байж болохгүй.</p>}
              {unusualUsage && <p className="flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Хэрэглээ {number.format(usage)} — дунджаас 50%+ өндөр байна. Зурагтай тулгаж шалгана уу.</p>}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sand/25 bg-sand/[.04] p-3 text-xs text-sand-300"><input type="file" accept="image/*" className="sr-only" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} /><span className="grid h-9 w-9 place-items-center rounded-lg bg-sand/10 text-sand"><Camera className="h-4 w-4" /></span><span><b className="block text-cream">Тоолуурын зураг</b><small className="text-sand-500">{proofFile?.name ?? 'Зураг сонгох (JPG/PNG)'}</small></span></label>
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Болих</Button><Button disabled={!form.unit.trim() || !form.previous || !form.current || invalidReading} onClick={saveReading}>{editingId ? 'Шинэчлэх' : 'Баталгаажуулах'}</Button></div>
          </div>
        </div>
      )}
      </section>
    </PageStateWrapper>
  );
}
