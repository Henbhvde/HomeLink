import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, CheckCircle2, FileSpreadsheet, Filter, Search, Send, Trash2, Upload, UserPlus, Users, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { useBackendState } from '../hooks/useBackendState';
import { PageStateWrapper } from '../components/ui';
import { useUrlQueryState } from '../hooks/useUrlQueryState';
import { useAuth } from '../contexts/AuthContext';

type PersonType = 'Оршин суугч' | 'Нярав' | 'Ажилтан';
type PersonStatus = 'Идэвхтэй' | 'Идэвхгүй' | 'Урилга илгээсэн';
type PersonSort = 'name' | 'unit' | 'status';

type Person = {
  id: string;
  name: string;
  apartment: string;
  phone: string;
  email: string;
  type: PersonType;
  status: PersonStatus;
  initials: string;
};

type ImportRow = Pick<Person, 'name' | 'phone' | 'email' | 'apartment'> & { duplicate: boolean };
type MembershipRequest = { id: string; createdAt: string; requestedBuilding?: string; requestedEntrance?: string; requestedFloor?: number; requestedUnit?: string; user: { fullName: string; email: string; phone?: string }; unit?: { number: string; floor: { number: number; entrance: { name: string; building: { name: string } } } } };
type UnitOption = { id: string; number: string; floor: number; entrance: string; building: string };
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

const typeOptions: { type: PersonType; icon: typeof Users; detail: string }[] = [
  { type: 'Оршин суугч', icon: Users, detail: 'Байрлаж буй хэрэглэгч' },
  { type: 'Нярав', icon: Building2, detail: 'СӨХ-ийн нярав' },
  { type: 'Ажилтан', icon: UserPlus, detail: 'Менежер, үйлчилгээний баг' },
];

const emptyPersonDraft = { name: '', phone: '', email: '', apartment: '' };
const emptyInviteDraft = { name: '', phone: '', apartment: '', unitId: '' };

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || 'ШХ';
}

function statusTone(status: PersonStatus) {
  if (status === 'Идэвхтэй') return 'success' as const;
  if (status === 'Урилга илгээсэн') return 'info' as const;
  return 'neutral' as const;
}

