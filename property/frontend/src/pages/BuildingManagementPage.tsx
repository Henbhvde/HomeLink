import { useEffect, useMemo, useState } from 'react';
import { useBackendState } from '../hooks/useBackendState';
import { Building2, CheckCircle2, ChevronRight, DoorOpen, Layers3, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';
import { useUrlQueryState } from '../hooks/useUrlQueryState';
import { useAuth } from '../contexts/AuthContext';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

type StructureLevel = 'Барилга' | 'Орц' | 'Давхар' | 'Айл';
type BuildingStatus = 'Идэвхтэй' | 'Тохиргоо дутуу';

type Building = {
  id: string;
  name: string;
  code: string;
  entrances: number;
  floors: number;
  apartments: number;
  detail: string;
  status: BuildingStatus;
  entranceDetails?: Array<{
    id: string;
    name: string;
    floors: Array<{ id: string; number: number; units: Array<{ id: string; number: string; status: string; resident?: string }> }>;
  }>;
};

type StructureItem = {
  id: string;
  name: string;
  subtitle: string;
  detail: string;
  count: number;
  status: BuildingStatus;
  buildingId: string;
  entrance?: number;
  floor?: number;
};

const initialBuildings: Building[] = [];

const levels: StructureLevel[] = ['Барилга', 'Орц', 'Давхар', 'Айл'];

const emptyDraft = {
  name: '',
  code: '',
  entrances: '1',
  floors: '1',
  apartments: '',
};

function toPositiveNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function BuildingManagementPage() {
  const { token } = useAuth();
  const [buildings, setBuildings, status, retry] = useBackendState<Building[]>('manager-buildings', initialBuildings);
  const [view, setView] = useUrlQueryState<StructureLevel>('level', 'Барилга', levels);
  const [query, setQuery] = useUrlQueryState<string>('q', '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedEntrance, setSelectedEntrance] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  useEffect(() => {
    if (view !== 'Барилга' && !selectedBuildingId) {
      setView('Барилга');
    }
  }, [selectedBuildingId, setView, view]);

  const structureItems = useMemo<StructureItem[]>(() => {
    if (view === 'Барилга') {
      return buildings.map((building) => ({
        id: building.id,
        name: building.name,
        subtitle: `${building.entrances} орц · ${building.floors} давхар · ${building.apartments} айл`,
        detail: building.detail,
        count: building.apartments,
        status: building.status,
        buildingId: building.id,
      }));
    }

    const scopedBuildings = selectedBuildingId ? buildings.filter((building) => building.id === selectedBuildingId) : [];
    if (view === 'Орц') {
      return scopedBuildings.flatMap((building) => (building.entranceDetails ?? []).map((entrance, index) => ({
        id: entrance.id,
        name: `${building.name} · ${entrance.name}-р орц`,
        subtitle: `${entrance.floors.length} давхар · ${entrance.floors.reduce((sum, floor) => sum + floor.units.length, 0)} айл`,
        detail: building.detail,
        count: entrance.floors.reduce((sum, floor) => sum + floor.units.length, 0),
        status: building.status,
        buildingId: building.id,
        entrance: Number(entrance.name) || index + 1,
      })));
    }

    if (view === 'Давхар') {
      return scopedBuildings.flatMap((building) => {
        const entrance = building.entranceDetails?.find((entry) => (Number(entry.name) || 1) === (selectedEntrance ?? 1));
        if (entrance) return entrance.floors.map((floor) => ({
          id: floor.id,
          name: `${floor.number}-р давхар`,
          subtitle: `${building.name} · ${selectedEntrance ?? 1}-р орц`,
          detail: `${floor.units.length} айл`,
          count: floor.units.length,
          status: building.status,
          buildingId: building.id,
          entrance: selectedEntrance ?? 1,
          floor: floor.number,
        }));
        return [];
      });
    }

    return scopedBuildings.flatMap((building) => {
      const entrance = building.entranceDetails?.find((entry) => (Number(entry.name) || 1) === (selectedEntrance ?? 1));
      const floor = entrance?.floors.find((entry) => entry.number === (selectedFloor ?? 1));
      if (floor) return floor.units.map((unit) => ({
        id: unit.id,
        name: unit.number,
        subtitle: `${building.name} · ${selectedEntrance ?? 1}-р орц · ${selectedFloor ?? 1}-р давхар`,
        detail: unit.resident || 'Бүртгэлтэй оршин суугч',
        count: 1,
        status: building.status,
        buildingId: building.id,
        entrance: selectedEntrance ?? 1,
        floor: selectedFloor ?? 1,
      }));
      return [];
    });
  }, [buildings, selectedBuildingId, selectedEntrance, selectedFloor, view]);

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);

  const selectItem = (item: StructureItem) => {
    setQuery('');
    if (view === 'Барилга') { setSelectedBuildingId(item.buildingId); setSelectedEntrance(null); setSelectedFloor(null); setView('Орц'); }
    else if (view === 'Орц') { setSelectedEntrance(item.entrance ?? 1); setSelectedFloor(null); setView('Давхар'); }
    else if (view === 'Давхар') { setSelectedFloor(item.floor ?? 1); setView('Айл'); }
  };

  const goToLevel = (level: StructureLevel) => {
    if (level === 'Барилга') { setSelectedBuildingId(null); setSelectedEntrance(null); setSelectedFloor(null); }
    if (level === 'Орц') { setSelectedEntrance(null); setSelectedFloor(null); }
    if (level === 'Давхар') {
      if (!selectedBuildingId && buildings[0]) setSelectedBuildingId(buildings[0].id);
      if (!selectedEntrance) setSelectedEntrance(1);
      setSelectedFloor(null);
    }
    if (level === 'Айл') {
      if (!selectedBuildingId && buildings[0]) setSelectedBuildingId(buildings[0].id);
      if (!selectedEntrance) setSelectedEntrance(1);
      if (!selectedFloor) setSelectedFloor(1);
    }
    setQuery('');
    setView(level);
  };

  const filteredItems = useMemo(
    () => structureItems.filter((item) => `${item.name} ${item.subtitle} ${item.detail}`.toLowerCase().includes(query.toLowerCase())),
    [query, structureItems],
  );

  const totalApartments = buildings.reduce((total, building) => total + building.apartments, 0);
  const totalEntrances = buildings.reduce((total, building) => total + building.entrances, 0);
  const EntityIcon = view === 'Барилга' ? Building2 : view === 'Орц' ? DoorOpen : Layers3;

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBuildingId(null);
    setDraft(emptyDraft);
  };

  const editBuilding = (building: Building) => {
    setEditingBuildingId(building.id);
    setDraft({
      name: building.name,
      code: building.code,
      entrances: String(building.entrances || 1),
      floors: String(building.floors || 1),
      apartments: String(building.apartments || 1),
    });
    setIsDialogOpen(true);
  };

  const deleteBuilding = async (buildingId: string, buildingName: string) => {
    if (!window.confirm(`${buildingName}-г устгах уу?`)) return;
    const response = await fetch(`${apiBase}/buildings/${buildingId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      setNotice('Барилгыг устгаж чадсангүй.');
      return;
    }
    setBuildings((current) => current.filter((building) => building.id !== buildingId));
  };

  const saveStructure = () => {
    if (!draft.name.trim()) return;

    setIsSaving(true);
    window.setTimeout(() => {
      const entrances = toPositiveNumber(draft.entrances, 1);
      const floors = toPositiveNumber(draft.floors, 1);
      const apartments = toPositiveNumber(draft.apartments, entrances * floors);
      const code = draft.code.trim().toUpperCase() || String.fromCharCode(65 + buildings.length);
      if (editingBuildingId) {
        setBuildings((current) => current.map((building) => building.id === editingBuildingId ? {
          ...building,
          name: draft.name.trim(),
          entrances,
          floors,
          apartments,
        } : building));
        setNotice(`${draft.name.trim()} барилгын бүтэц шинэчлэгдлээ.`);
        setIsSaving(false);
        closeDialog();
        return;
      }
      const newBuilding: Building = {
        id: `${code}-${Date.now()}`,
        name: draft.name.trim(),
        code,
        entrances,
        floors,
        apartments,
        detail: 'Шинээр үүсгэсэн блок',
        status: 'Идэвхтэй',
      };

      setBuildings((current) => [...current, newBuilding]);
      setNotice(`${newBuilding.name}: ${entrances} орц, ${floors} давхар, ${apartments} айлтай бүтэц үүслээ.`);
      setIsSaving(false);
      closeDialog();
    }, 650);
  };

  return (
    <PageStateWrapper
      status={status}
      isEmpty={buildings.length === 0}
      onRetry={retry}
      emptyIcon={Building2}
      emptyTitle="Одоогоор барилга алга"
      emptyDescription="Шинэ бүтэц үүсгээд барилга, орц, давхар, айлын hierarchy-ээ удирдаж эхлүүлээрэй."
      emptyAction={<Button onClick={() => setIsDialogOpen(true)}>Бүтэц үүсгэх</Button>}
    >
      <section>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">PROPERTY STRUCTURE</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Барилга, байр.</h1>
          <p className="mt-2 text-sm text-sand-400">Хотхоны барилга, орц, давхар, айлын бүтцийг нэг газраас үүсгэж удирдана.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4" />Бүтэц үүсгэх</Button>
      </div>

      {notice && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-100/70 transition hover:text-emerald-50" aria-label="Мэдэгдлийг хаах"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Card className="mb-5 overflow-hidden">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-sand">SETUP FLOW</p>
            <h2 className="mt-2 font-serif text-2xl text-cream">Бүтцээ нэг удаа зөв тохируулна.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sand-400">Барилга үүсгэхэд орц, давхар, айлын тоо хамт бүртгэгдэнэ. Дараа нь айлуудаа Excel-ээр оруулж, оршин суугчдад урилга илгээнэ.</p>
          </div>
          <div className="flex min-h-20 items-center justify-center lg:justify-self-center">
            <div className="flex flex-wrap items-center justify-center gap-y-2 text-center text-sm font-semibold text-sand-200">
              {levels.map((level, index) => (
                <span key={level} className="inline-flex items-center gap-3 px-2">
                  <span>{level}</span>
                  {index < levels.length - 1 && <ChevronRight className="h-4 w-4 text-sand-500" />}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#121211]/55 p-3 sm:flex-row sm:items-center lg:relative lg:min-h-16">
        <div className="flex flex-wrap justify-center gap-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          {levels.map((item) => (
            <button key={item} type="button" onClick={() => goToLevel(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${view === item ? 'bg-sand text-onyx' : 'text-sand-400 hover:text-cream'}`}>{item}</button>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder={`${view} хайх...`} />
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-sand-300 transition hover:bg-white/5" aria-label="Шүүлтүүр"><SlidersHorizontal className="h-4 w-4" /></button>
        </div>
      </div>

      <nav aria-label="Барилгын бүтэц" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-sand-400">
        <button onClick={() => goToLevel('Барилга')} className="hover:text-cream">Барилга</button>
        {selectedBuilding && <><ChevronRight className="h-3.5 w-3.5" /><button onClick={() => goToLevel('Орц')} className="text-sand hover:text-cream">{selectedBuilding.name}</button></>}
        {selectedEntrance && <><ChevronRight className="h-3.5 w-3.5" /><button onClick={() => goToLevel('Давхар')} className="text-sand hover:text-cream">{selectedEntrance}-р орц</button></>}
        {selectedFloor && <><ChevronRight className="h-3.5 w-3.5" /><span className="text-cream">{selectedFloor}-р давхар</span></>}
      </nav>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Нийт барилга', value: String(buildings.length), note: `${totalEntrances} орцтой` },
          { label: 'Нийт айл', value: String(totalApartments), note: 'Бүтэц дээр бүртгэгдсэн' },
          { label: 'Тохиргоо бүрэн', value: `${Math.round((buildings.filter((building) => building.status === 'Идэвхтэй').length / buildings.length) * 100)}%`, note: 'Барилгын бэлэн байдал' },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div><p className="text-[11px] text-sand-400">{metric.label}</p><b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{metric.value}</b><small className="mt-1 block text-[10px] text-sand-500">{metric.note}</small></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/10 text-sand"><EntityIcon className="h-4 w-4" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState icon={Search} title="Илэрц олдсонгүй" description="Хайлтын үгээ өөрчилж эсвэл шүүлтүүрээ цэвэрлээд дахин оролдоорой." action={<Button variant="outline" size="sm" onClick={() => setQuery('')}>Хайлтыг цэвэрлэх</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <div key={item.id} role={view === 'Айл' ? undefined : 'button'} tabIndex={view === 'Айл' ? undefined : 0} onClick={() => view !== 'Айл' && selectItem(item)} onKeyDown={(event) => { if (view !== 'Айл' && (event.key === 'Enter' || event.key === ' ')) selectItem(item); }} className="text-left">
            <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-sand/25">
              <CardContent className="p-5">
                <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-sand/12 text-sand"><EntityIcon className="h-5 w-5" /></span><span className="flex items-center gap-2"><Badge tone={item.status === 'Идэвхтэй' ? 'success' : 'warning'}>{item.status}</Badge>{view === 'Барилга' && <><button type="button" aria-label={`${item.name} засах`} onClick={(event) => { event.stopPropagation(); const building = buildings.find((entry) => entry.id === item.buildingId); if (building) editBuilding(building); }} className="grid h-9 w-9 place-items-center rounded-lg border border-sand/25 text-sand transition hover:bg-sand/10"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`${item.name} устгах`} onClick={(event) => { event.stopPropagation(); void deleteBuilding(item.buildingId, item.name); }} className="grid h-9 w-9 place-items-center rounded-lg border border-red-400/25 text-red-300 transition hover:bg-red-400/10"><Trash2 className="h-4 w-4" /></button></>}</span></div>
                <h2 className="mt-5 font-serif text-2xl text-cream">{item.name}</h2>
                <p className="mt-1 text-xs text-sand-400">{item.subtitle}</p>
                <div className="mt-5 flex items-center justify-between border-t border-white/7 pt-4"><span className="text-[11px] text-sand-400">{item.detail}</span><span className="text-xs font-semibold text-sand">{item.count} {view === 'Айл' || view === 'Барилга' ? 'айл' : view === 'Орц' ? 'айл / орц' : 'давхар'}</span></div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-sand">{editingBuildingId ? 'EDIT PROPERTY STRUCTURE' : 'NEW PROPERTY STRUCTURE'}</p><h2 className="mt-2 font-serif text-2xl text-cream">{editingBuildingId ? 'Барилгын бүтэц засах' : 'Барилгын бүтэц үүсгэх'}</h2><p className="mt-1 text-sm text-sand-400">Барилгын үндсэн тоонуудыг оруулмагц суурь бүтэц бэлэн болно.</p></div><button type="button" onClick={closeDialog} className="text-sand-400 transition hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Барилгын нэр<Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-2" placeholder="Жишээ: E байр" /></label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-sand-200">Орцын тоо<Input type="number" min="1" value={draft.entrances} onChange={(event) => setDraft((current) => ({ ...current, entrances: event.target.value }))} className="mt-2" /></label>
                <label className="block text-xs font-semibold text-sand-200">Давхарын тоо<Input type="number" min="1" value={draft.floors} onChange={(event) => setDraft((current) => ({ ...current, floors: event.target.value }))} className="mt-2" /></label>
                <label className="block text-xs font-semibold text-sand-200">Нийт айл<Input type="number" min="1" value={draft.apartments} onChange={(event) => setDraft((current) => ({ ...current, apartments: event.target.value }))} className="mt-2" placeholder="120" /></label>
              </div>
              <div className="rounded-xl border border-sand/15 bg-sand/[.06] p-3 text-xs leading-5 text-sand-300">Хадгалах үед <b className="text-cream">барилга → орц → давхар → айл</b> гэсэн суурь бүтэц автоматаар үүснэ. Айлуудын нэр, эзэмшигчийг дараагийн алхамд Excel-ээр оруулна.</div>
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={closeDialog}>Болих</Button><Button disabled={!draft.name.trim()} loading={isSaving} onClick={saveStructure}>{editingBuildingId ? 'Өөрчлөлт хадгалах' : 'Бүтэц хадгалах'}</Button></div>
          </div>
        </div>
      )}
      </section>
    </PageStateWrapper>
  );
}
