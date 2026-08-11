import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBackendState } from '../hooks/useBackendState';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Eye,
  ImagePlus,
  Megaphone,
  Plus,
  Send,
  UserRoundCheck,
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import { PageStateWrapper } from '../components/ui';

type Priority = 'Бага' | 'Дунд' | 'Өндөр' | 'Яаралтай';
type RequestStatus = 'Шинэ' | 'Хүлээн авсан' | 'Ажиллаж байгаа' | 'Дууссан';
type RequestEditor = 'request' | 'common' | null;

type MaintenanceRequest = {
  id: string;
  title: string;
  unit: string;
  resident: string;
  priority: Priority;
  status: RequestStatus;
  assignee: string;
  date: string;
  description?: string;
  response?: string;
  completionReport?: string;
  cost?: number;
  attachment?: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  audience: string;
  scheduledFor: string;
  readCount: number;
  recipientCount: number;
  readers: string[];
};

const initialRequests: MaintenanceRequest[] = [];

const initialAnnouncements: Announcement[] = [
  {
    id: 'announcement-water-b',
    title: 'Ус түр хаах тухай',
    content: 'Маргааш 10:00–14:00 цагт B орцны усны шугамын засвар хийнэ. Ус ашиглах боломжгүйг анхаарна уу.',
    audience: 'B орц',
    scheduledFor: 'Маргааш, 10:00',
    readCount: 26,
    recipientCount: 32,
    readers: ['Бат-Эрдэнэ · B-1203', 'Ариунтуяа · B-0801', 'Энхжин · B-1102', 'М.Эрдэнэ · B-0604'],
  },
  {
    id: 'announcement-cleaning-a',
    title: 'Орцны цэвэрлэгээ',
    content: 'A орцны нийтийн талбайн их цэвэрлэгээ хийнэ.',
    audience: 'A орц',
    scheduledFor: 'Өнөөдөр, 15:00',
    readCount: 18,
    recipientCount: 29,
    readers: ['Наран · A-0903', 'Саруул · A-0701', 'Тэмүүлэн · A-0402'],
  },
];

const selectClassName = 'mt-2 h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-cream outline-none transition-colors focus:border-sand/55 focus:ring-2 focus:ring-sand/10';

function priorityTone(value: Priority) {
  if (value === 'Яаралтай') return 'danger';
  if (value === 'Өндөр' || value === 'Дунд') return 'warning';
  return 'neutral';
}

function statusTone(value: RequestStatus) {
  if (value === 'Дууссан') return 'success';
  if (value === 'Шинэ') return 'neutral';
  return 'warning';
}

function slaMeta(request: MaintenanceRequest) {
  if (request.status === 'Дууссан') return { label: 'SLA биелсэн', tone: 'success' as const };
  if (request.priority === 'Яаралтай') return { label: 'SLA · 1 цаг', tone: 'danger' as const };
  if (request.priority === 'Өндөр') return { label: 'SLA · 4 цаг', tone: 'warning' as const };
  return { label: 'SLA · 24 цаг', tone: 'neutral' as const };
}