function splitCsvRow(row: string) {
  return (row.match(/("[^"]*(?:""[^"]*)*"|[^,]*)/g) ?? []).filter((value, index, all) => value || index < all.length - 1).map((value) => value.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}

export default function ResidentsPage() {
  const { token, user } = useAuth();
  const [people, setPeople, status, reloadPeople] = useBackendState<Person[]>('manager-residents', []);
  const [activeType, setActiveType] = useUrlQueryState<PersonType>('type', 'Оршин суугч', ['Оршин суугч', 'Нярав', 'Ажилтан']);
  const [query, setQuery] = useUrlQueryState<string>('q', '');
  const [sort, setSort] = useUrlQueryState<PersonSort>('sort', 'name', ['name', 'unit', 'status']);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState(emptyPersonDraft);
  const [inviteDraft, setInviteDraft] = useState(emptyInviteDraft);
  const [fileName, setFileName] = useState('');
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [membershipRequests, setMembershipRequests] = useState<MembershipRequest[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);

  useEffect(() => {
    if (!isPersonDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isPersonDialogOpen]);

  const loadMembershipRequests = () => {
    if (!token) return;
    void fetch(`${apiBaseUrl}/resident-memberships/requests`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => setMembershipRequests(payload.data ?? [])).catch(() => setMembershipRequests([]));
  };
  useEffect(loadMembershipRequests, [token]);
  useEffect(() => {
    if (!token || !user?.workspace?.id) return;
    void fetch(`${apiBaseUrl}/resident-memberships/tenants/${user.workspace.id}/units`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => setUnitOptions(payload.data ?? [])).catch(() => setUnitOptions([]));
  }, [token, user?.workspace?.id]);

  const decideMembership = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    const response = await fetch(`${apiBaseUrl}/resident-memberships/requests/${id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) { setMembershipRequests((current) => current.filter((request) => request.id !== id)); if (action === 'approve') reloadPeople(); setNotice(action === 'approve' ? 'Оршин суугчийн хүсэлтийг баталлаа.' : 'Оршин суугчийн хүсэлтийг татгалзлаа.'); }
  };

  const filteredPeople = useMemo(
    () => people.filter((person) => person.type === activeType && `${person.name} ${person.apartment} ${person.phone} ${person.email}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (sort === 'unit' ? a.apartment.localeCompare(b.apartment) : sort === 'status' ? a.status.localeCompare(b.status) : a.name.localeCompare(b.name, 'mn'))),
    [activeType, people, query, sort],
  );

  const counts = useMemo(() => typeOptions.reduce<Record<PersonType, number>>((result, option) => {
    result[option.type] = people.filter((person) => person.type === option.type).length;
    return result;
  }, { 'Оршин суугч': 0, 'Нярав': 0, 'Ажилтан': 0 }), [people]);

  const pendingInvites = people.filter((person) => person.status === 'Урилга илгээсэн').length;
  const activeResidents = people.filter((person) => person.type === 'Оршин суугч' && person.status === 'Идэвхтэй').length;

  const closePersonDialog = () => {
    setIsPersonDialogOpen(false);
    setPersonDraft(emptyPersonDraft);
  };

  const closeImportDialog = () => {
    setIsImportOpen(false);
    setFileName('');
    setImportError(null);
    setImportPreview([]);
  };

  const previewCsv = async (file?: File) => {
    setFileName(file?.name ?? '');
    setImportPreview([]);
    setImportError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Preview харахын тулд CSV файл сонгоно уу.');
      return;
    }
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = splitCsvRow(lines[0] ?? '').map((header) => header.toLowerCase());
    const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const nameIndex = column('name', 'нэр');
    const phoneIndex = column('phone', 'утас');
    const apartmentIndex = column('apartment', 'unit', 'айлын дугаар', 'айл');
    const emailIndex = column('email', 'и-мэйл', 'имэйл');
    if ([nameIndex, phoneIndex, apartmentIndex].includes(-1)) {
      setImportError('CSV-д name, phone, apartment багана шаардлагатай.');
      return;
    }
    const knownPhones = new Set(people.map((person) => person.phone.replace(/\D/g, '')));
    const rows = lines.slice(1).map(splitCsvRow).filter((row) => row[nameIndex] && row[phoneIndex]).map((row) => {
      const phone = row[phoneIndex];
      const normalized = phone.replace(/\D/g, '');
      const duplicate = knownPhones.has(normalized);
      knownPhones.add(normalized);
      return { name: row[nameIndex], phone, apartment: row[apartmentIndex] || 'Тодруулаагүй', email: emailIndex >= 0 ? row[emailIndex] || '—' : '—', duplicate };
    });
    setImportPreview(rows);
    if (!rows.length) setImportError('Импортлох мөр олдсонгүй.');
  };

  const closeInviteDialog = () => {
    setIsInviteOpen(false);
    setInviteDraft(emptyInviteDraft);
    setInviteError(null);
  };

  const savePerson = async () => {
    if (!personDraft.name.trim() || !token) return;
    if (activeType === 'Ажилтан' && !personDraft.email.trim()) { setNotice('Ажилтны Gmail хаягийг оруулна уу.'); return; }
    setIsSavingPerson(true);
    try {
      if (activeType === 'Ажилтан') {
        const response = await fetch(`${apiBaseUrl}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: personDraft.email.trim(), ...(personDraft.phone.trim() ? { phone: personDraft.phone.trim() } : {}), role: 'staff' }) });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? 'Урилга илгээж чадсангүй.');
      }
      const person: Person = {
        id: `local-${Date.now()}`,
        name: personDraft.name.trim(),
        phone: personDraft.phone.trim() || '—',
        email: personDraft.email.trim() || '—',
        apartment: personDraft.apartment.trim() || (activeType === 'Ажилтан' ? 'Удирдлага' : 'Тодруулаагүй'),
        type: activeType,
        status: 'Урилга илгээсэн',
        initials: initialsFromName(personDraft.name),
      };
      setPeople((current) => [...current, person]);
      setNotice(activeType === 'Ажилтан' ? `${person.email} хаяг руу ажилтны урилга илгээлээ.` : `${person.name}-г ${activeType.toLowerCase()}аар нэмлээ.`);
      closePersonDialog();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Урилга илгээж чадсангүй.');
    } finally {
      setIsSavingPerson(false);
    }
  };

  const deleteInvite = async (person: Person) => {
    if (!token || deletingInviteId) return;
    setDeletingInviteId(person.id);
    try {
      const response = await fetch(`${apiBaseUrl}/invites/${encodeURIComponent(person.email)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Урилгыг устгаж чадсангүй.');
      setPeople((current) => current.filter((item) => item.id !== person.id));
      setNotice('Урилга устгагдлаа.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Урилгыг устгаж чадсангүй.');
    } finally {
      setDeletingInviteId(null);
    }
  };

  const importResidents = () => {
    if (!importPreview.length) {
      setImportError('Эхлээд зөв CSV файл сонгоно уу.');
      return;
    }

    setIsImporting(true);
    window.setTimeout(() => {
      const timestamp = Date.now();
      const imported: Person[] = importPreview.filter((row) => !row.duplicate).map((row, index) => ({ ...row, id: `import-${timestamp}-${index}`, type: 'Оршин суугч', status: 'Урилга илгээсэн', initials: initialsFromName(row.name) }));
      setPeople((current) => [...current, ...imported]);
      setActiveType('Оршин суугч');
      setNotice(`${fileName} файлаас ${imported.length} бүртгэлийг импортлож, урилга илгээх төлөвт орууллаа.`);
      setIsImporting(false);
      closeImportDialog();
    }, 800);
  };

  const sendInvite = async () => {
    if (!token || !inviteDraft.phone.trim() || !inviteDraft.unitId) {
      setInviteError('Утасны дугаар болон байр, тоотыг сонгоно уу.');
      return;
    }

    setIsSendingInvite(true);
    try {
      const response = await fetch(`${apiBaseUrl}/invites`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: inviteDraft.phone.trim(), role: 'resident', unitId: inviteDraft.unitId }) });
      const payload = await response.json();
      if (!response.ok) { setInviteError(payload.message ?? 'Урилга илгээж чадсангүй.'); return; }
      const normalizedPhone = inviteDraft.phone.replace(/\D/g, '');
      const selectedUnit = unitOptions.find((unit) => unit.id === inviteDraft.unitId);
      const apartmentLabel = selectedUnit ? `${selectedUnit.building} · ${selectedUnit.entrance} · ${selectedUnit.number}` : inviteDraft.apartment;
      let recipientName = inviteDraft.name.trim() || 'Шинэ оршин суугч';
      setPeople((current) => {
        const existing = current.find((person) => person.phone.replace(/\D/g, '') === normalizedPhone);
        if (existing) {
          recipientName = existing.name;
          return current.map((person) => person.id === existing.id ? { ...person, status: 'Урилга илгээсэн', apartment: apartmentLabel || person.apartment } : person);
        }
        return [...current, {
          id: String(payload.data.id),
          name: recipientName,
          apartment: apartmentLabel,
          phone: inviteDraft.phone.trim(),
          email: '—',
          type: 'Оршин суугч',
          status: 'Урилга илгээсэн',
          initials: initialsFromName(recipientName),
        }];
      });
      setActiveType('Оршин суугч');
      setNotice(`${inviteDraft.phone.trim()} дугаарт ${apartmentLabel} айлын урилга илгээлээ.`);
      closeInviteDialog();
    } finally { setIsSendingInvite(false); }
  };

  return (
    <section>
      <PageStateWrapper status={status}>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[.18em] text-sand">PEOPLE DIRECTORY</p>
            <h1 className="mt-2 font-serif text-3xl font-light text-cream">Хүмүүс.</h1>
            <p className="mt-2 text-sm text-sand-400">Айлуудаа Excel-ээр оруулж, оршин суугчдыг утсаар уриад бүртгэлийн явцыг хянаарай.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}><FileSpreadsheet className="h-4 w-4" />Excel-ээс импортлох</Button>
            <Button onClick={() => setIsPersonDialogOpen(true)}><UserPlus className="h-4 w-4" />{activeType} нэмэх</Button>
          </div>
        </div>

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-sand/15 bg-sand/[.06] px-4 py-3 text-xs text-sand-300">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-sand" />{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-sand/15 bg-white/[.025] p-5">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.15em] text-sand">MEMBERSHIP REQUESTS</p><h2 className="mt-1 font-serif text-xl text-cream">Оршин суугчийн хүсэлтүүд</h2></div><Badge tone={membershipRequests.length ? 'warning' : 'neutral'}>{membershipRequests.length}</Badge></div>
          {membershipRequests.length === 0 ? <p className="mt-4 text-xs text-sand-500">Баталгаажуулах хүсэлт алга.</p> : <div className="mt-4 space-y-3">{membershipRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><b className="text-sm text-cream">{request.user.fullName}</b><p className="mt-1 text-xs text-sand-400">{request.user.phone ?? 'Утасгүй'} · {request.user.email}</p><p className="mt-1 text-xs text-sand-300">{request.unit ? `${request.unit.floor.entrance.building.name} · ${request.unit.floor.entrance.name} орц · ${request.unit.floor.number} давхар · ${request.unit.number} тоот` : request.requestedBuilding ? `${request.requestedBuilding} · ${request.requestedEntrance} орц · ${request.requestedFloor} давхар · ${request.requestedUnit} тоот` : 'Тоот сонгоогүй'} · {new Date(request.createdAt).toLocaleDateString('mn-MN')}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => decideMembership(request.id, 'reject')}>Reject</Button><Button onClick={() => decideMembership(request.id, 'approve')}>Approve</Button></div></div>)}</div>}
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1.5 border-b border-white/7 pb-px">
            {typeOptions.map((option) => {
              const active = activeType === option.type;
              return (
                <button
                  key={option.type}
                  onClick={() => setActiveType(option.type)}
                  className={`relative px-4 py-2.5 text-xs font-semibold transition ${active ? 'text-sand' : 'text-sand-500 hover:text-sand-300'}`}
                >
                  <span className="flex items-center gap-2">
                    <option.icon className="h-3.5 w-3.5" />
                    {option.type}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? 'bg-sand/15 text-sand' : 'bg-white/5 text-sand-500'}`}>{counts[option.type]}</span>
                  </span>
                  {active && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-sand" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-5 text-xs">
            <span className="text-sand-400">Идэвхтэй оршин суугч: <b className="text-cream">{activeResidents}</b></span>
            <span className="text-sand-400">Илгээсэн урилга: <b className="text-cream">{pendingInvites}</b></span>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 p-4">
              <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Нэр, айл, утсаар хайх..." /></div>
              <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" /><select aria-label="Эрэмбэлэх" value={sort} onChange={(event) => setSort(event.target.value as PersonSort)} className="h-10 appearance-none rounded-xl border border-white/10 bg-black/20 pl-9 pr-8 text-xs font-semibold text-sand-300"><option value="name">Нэрээр</option><option value="unit">Айлаар</option><option value="status">Төлвөөр</option></select></label>
            </div>
            {filteredPeople.length === 0 ? (
              <div className="p-5"><EmptyState icon={Search} title="Илэрц олдсонгүй" description="Өөр хайлтын үг оруулж эсвэл сонгосон ангиллаа өөрчилнө үү." action={<Button variant="outline" size="sm" onClick={() => setQuery('')}>Цэвэрлэх</Button>} /></div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left"><thead className="border-b border-white/7 bg-white/[.02] text-[10px] font-bold tracking-[.12em] text-sand-500"><tr><th className="px-5 py-3">НЭР</th><th className="px-5 py-3">БАЙР / ҮҮРЭГ</th><th className="px-5 py-3">ХОЛБОО БАРИХ</th><th className="px-5 py-3">ТӨЛӨВ</th><th className="px-5 py-3" /></tr></thead><tbody>{filteredPeople.map((person) => <tr key={person.id} className="border-b border-white/[.06] text-xs transition-colors hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-sand/12 text-[10px] font-bold text-sand">{person.initials}</span><div><b className="block text-cream">{person.name}</b><small className="text-[10px] text-sand-500">ID · {person.id.slice(-4).padStart(4, '0')}</small></div></div></td><td className="px-5 py-4 text-sand-300">{person.apartment}</td><td className="px-5 py-4"><span className="block text-sand-300">{person.phone}</span><small className="text-[10px] text-sand-500">{person.email}</small></td><td className="px-5 py-4"><Badge tone={statusTone(person.status)}>{person.status}</Badge></td><td className="px-5 py-4 text-right">{person.status === 'Урилга илгээсэн' ? <button type="button" disabled={deletingInviteId === person.id} onClick={() => void deleteInvite(person)} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-red-300/20 text-red-300 transition hover:bg-red-400/10 disabled:opacity-40" aria-label="Урилга устгах"><Trash2 className="h-4 w-4" /></button> : null}</td></tr>)}</tbody></table>
                </div>
                <div className="divide-y divide-white/7 md:hidden">{filteredPeople.map((person) => <div key={person.id} className="p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-sand/12 text-[10px] font-bold text-sand">{person.initials}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="text-xs text-cream">{person.name}</b><div className="flex items-center gap-2"><Badge tone={statusTone(person.status)}>{person.status}</Badge>{person.status === 'Урилга илгээсэн' && <button type="button" disabled={deletingInviteId === person.id} onClick={() => void deleteInvite(person)} className="text-red-300 disabled:opacity-40" aria-label="Урилга устгах"><Trash2 className="h-4 w-4" /></button>}</div></div><p className="mt-1 text-[11px] text-sand-400">{person.apartment} · {person.phone}</p></div></div></div>)}</div>
                <div className="flex items-center justify-between p-4 text-xs text-sand-400"><span>Нийт {filteredPeople.length} илэрц</span><span>{activeType}</span></div>
              </>
            )}
          </CardContent>
        </Card>

        {isPersonDialogOpen && createPortal((
          <div className="resident-person-modal-root fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/75 p-3 backdrop-blur-sm sm:p-4">
            <div className="resident-person-modal-panel max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-4 shadow-2xl sm:p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-[10px] font-bold tracking-[.18em] text-sand">NEW PERSON</p><h2 className="mt-1 font-serif text-2xl text-cream">{activeType} нэмэх</h2></div>
                <button type="button" onClick={closePersonDialog} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-sand-200">Бүтэн нэр<Input value={personDraft.name} onChange={(event) => setPersonDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10" placeholder="Бат-Эрдэнэ" /></label>
                <label className="block text-xs font-semibold text-sand-200">Утас<Input value={personDraft.phone} onChange={(event) => setPersonDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-1.5 h-10" placeholder="9911-2233" /></label>
                <label className="block text-xs font-semibold text-sand-200">И-мэйл<Input type="email" value={personDraft.email} onChange={(event) => setPersonDraft((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 h-10" placeholder="name@email.mn" /></label>
                <label className="block text-xs font-semibold text-sand-200">Айл / үүрэг<Input value={personDraft.apartment} onChange={(event) => setPersonDraft((current) => ({ ...current, apartment: event.target.value }))} className="mt-1.5 h-10" placeholder={activeType === 'Ажилтан' ? 'Менежер' : 'A-1203'} /></label>
              </div>
              <div className="mt-5 flex justify-end gap-3"><Button variant="ghost" onClick={closePersonDialog}>Болих</Button><Button disabled={!personDraft.name.trim()} loading={isSavingPerson} onClick={savePerson}>Хадгалах</Button></div>
            </div>
          </div>
        ), document.body)}

        {isImportOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
              <div className="flex justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">RESIDENT IMPORT</p><h2 className="mt-2 font-serif text-2xl text-cream">CSV импорт</h2><p className="mt-1 text-sm text-sand-400">name, phone, apartment баганатай файл сонгоно уу.</p></div><button type="button" onClick={closeImportDialog} aria-label="Хаах"><X className="h-5 w-5" /></button></div>
              <label htmlFor="resident-file" className="mt-6 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-sand/30 p-6 text-center"><input id="resident-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void previewCsv(event.target.files?.[0])} /><Upload className="h-6 w-6 text-sand" /><b className="mt-2 text-sm">{fileName || 'CSV файл сонгох'}</b></label>
              {importError && <p className="mt-3 text-xs text-red-300">{importError}</p>}
              {importPreview.length > 0 && <div className="mt-4"><div className="flex justify-between text-xs text-sand-400"><span>{importPreview.length} мөр</span><span className="text-amber-300">{importPreview.filter((row) => row.duplicate).length} давхардал</span></div><div className="mt-2 overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-xs"><thead className="bg-white/5 text-sand-500"><tr><th className="p-3">Нэр</th><th className="p-3">Утас</th><th className="p-3">Айл</th><th className="p-3">Төлөв</th></tr></thead><tbody>{importPreview.slice(0, 5).map((row, index) => <tr key={`${row.phone}-${index}`} className="border-t border-white/7"><td className="p-3">{row.name}</td><td className="p-3">{row.phone}</td><td className="p-3">{row.apartment}</td><td className={`p-3 ${row.duplicate ? 'text-amber-300' : 'text-emerald-300'}`}>{row.duplicate ? 'Давхардсан — алгасана' : 'Урилга илгээнэ'}</td></tr>)}</tbody></table></div></div>}
              <div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={closeImportDialog}>Болих</Button><Button disabled={!importPreview.some((row) => !row.duplicate)} loading={isImporting} onClick={importResidents}><FileSpreadsheet className="h-4 w-4" />Импорт хийх</Button></div>
            </div>
          </div>
        )}

        {isInviteOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">PHONE INVITATION</p><h2 className="mt-2 font-serif text-2xl text-cream">Оршин суугч урих</h2><p className="mt-1 text-sm text-sand-400">Утасны дугаарт нэвтрэх урилга илгээнэ.</p></div><button type="button" onClick={closeInviteDialog} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><label className="block text-xs font-semibold text-sand-200">Нэр (сонголтоор)<Input value={inviteDraft.name} onChange={(event) => setInviteDraft((current) => ({ ...current, name: event.target.value }))} className="mt-2" placeholder="Бат-Эрдэнэ" /></label><label className="block text-xs font-semibold text-sand-200">Утасны дугаар<Input value={inviteDraft.phone} onChange={(event) => { setInviteDraft((current) => ({ ...current, phone: event.target.value })); setInviteError(null); }} className="mt-2" placeholder="9911-2233" /></label><label className="block text-xs font-semibold text-sand-200">Байр / орц / давхар / тоот<select value={inviteDraft.unitId} onChange={(event) => { setInviteDraft((current) => ({ ...current, unitId: event.target.value })); setInviteError(null); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211f1c] px-3 py-3 text-xs text-cream"><option value="">Сонгоно уу</option>{unitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.building} · {unit.entrance} орц · {unit.floor} давхар · {unit.number} тоот</option>)}</select></label>{inviteError && <p className="text-xs text-red-300">{inviteError}</p>}<div className="rounded-xl border border-sand/15 bg-sand/[.06] px-3 py-2.5 text-xs leading-5 text-sand-300">Урилгыг хүлээн авмагц гишүүнчлэл шууд идэвхжинэ.</div></div><div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={closeInviteDialog}>Болих</Button><Button loading={isSendingInvite} onClick={sendInvite}><Send className="h-4 w-4" />Урилга илгээх</Button></div></div></div>
        )}
      </PageStateWrapper>
    </section>
  );
}
