import { useState } from 'react';
import { Eye, EyeOff, Plus, Save } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

type Tariff = { id: number; name: string; unit: string; amount: string; scope: string; active: boolean };

const defaultTariffs: Tariff[] = [
  { id: 1, name: 'СӨХ үйлчилгээ', unit: 'Айл / сар', amount: '45,000', scope: 'Бүх байр', active: true },
  { id: 2, name: 'Зогсоол', unit: 'Машин / сар', amount: '80,000', scope: 'Ашиглагчид', active: true },
  { id: 3, name: 'Усны суурь төлбөр', unit: 'Айл / сар', amount: '12,000', scope: 'Бүх байр', active: true },
];

export default function SettingsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>(defaultTariffs);
  const [graceDays, setGraceDays] = useState('5');
  const [lateFee, setLateFee] = useState('0.2');
  const [penaltyEnabled, setPenaltyEnabled] = useState(true);
  const [transparentReport, setTransparentReport] = useState(true);
  const [showCollection, setShowCollection] = useState(true);
  const [showExpenseSummary, setShowExpenseSummary] = useState(true);
  const [showMaintenanceSummary, setShowMaintenanceSummary] = useState(false);
  const [notice, setNotice] = useState('');

  const addTariff = () => {
    setTariffs((current) => [...current, { id: Date.now(), name: 'Шинэ тариф', unit: 'Айл / сар', amount: '0', scope: 'Бүх байр', active: true }]);
  };

  const updateTariff = (id: number, update: Partial<Tariff>) => {
    setTariffs((current) => current.map((tariff) => tariff.id === id ? { ...tariff, ...update } : tariff));
  };

  const save = () => {
    setNotice('Тохиргоо хадгалагдлаа. Дараагийн нэхэмжлэлийн мөчлөгт шинэ дүрэм үйлчилнэ.');
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold tracking-[.18em] text-sand">WORKSPACE SETTINGS</p><h1 className="mt-2 font-serif text-3xl font-light text-cream">Тариф, дүрэм, ил тод байдал.</h1><p className="mt-2 max-w-2xl text-sm text-sand-400">Болд эндээс нэхэмжлэлийн үндсэн дүрэм болон оршин суугчдад нээх нэгтгэсэн тайлангаа удирдана.</p></div>
        <Button onClick={save}><Save className="h-4 w-4" />Өөрчлөлт хадгалах</Button>
      </div>

      {notice && <div className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100"><span>{notice}</span><button onClick={() => setNotice('')} className="text-emerald-100/70 hover:text-emerald-50">Хаах</button></div>}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <Card>
          <CardHeader><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">FR-2.1 · TARIFFS</p><h2 className="mt-1 font-serif text-xl text-cream">Тарифын төрлүүд</h2><p className="mt-1 text-xs text-sand-400">Тариф нь ирэх сарын нэхэмжлэлийн ноорогт ашиглагдана.</p></div><Button size="sm" variant="outline" onClick={addTariff}><Plus className="h-3.5 w-3.5" />Тариф нэмэх</Button></CardHeader>
          <CardContent className="space-y-3">
            {tariffs.map((tariff) => <div key={tariff.id} className="grid gap-3 rounded-xl border border-white/8 bg-white/[.025] p-4 md:grid-cols-[1.2fr_.9fr_.75fr_.9fr_auto] md:items-center"><Input value={tariff.name} onChange={(event) => updateTariff(tariff.id, { name: event.target.value })} aria-label="Тарифын нэр" /><Input value={tariff.unit} onChange={(event) => updateTariff(tariff.id, { unit: event.target.value })} aria-label="Нэгж" /><Input value={tariff.amount} onChange={(event) => updateTariff(tariff.id, { amount: event.target.value.replace(/[^0-9]/g, '') })} aria-label="Дүн" /><select value={tariff.scope} onChange={(event) => updateTariff(tariff.id, { scope: event.target.value })} className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-cream outline-none focus:border-sand"><option>Бүх байр</option><option>А байр</option><option>Б байр</option><option>Ашиглагчид</option></select><button type="button" onClick={() => updateTariff(tariff.id, { active: !tariff.active })} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${tariff.active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/5 text-sand-500'}`}>{tariff.active ? 'ИДЭВХТЭЙ' : 'ИДЭВХГҮЙ'}</button><p className="md:col-span-5 text-[10px] text-sand-500">₮{Number(tariff.amount || 0).toLocaleString()} · {tariff.unit} · {tariff.scope}</p></div>)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5"><p className="text-[10px] font-bold tracking-[.16em] text-sand">FR-2.4 · LATE FEE</p><h2 className="mt-2 font-serif text-xl text-cream">Алдангийн дүрэм</h2><p className="mt-2 text-xs leading-relaxed text-sand-400">Төлөх эцсийн өдрөөс хойш автоматаар тооцох дүрэм.</p><button onClick={() => setPenaltyEnabled((current) => !current)} className={`mt-5 flex w-full items-center justify-between rounded-xl border p-4 text-left ${penaltyEnabled ? 'border-sand/30 bg-sand/8' : 'border-white/8 bg-white/[.025]'}`}><span><b className="block text-xs text-cream">Алданги идэвхтэй</b><small className="mt-1 block text-[10px] text-sand-400">Invoice бүрт автоматаар үйлчилнэ.</small></span><span className={`h-5 w-9 rounded-full p-0.5 transition ${penaltyEnabled ? 'bg-sand' : 'bg-white/15'}`}><span className={`block h-4 w-4 rounded-full bg-onyx transition ${penaltyEnabled ? 'translate-x-4' : ''}`} /></span></button><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[11px] text-sand-300">Хөнгөлөлттэй хоног<Input value={graceDays} onChange={(event) => setGraceDays(event.target.value.replace(/[^0-9]/g, ''))} className="mt-2" suffix="хоног" disabled={!penaltyEnabled} /></label><label className="text-[11px] text-sand-300">Өдрийн алданги<Input value={lateFee} onChange={(event) => setLateFee(event.target.value.replace(/[^0-9.]/g, ''))} className="mt-2" suffix="%" disabled={!penaltyEnabled} /></label></div><div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-xs leading-relaxed text-amber-100">Жишээ: 5 хоногийн дараа өдөр бүр {lateFee || '0'}%-ийн алданги тооцно.</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><p className="text-[10px] font-bold tracking-[.16em] text-sand">FR-7.2 · TRANSPARENCY</p><h2 className="mt-1 font-serif text-xl text-cream">Оршин суугчдад нээх ил тод тайлан</h2><p className="mt-1 text-xs text-sand-400">Зөвхөн нэгтгэсэн мэдээлэл харагдана. Айлын өр, хувь хүний төлбөр огт харагдахгүй.</p></div><Badge tone={transparentReport ? 'success' : 'neutral'}>{transparentReport ? 'НЭЭЛТТЭЙ' : 'ХААЛТТАЙ'}</Badge></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_.75fr]"><div className="space-y-3">{[{ label: 'Сарын цуглуулалтын хувь', checked: showCollection, set: setShowCollection }, { label: 'Зардлын ангиллын нэгтгэл', checked: showExpenseSummary, set: setShowExpenseSummary }, { label: 'Засвар, үйлчилгээний сарын нэгтгэл', checked: showMaintenanceSummary, set: setShowMaintenanceSummary }].map((item) => <button key={item.label} type="button" onClick={() => item.set(!item.checked)} disabled={!transparentReport} className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[.025] p-4 text-left disabled:opacity-45"><span className="text-xs font-semibold text-cream">{item.label}</span><span className={`h-5 w-9 rounded-full p-0.5 ${item.checked ? 'bg-sand' : 'bg-white/15'}`}><span className={`block h-4 w-4 rounded-full bg-onyx transition ${item.checked ? 'translate-x-4' : ''}`} /></span></button>)}</div><div className="rounded-2xl border border-sand/15 bg-sand/[.04] p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/12 text-sand">{transparentReport ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}</span><h3 className="mt-4 font-serif text-xl text-cream">{transparentReport ? 'Resident portal-д нээлттэй' : 'Resident portal-д хаалттай'}</h3><p className="mt-2 text-xs leading-relaxed text-sand-400">Тайланг сар бүрийн 5-нд нийтэлнэ. Болд хүсвэл дараах хувийн тоймыг шууд хааж болно.</p><Button variant="outline" className="mt-5 w-full" onClick={() => setTransparentReport((current) => !current)}>{transparentReport ? <><EyeOff className="h-4 w-4" />Тайланг хаах</> : <><Eye className="h-4 w-4" />Тайланг нээх</>}</Button></div></CardContent>
      </Card>
    </section>
  );
}
