import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Search } from 'lucide-react';
import { getStoredToken } from '../services/authApi';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
const apiUrl = (path: string) => `${apiBaseUrl}${path}`;

type Tenant = { id: string; name: string; address?: string | null };
type Unit = {
  id: string;
  unitNumber: string;
  building?: { name?: string | null };
  entrance?: { name?: string | null };
  floor?: { floorNumber?: number | null };
};
type Membership = { status?: string };

function dataArray<T>(payload: unknown, key: string): T[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function apiMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function ResidentJoinPage() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [manualUnit, setManualUnit] = useState({ buildingName: '', entranceName: '', floorNumber: '', unitNumber: '' });
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantError, setTenantError] = useState('');
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [unitError, setUnitError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    let disposed = false;
    const checkMembership = async () => {
      try {
        const response = await fetch(apiUrl('/resident-memberships/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        const memberships = dataArray<Membership>(payload, 'memberships');
        if (!disposed && memberships.some((item) => item.status === 'ACTIVE')) {
          navigate('/resident', { replace: true });
        }
      } catch {
        // Нэгдэх хуудсыг үргэлжлүүлэн харуулна.
      }
    };

    void checkMembership();
    const timer = window.setInterval(checkMembership, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [navigate, token]);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    const timer = window.setTimeout(async () => {
      setLoadingTenants(true);
      setTenantError('');
      try {
        const load = async (search: string) => {
          const response = await fetch(apiUrl(`/resident-memberships/tenants?q=${encodeURIComponent(search)}`), {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload: unknown = await response.json();
          if (!response.ok) throw new Error(apiMessage(payload, 'СӨХ-ийн мэдээлэл авч чадсангүй.'));
          return dataArray<Tenant>(payload, 'tenants');
        };

        let rows = await load(query.trim());
        if (query.trim() && rows.length === 0) rows = await load('');
        if (disposed) return;
        setTenants(rows);
        setTenantId((current) =>
          rows.some((tenant) => tenant.id === current) ? current : rows.length === 1 ? rows[0].id : '',
        );
      } catch (error) {
        if (!disposed) setTenantError(error instanceof Error ? error.message : 'СӨХ-ийн мэдээлэл авч чадсангүй.');
      } finally {
        if (!disposed) setLoadingTenants(false);
      }
    }, 250);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [query, token]);

  useEffect(() => {
    setUnits([]);
    setUnitId('');
    setUnitsLoaded(false);
    setUnitError('');
    if (!tenantId || !token) return;

    let disposed = false;
    const loadUnits = async () => {
      try {
        const response = await fetch(apiUrl(`/resident-memberships/tenants/${tenantId}/units`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(apiMessage(payload, 'Тоотын мэдээлэл авч чадсангүй.'));
        const rows = dataArray<Unit>(payload, 'units');
        if (!disposed) {
          setUnits(rows);
          setUnitId(rows.length === 1 ? rows[0].id : '');
        }
      } catch (error) {
        if (!disposed) setUnitError(error instanceof Error ? error.message : 'Тоотын мэдээлэл авч чадсангүй.');
      } finally {
        if (!disposed) setUnitsLoaded(true);
      }
    };

    void loadUnits();
    return () => {
      disposed = true;
    };
  }, [tenantId, token]);

  const manualUnitComplete = useMemo(
    () =>
      unitsLoaded &&
      !unitError &&
      units.length === 0 &&
      Boolean(manualUnit.buildingName.trim() && manualUnit.floorNumber.trim() && manualUnit.unitNumber.trim()),
    [manualUnit, unitError, units.length, unitsLoaded],
  );
  const canSubmit = Boolean(tenantId && (unitId || manualUnitComplete));

  const submit = async () => {
    if (!token || !canSubmit) return;
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(apiUrl('/resident-memberships/requests'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...(unitId ? { unitId } : manualUnit),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, 'Нэгдэх хүсэлт илгээж чадсангүй.'));
      setMessage('Нэгдэх хүсэлт амжилттай илгээгдлээ. СӨХ-ийн баталгаажуулалтыг хүлээнэ үү.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Нэгдэх хүсэлт илгээж чадсангүй.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4efe7] px-5 py-16 text-[#25251f]">
      <section className="mx-auto max-w-4xl rounded-[36px] border border-[#ddd3c4] bg-[#fbf8f2] p-8 shadow-xl md:p-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ddd3c4] px-4 py-2 text-sm font-semibold transition hover:border-[#52745f] hover:text-[#52745f]"
          aria-label="Нүүр хуудас руу буцах"
        >
          <ArrowLeft size={18} /> Буцах
        </button>
        <p className="mb-3 text-sm font-bold tracking-[0.2em] text-[#52745f]">ОРШИН СУУГЧААР НЭГДЭХ</p>
        <h1 className="mb-9 font-serif text-4xl md:text-5xl">Өөрийн СӨХ, тоотоо сонгоно уу</h1>

        <label className="mb-2 flex items-center gap-2 font-semibold"><Search size={21} /> СӨХ хайх</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="СӨХ-ийн нэр эсвэл хаяг"
          className="mb-5 w-full rounded-2xl border border-[#d8d0c5] bg-white px-5 py-4 outline-none focus:border-[#52745f]"
        />

        {loadingTenants && <p className="mb-4 text-sm text-[#746e64]">СӨХ-ийн мэдээллийг уншиж байна...</p>}
        {tenantError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{tenantError}</p>}
        {!loadingTenants && !tenantError && tenants.length === 0 && (
          <p className="mb-4 text-sm text-[#746e64]">Идэвхтэй СӨХ олдсонгүй.</p>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {tenants.map((tenant) => (
            <button
              type="button"
              key={tenant.id}
              onClick={() => setTenantId(tenant.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                tenantId === tenant.id ? 'border-[#52745f] bg-[#eaf1ec]' : 'border-[#d8d0c5] bg-white hover:border-[#52745f]'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold"><Building2 size={20} />{tenant.name}</span>
              {tenant.address && <span className="mt-1 block text-sm text-[#746e64]">{tenant.address}</span>}
            </button>
          ))}
        </div>

        {tenantId && !unitsLoaded && <p className="mb-4 text-sm text-[#746e64]">Тоотын мэдээллийг уншиж байна...</p>}
        {unitError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{unitError}</p>}

        {tenantId && unitsLoaded && !unitError && units.length > 0 && (
          <label className="mb-6 block font-semibold">
            Байр / орц / давхар / тоот
            <select
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#d8d0c5] bg-white px-5 py-4"
            >
              <option value="">Сонгоно уу</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {[unit.building?.name, unit.entrance?.name, unit.floor?.floorNumber && `${unit.floor.floorNumber}-р давхар`, unit.unitNumber]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}

        {tenantId && unitsLoaded && !unitError && units.length === 0 && (
          <div className="mb-6 grid gap-3 md:grid-cols-2">
            {[
              ['buildingName', 'Байр'],
              ['entranceName', 'Орц'],
              ['floorNumber', 'Давхар'],
              ['unitNumber', 'Тоот'],
            ].map(([key, label]) => (
              <input
                key={key}
                value={manualUnit[key as keyof typeof manualUnit]}
                onChange={(event) => setManualUnit((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={label}
                className="rounded-2xl border border-[#d8d0c5] bg-white px-5 py-4"
              />
            ))}
          </div>
        )}

        {message && <p className="mb-4 rounded-xl bg-[#edf3ee] p-3 text-sm text-[#315d47]">{message}</p>}
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={submit}
          className="w-full rounded-2xl bg-[#315d47] px-5 py-4 font-bold text-white transition hover:bg-[#274d3b] disabled:cursor-not-allowed disabled:bg-[#dfceb0] disabled:text-[#88847e]"
        >
          {submitting ? 'Илгээж байна...' : 'Нэгдэх хүсэлт илгээх'}
        </button>
      </section>
    </main>
  );
}

export default ResidentJoinPage;
