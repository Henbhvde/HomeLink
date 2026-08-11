import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
type Tenant = { id: string; name: string; slug: string; address?: string | null };
type Unit = { id: string; number: string; floor: number; entrance: string; building: string };
type Membership = { id: string; status: 'invited' | 'pending' | 'active' | 'inactive' | 'rejected' };

export default function ResidentJoinPage() {
  const { token, user, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [manualUnit, setManualUnit] = useState({ building: '', entrance: '', floor: '', unit: '' });
  const [pending, setPending] = useState(false);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    const checkMembership = () => void fetch(`${apiBaseUrl}/resident-memberships/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json()).then((payload) => {
        if (disposed) return;
        const memberships = (payload.data ?? []) as Membership[];
        setPending(memberships.some((membership) => membership.status === 'pending'));
        const active = memberships.some((membership) => membership.status === 'active');
        setHasActiveMembership(active);
        if (active && user?.role !== 'resident') window.location.replace('/resident');
      })
      .catch(() => undefined);
    checkMembership();
    const timer = window.setInterval(checkMembership, 3000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [token, user?.role]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void fetch(`${apiBaseUrl}/resident-memberships/tenants?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => setTenants(payload.data ?? [])).catch(() => setTenants([])), 250);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  useEffect(() => {
    if (!token || !tenantId) { setUnits([]); return; }
    void fetch(`${apiBaseUrl}/resident-memberships/tenants/${tenantId}/units`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => setUnits(payload.data ?? [])).catch(() => setUnits([]));
  }, [tenantId, token]);

  if (!isAuthenticated) return <Navigate to="/register" replace />;
  if (user?.role === 'resident' && hasActiveMembership) return <Navigate to="/resident" replace />;

  const submit = async () => {
    const hasManualUnit = units.length === 0 && manualUnit.building && manualUnit.entrance && manualUnit.floor && manualUnit.unit;
    if (!token || !tenantId || (!unitId && !hasManualUnit)) return;
    setMessage('');
    const response = await fetch(`${apiBaseUrl}/resident-memberships/requests`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(unitId ? { tenantId, unitId } : { tenantId, ...manualUnit }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.message ?? 'Хүсэлт илгээж чадсангүй.'); return; }
    setPending(true);
  };

  return <main className="grid min-h-screen place-items-center bg-[#f3eee6] p-5 text-[#20251f]">
    <section className="w-full max-w-2xl rounded-[28px] border border-[#d7cfc2] bg-[#fbf8f2] p-7 shadow-xl sm:p-10">
      {pending ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-[#315d49]" /><h1 className="mt-5 font-serif text-3xl">Баталгаажуулалт хүлээж байна</h1><p className="mt-3 text-sm text-[#687168]">СӨХ-ийн менежер таны байр, тоотыг шалгаж баталгаажуулсны дараа resident dashboard нээгдэнэ.</p></div> : <>
        <p className="text-xs font-bold tracking-[.16em] text-[#607964]">ОРШИН СУУГЧААР НЭГДЭХ</p><h1 className="mt-2 font-serif text-3xl">Өөрийн СӨХ, тоотоо сонгоно уу</h1>
        <label className="mt-7 block text-xs font-bold"><span className="mb-2 flex items-center gap-2"><Search className="h-4 w-4" />СӨХ хайх</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="СӨХ-ийн нэр эсвэл хаяг" /></label>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{tenants.map((tenant) => <button key={tenant.id} onClick={() => { setTenantId(tenant.id); setUnitId(''); }} className={`rounded-xl border p-3 text-left text-sm ${tenantId === tenant.id ? 'border-[#315d49] bg-[#edf3ee]' : 'border-[#d8d0c5] bg-white'}`}><span><Building2 className="mr-2 inline h-4 w-4" />{tenant.name}</span>{tenant.address && <span className="mt-1 block pl-6 text-xs text-[#687168]">{tenant.address}</span>}</button>)}</div>
        {tenantId && units.length > 0 && <label className="mt-5 block text-xs font-bold">Байр / орц / давхар / тоот<select value={unitId} onChange={(event) => setUnitId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-3 py-3 text-sm"><option value="">Сонгоно уу</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.building} · {unit.entrance} орц · {unit.floor} давхар · {unit.number} тоот</option>)}</select></label>}
        {tenantId && units.length === 0 && <div className="mt-5"><p className="text-xs font-bold">Байр / орц / давхар / тоот</p><p className="mt-1 text-xs text-[#687168]">Энэ СӨХ тоотын жагсаалт оруулаагүй байна. Мэдээллээ гараар оруулна уу.</p><div className="mt-3 grid grid-cols-2 gap-3">{([['building', 'Байр'], ['entrance', 'Орц'], ['floor', 'Давхар'], ['unit', 'Тоот']] as const).map(([field, label]) => <input key={field} type={field === 'floor' ? 'number' : 'text'} value={manualUnit[field]} onChange={(event) => setManualUnit((current) => ({ ...current, [field]: event.target.value }))} placeholder={label} className="rounded-xl border border-[#d8d0c5] bg-white px-3 py-3 text-sm outline-none focus:border-[#315d49]" />)}</div></div>}
        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}<Button disabled={!tenantId || (!unitId && !(units.length === 0 && manualUnit.building && manualUnit.entrance && manualUnit.floor && manualUnit.unit))} onClick={submit} className="mt-6 w-full">Нэгдэх хүсэлт илгээх</Button>
      </>}
    </section>
  </main>;
}