export default function MaintenancePage() {
  const { token } = useAuth();
  const [requests, setRequests, status, retry] = useBackendState<MaintenanceRequest[]>('maintenance-requests', initialRequests);
  const [editor, setEditor] = useState<RequestEditor>(null);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestLocation, setRequestLocation] = useState('');
  const [requestPriority, setRequestPriority] = useState<Priority>('Дунд');
  const [requestAssignee, setRequestAssignee] = useState('Оноогоогүй');
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('Шинэ');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestResponse, setRequestResponse] = useState('');
  const [completionReport, setCompletionReport] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('B орц');
  const [announcementTime, setAnnouncementTime] = useState('Маргааш, 10:00');
  const [announcements, setAnnouncements] = useBackendState<Announcement[]>('maintenance-announcements', initialAnnouncements);
  const [visibleReaders, setVisibleReaders] = useState<string | null>(null);
  const [requestAttachment, setRequestAttachment] = useState<string>('');

  const { data: maintenanceStats } = useQuery({
    queryKey: ['maintenance-stats', token],
    queryFn: () => apiClient.getMaintenanceStats(token || ''),
    enabled: !!token,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['maintenance-staff', token],
    queryFn: () => apiClient.getMaintenanceStaff(token || ''),
    enabled: !!token,
  });
  const assignees = ['Оноогоогүй', ...staff.map((member) => member.name)];

  const orderedRequests = [...requests].sort((a, b) => Number(b.priority === 'Яаралтай') - Number(a.priority === 'Яаралтай'));
  const activeRequests = requests.filter((request) => request.status !== 'Дууссан');
  const urgentRequests = activeRequests.filter((request) => request.priority === 'Яаралтай');

  const openRequestEditor = (type: Exclude<RequestEditor, null>) => {
    setEditor(type);
    setRequestTitle(type === 'common' ? 'Лифт эвдэрсэн' : '');
    setRequestLocation(type === 'common' ? 'B орц · Лифт' : '');
    setRequestPriority(type === 'common' ? 'Яаралтай' : 'Дунд');
    setRequestAssignee('Оноогоогүй');
    setRequestStatus('Шинэ');
    setRequestDescription('');
    setRequestAttachment('');
  };

  const closeRequestEditor = () => {
    setEditor(null);
    setRequestTitle('');
    setRequestLocation('');
  };

  const createRequest = () => {
    if (!requestTitle.trim() || !requestLocation.trim()) return;

    setIsSaving(true);
    setRequests((current) => [
      {
        id: `new-${Date.now()}`,
        title: requestTitle.trim(),
        unit: requestLocation.trim(),
        resident: editor === 'common' ? 'Менежер · нийтийн талбай' : 'Менежер',
        priority: requestPriority,
        status: requestStatus,
        assignee: requestAssignee,
        date: 'Саяхан',
        description: requestDescription.trim(),
        attachment: requestAttachment || undefined,
      },
      ...current,
    ]);
    window.setTimeout(() => {
      setIsSaving(false);
      closeRequestEditor();
    }, 450);
  };

  const openRequestManager = (request: MaintenanceRequest) => {
    setSelectedRequest(request);
    setRequestAssignee(request.assignee);
    setRequestPriority(request.priority);
    setRequestStatus(request.status);
    setRequestResponse(request.response || '');
    setCompletionReport(request.completionReport || '');
    setCompletionCost(request.cost ? String(request.cost) : '');
  };

  const saveRequestManager = () => {
    if (!selectedRequest) return;

    setIsSaving(true);
    setRequests((current) => current.map((request) => (
      request.id === selectedRequest.id
        ? { ...request, assignee: requestAssignee, priority: requestPriority, status: requestStatus, response: requestResponse.trim(), completionReport: completionReport.trim(), cost: Number(completionCost) || 0 }
        : request
    )));
    window.setTimeout(() => {
      setIsSaving(false);
      setSelectedRequest(null);
    }, 350);
  };

  const publishAnnouncement = () => {
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    const recipients = announcementAudience === 'B орц' ? 32 : announcementAudience === 'A орц' ? 29 : 24;
    setIsSendingAnnouncement(true);
    setAnnouncements((current) => [
      {
        id: `announcement-${Date.now()}`,
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        audience: announcementAudience,
        scheduledFor: announcementTime.trim() || 'Одоо',
        readCount: 0,
        recipientCount: recipients,
        readers: [],
      },
      ...current,
    ]);
    window.setTimeout(() => {
      setIsSendingAnnouncement(false);
      setIsAnnouncementOpen(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementAudience('B орц');
      setAnnouncementTime('Маргааш, 10:00');
    }, 450);
  };

  return (
    <PageStateWrapper
      status={status}
      isEmpty={requests.length === 0}
      onRetry={retry}
      emptyIcon={Wrench}
      emptyTitle="Одоогоор ирсэн засварын хүсэлт алга"
      emptyDescription="Оршин суугчдын хүсэлт энд харагдана. Мөн нийтийн эзэмшлийн засварт ажлын даалгавар үүсгэж болно."
      emptyAction={<Button onClick={() => openRequestEditor('common')}>Ажлын даалгавар үүсгэх</Button>}
    >
      <section>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[.18em] text-sand">DAILY OPERATIONS</p>
          <h1 className="mt-2 font-serif text-3xl font-light text-cream">Засвар, зарлал.</h1>
          <p className="mt-2 text-sm text-sand-400">Шинэ хүсэлтийг оноож, нийтийн асуудал болон орцод чиглэсэн мэдээллийг нэг дор удирдана.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openRequestEditor('common')}><Wrench className="h-4 w-4" />Ажлын даалгавар үүсгэх</Button>
          <Button onClick={() => setIsAnnouncementOpen(true)}><Megaphone className="h-4 w-4" />Зарлал илгээх</Button>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Нээлттэй хүсэлт', value: String(maintenanceStats?.openCount ?? activeRequests.length), icon: Wrench, note: `${maintenanceStats?.urgentCount ?? urgentRequests.length} яаралтай` },
          { label: 'Дундаж шийдвэрлэлт', value: `${maintenanceStats?.avgResolutionHours ?? 0} цаг`, icon: CalendarClock, note: 'Энэ сард' },
          { label: 'Дууссан ажил', value: String(maintenanceStats?.closedCount ?? requests.filter((request) => request.status === 'Дууссан').length), icon: CheckCircle2, note: `${maintenanceStats?.slaRate ?? 0}% SLA` },
        ].map(({ label, value, icon: Icon, note }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-[11px] text-sand-400">{label}</p>
                <b className="mt-1 block font-sans text-2xl font-semibold tracking-tight text-cream">{value}</b>
                <small className="text-[10px] text-sand-500">{note}</small>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/10 text-sand"><Icon className="h-4 w-4" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-white/7 p-5">
              <div>
                <h2 className="font-serif text-xl text-cream">Ирсэн засварын хүсэлт</h2>
                <p className="mt-1 text-xs text-sand-400">Шинэ хүсэлт бүрт хариуцагч, яаралтай зэргийг онооно.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openRequestEditor('common')}><Plus className="h-3.5 w-3.5" />Ажлын даалгавар үүсгэх</Button>
            </div>
            <div className="divide-y divide-white/7">
              {orderedRequests.map((request) => (
                <div key={request.id} className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-sand"><Wrench className="h-4 w-4" /></span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="text-xs text-cream">{request.title}</b>
                          <span className="text-[10px] text-sand-500">{request.id}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-sand-400">{request.unit} · {request.resident} · {request.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={priorityTone(request.priority)}>{request.priority}</Badge>
                      <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                      <Badge tone={slaMeta(request).tone}>{slaMeta(request).label}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3">
                    <span className="inline-flex items-center gap-2 text-[11px] text-sand-300"><UserRoundCheck className="h-3.5 w-3.5 text-sand" />{request.assignee}</span>
                    <button onClick={() => openRequestManager(request)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-sand hover:text-cream">Удирдах <ChevronDown className="h-3.5 w-3.5 -rotate-90" /></button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-bold tracking-[.16em] text-sand">TEAM LOAD</p>
            <h2 className="mt-2 font-serif text-xl text-cream">Багийн ачаалал</h2>
            <p className="mt-1 text-xs text-sand-400">Оноохоос өмнө ажлын ачааллыг харьцуулна.</p>
            <div className="mt-5 space-y-4">
              {staff.length === 0 && <p className="text-xs text-sand-500">Идэвхтэй ажилтан бүртгэгдээгүй байна.</p>}
              {staff.map(({ id, name }) => {
                const count = activeRequests.filter((request) => request.assignee === name).length;
                return <div key={id}>
                  <div className="flex justify-between text-xs"><span className="font-semibold text-sand-200">{name}</span><span className="text-sand-500">{count} ажил</span></div>
                  <div className="mt-2 h-2 rounded-full bg-white/7"><div className="h-full rounded-full bg-sand" style={{ width: `${Math.min(100, count * 20)}%` }} /></div>
                </div>;
              })}
            </div>
            <div className="mt-7 rounded-xl border border-sand/15 bg-sand/5 p-4">
              <CircleAlert className="h-4 w-4 text-sand" />
              <p className="mt-2 text-xs font-semibold text-cream">{urgentRequests.length} яаралтай хүсэлт</p>
              <p className="mt-1 text-[11px] leading-relaxed text-sand-400">Яаралтай хүсэлтэд Дорж эсвэл тохирох ажилтныг шууд оноож, явцыг шинэчилнэ үү.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-white/7 p-5">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-sand">TARGETED COMMUNICATION</p>
                <h2 className="mt-2 font-serif text-xl text-cream">Илгээсэн зарлал</h2>
              </div>
              <span className="inline-flex items-center gap-2 text-[11px] text-sand-400"><BellRing className="h-3.5 w-3.5 text-sand" />Уншилт хянагдана</span>
            </div>
            <div className="divide-y divide-white/7">
              {announcements.map((announcement) => {
                const hasReadersOpen = visibleReaders === announcement.id;
                const readRate = Math.round((announcement.readCount / announcement.recipientCount) * 100);
                return (
                  <div key={announcement.id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand/10 text-sand"><Megaphone className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><b className="text-xs text-cream">{announcement.title}</b><Badge tone="info">{announcement.audience}</Badge></div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-sand-400">{announcement.content}</p>
                          <p className="mt-2 text-[10px] text-sand-500">{announcement.scheduledFor}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <b className="block text-xs text-cream">{announcement.readCount} / {announcement.recipientCount}</b>
                        <span className="text-[10px] text-sand-500">уншсан · {readRate}%</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] pt-3">
                      <div className="h-1.5 min-w-[150px] flex-1 rounded-full bg-white/7"><div className="h-full rounded-full bg-sand" style={{ width: `${readRate}%` }} /></div>
                      <button onClick={() => setVisibleReaders(hasReadersOpen ? null : announcement.id)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sand hover:text-cream"><Eye className="h-3.5 w-3.5" />{hasReadersOpen ? 'Жагсаалтыг хаах' : 'Хэн уншсаныг харах'}</button>
                    </div>
                    {hasReadersOpen && (
                      <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-sand-200"><UsersRound className="h-3.5 w-3.5 text-sand" />Уншсан оршин суугчид</div>
                        {announcement.readers.length > 0 ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {announcement.readers.map((reader) => <span key={reader} className="rounded-lg bg-white/[.045] px-2.5 py-2 text-[11px] text-sand-300">{reader}</span>)}
                            {announcement.readCount > announcement.readers.length && <span className="rounded-lg bg-white/[.045] px-2.5 py-2 text-[11px] text-sand-500">+{announcement.readCount - announcement.readers.length} хүн</span>}
                          </div>
                        ) : <p className="mt-2 text-[11px] text-sand-500">Одоогоор уншсан оршин суугч алга.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-bold tracking-[.16em] text-sand">QUICK SEND</p>
            <h2 className="mt-2 font-serif text-xl text-cream">B орцод зарлал илгээх</h2>
            <p className="mt-1 text-xs leading-relaxed text-sand-400">Ус, лифт, цэвэрлэгээний мэдээллийг зөвхөн хамаарах орц руу чиглүүлнэ.</p>
            <div className="mt-5 rounded-xl border border-sand/15 bg-sand/5 p-4">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-sand/10 text-sand"><UsersRound className="h-4 w-4" /></span><div><b className="block text-xs text-cream">B орц · 32 айл</b><span className="text-[10px] text-sand-400">Тусдаа зорилтот жагсаалт</span></div></div>
            </div>
            <Button className="mt-5 w-full" onClick={() => setIsAnnouncementOpen(true)}><Send className="h-4 w-4" />B орц руу зарлал бичих</Button>
          </CardContent>
        </Card>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Засварын хүсэлт үүсгэх">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-sand">{editor === 'common' ? 'COMMON AREA ISSUE' : 'NEW REQUEST'}</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">{editor === 'common' ? 'Ажлын даалгавар үүсгэх' : 'Засварын хүсэлт'}</h2>
              </div>
              <button onClick={closeRequestEditor} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button>
            </div>
            {editor === 'common' && <div className="mt-5 flex gap-2 rounded-xl border border-sand/15 bg-sand/5 p-3 text-[11px] leading-relaxed text-sand-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sand" />Лифт, орц, шугам зэрэг нийтийн талбайн асуудал нь айлд биш нийтэд хамаарна.</div>}
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Гарчиг<Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} className="mt-2" placeholder="Асуудлыг товч бичнэ үү" /></label>
              <label className="block text-xs font-semibold text-sand-200">Байршил<Input value={requestLocation} onChange={(event) => setRequestLocation(event.target.value)} className="mt-2" placeholder="B орц · Лифт" /></label>
              <label className="block text-xs font-semibold text-sand-200">Тайлбар<textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} rows={3} className={selectClassName.replace('h-11', 'h-auto py-3')} placeholder="Асуудал, хийх ажлыг дэлгэрэнгүй бичнэ үү" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-sand-200">Хариуцагч
                  <div className="relative"><select value={requestAssignee} onChange={(event) => setRequestAssignee(event.target.value)} className={selectClassName}>{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
                </label>
                <label className="block text-xs font-semibold text-sand-200">Яаралтай зэрэг
                  <div className="relative"><select value={requestPriority} onChange={(event) => setRequestPriority(event.target.value as Priority)} className={selectClassName}>{(['Бага', 'Дунд', 'Өндөр', 'Яаралтай'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sand/25 p-3 text-xs text-sand-300"><input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setRequestAttachment(String(reader.result)); reader.readAsDataURL(file); }} /><ImagePlus className="h-5 w-5 text-sand" /><span>{requestAttachment ? 'Хавсралт бэлэн' : 'Зураг хавсаргах'}</span></label>
              {requestAttachment && <img src={requestAttachment} alt="Хавсралтын урьдчилсан харагдац" decoding="async" className="h-32 w-full rounded-xl object-cover" />}
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={closeRequestEditor}>Болих</Button><Button disabled={!requestTitle.trim() || !requestLocation.trim()} loading={isSaving} onClick={createRequest}>{editor === 'common' ? 'Даалгавар үүсгэх' : 'Хүсэлт илгээх'}</Button></div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Хүсэлт удирдах">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-sand">REQUEST CONTROL</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">Хүсэлт оноох</h2>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4"><b className="block text-sm text-cream">{selectedRequest.title}</b><p className="mt-1 text-[11px] text-sand-400">{selectedRequest.id} · {selectedRequest.unit} · {selectedRequest.resident}</p>{selectedRequest.description && <p className="mt-3 text-xs leading-relaxed text-sand-300">{selectedRequest.description}</p>}</div>
            <div className="mt-4 flex items-center justify-between"><span className="text-[10px] font-bold tracking-wider text-sand-500">REQUEST TIMELINE</span><Badge tone={slaMeta(selectedRequest).tone}>{slaMeta(selectedRequest).label}</Badge></div>
            <ol className="mt-3 space-y-2 border-l border-sand/25 pl-4 text-xs">{['Хүсэлт ирсэн', ...(selectedRequest.status !== 'Шинэ' ? ['Хүлээн авсан'] : []), ...(selectedRequest.status === 'Ажиллаж байгаа' || selectedRequest.status === 'Дууссан' ? ['Ажиллаж байгаа'] : []), ...(selectedRequest.status === 'Дууссан' ? ['Дууссан'] : [])].map((event, index) => <li key={event} className="relative text-sand-300"><span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-sand" />{event}<small className="ml-2 text-sand-500">{index === 0 ? selectedRequest.date : 'Явц шинэчлэгдсэн'}</small></li>)}</ol>
            {selectedRequest.attachment && <div className="mt-4"><p className="mb-2 text-[10px] font-bold tracking-wider text-sand-500">ХАВСРАЛТ</p><img src={selectedRequest.attachment} alt="Хүсэлтийн хавсралт" loading="lazy" decoding="async" className="h-36 w-full rounded-xl object-cover" /></div>}
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Хариуцагч
                <div className="relative"><select value={requestAssignee} onChange={(event) => setRequestAssignee(event.target.value)} className={selectClassName}>{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-sand-200">Яаралтай зэрэг
                  <div className="relative"><select value={requestPriority} onChange={(event) => setRequestPriority(event.target.value as Priority)} className={selectClassName}>{(['Бага', 'Дунд', 'Өндөр', 'Яаралтай'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
                </label>
                <label className="block text-xs font-semibold text-sand-200">Төлөв
                  <div className="relative"><select value={requestStatus} onChange={(event) => setRequestStatus(event.target.value as RequestStatus)} className={selectClassName}>{(['Шинэ', 'Хүлээн авсан', 'Ажиллаж байгаа', 'Дууссан'] as RequestStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
                </label>
              </div>
              <label className="block text-xs font-semibold text-sand-200">Оршин суугчид өгөх хариу<textarea value={requestResponse} onChange={(event) => setRequestResponse(event.target.value)} rows={2} className={selectClassName.replace('h-11', 'h-auto py-3')} placeholder="Хүсэлтийн явц, шийдлийг бичнэ үү" /></label>
              {requestStatus === 'Дууссан' && <div className="space-y-4 rounded-xl border border-sand/15 bg-sand/5 p-4"><label className="block text-xs font-semibold text-sand-200">Дууссан ажлын тайлан<textarea value={completionReport} onChange={(event) => setCompletionReport(event.target.value)} rows={3} className={selectClassName.replace('h-11', 'h-auto py-3')} /></label><label className="block text-xs font-semibold text-sand-200">Зардал<Input type="number" min="0" value={completionCost} onChange={(event) => setCompletionCost(event.target.value)} className="mt-2" placeholder="0" /></label></div>}
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setSelectedRequest(null)}>Болих</Button><Button loading={isSaving} onClick={saveRequestManager}><ClipboardCheck className="h-4 w-4" />Оноолтыг хадгалах</Button></div>
          </div>
        </div>
      )}

      {isAnnouncementOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Зарлал илгээх">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-sand">TARGETED ANNOUNCEMENT</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">Зарлал илгээх</h2>
              </div>
              <button onClick={() => setIsAnnouncementOpen(false)} className="text-sand-400 hover:text-cream" aria-label="Хаах"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-sand-200">Гарчиг<Input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} className="mt-2" placeholder="Жишээ: Ус түр хаах тухай" /></label>
              <label className="block text-xs font-semibold text-sand-200">Мэдээлэл<textarea value={announcementContent} onChange={(event) => setAnnouncementContent(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-cream outline-none placeholder:text-sand-500 focus:border-sand/55 focus:ring-2 focus:ring-sand/10" placeholder="Маргааш 10:00–14:00 цагт ус хаана..." /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-sand-200">Хүлээн авагч
                  <div className="relative"><select value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value)} className={selectClassName}><option>B орц</option><option>A орц</option><option>C орц</option></select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-sand-500" /></div>
                </label>
                <label className="block text-xs font-semibold text-sand-200">Илгээх хугацаа<Input value={announcementTime} onChange={(event) => setAnnouncementTime(event.target.value)} className="mt-2" placeholder="Маргааш, 10:00" /></label>
              </div>
              <div className="flex gap-2 rounded-xl border border-sand/15 bg-sand/5 p-3 text-[11px] leading-relaxed text-sand-300"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-sand" />Илгэсний дараа тухайн орцны оршин суугчдын уншсан төлөвийг харах боломжтой.</div>
            </div>
            <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsAnnouncementOpen(false)}>Болих</Button><Button disabled={!announcementTitle.trim() || !announcementContent.trim()} loading={isSendingAnnouncement} onClick={publishAnnouncement}><Send className="h-4 w-4" />{announcementAudience} руу илгээх</Button></div>
          </div>
        </div>
      )}
      </section>
    </PageStateWrapper>
  );
}
