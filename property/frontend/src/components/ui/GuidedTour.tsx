import { useEffect, useMemo, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const tours = {
  manager: [['Хяналтын самбар', 'Төлбөр, засвар, оршин суугчдын гол үзүүлэлтийг нэг дор харна.'], ['Хурдан хайлт', 'Ctrl/Cmd + K дарж аль ч хэсэг рүү шууд очно.'], ['Өөрийн болгох', 'Theme, filter болон pinned widget сонголт тань хадгалагдана.']],
  accountant: [['Санхүүгийн самбар', 'Нэхэмжлэл, төлбөр, зардлын урсгалаа эндээс удирдана.'], ['Хурдан хайлт', 'Ctrl/Cmd + K дарж санхүүгийн хэсгүүд рүү очно.'], ['Saved filters', 'Сонгосон filter дараагийн удаа автоматаар сэргээгдэнэ.']],
  resident: [['Миний нүүр', 'Төлбөр, хүсэлт, мэдэгдлийн quick action-ууд энд байна.'], ['Төлбөр ба хүсэлт', 'Доод navigation-аар хэрэгтэй хэсэгтээ хурдан очно.'], ['Хурдан хайлт', 'Ctrl/Cmd + K дарж portal дотроо хайна.']],
  staff: [['Ажлын жагсаалт', 'Өнөөдрийн даалгаврууд priority-аар харагдана.'], ['Thumb-friendly action', 'Том товчоор ажил эхлүүлэх, зураг оруулах, дуусгана.'], ['Хурдан хайлт', 'Ctrl/Cmd + K shortcut ашиглаж болно.']],
  super_admin: [['Платформын самбар', 'Байгууллага, хүсэлт, орлогын ерөнхий төлөв энд байна.'], ['Хурдан хайлт', 'Ctrl/Cmd + K дарж platform хэсгүүд рүү очно.'], ['Тохиргоо', 'Хандалт болон системийн тохиргоогоо шалгаарай.']],
} as const;

type TourRole = keyof typeof tours;

export default function GuidedTour() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const storageKey = `homelink-tour-complete:${user?.id ?? 'guest'}`;
  const steps = useMemo(
    () => user && user.role !== 'unassigned' ? tours[user.role as TourRole] : tours.manager,
    [user],
  );

  useEffect(() => {
    setStep(0);
    setOpen(Boolean(isAuthenticated && !localStorage.getItem(storageKey)));
  }, [isAuthenticated, storageKey]);

  if (!isAuthenticated) return null;
  const close = () => { localStorage.setItem(storageKey, 'true'); setOpen(false); };
  const next = () => step === steps.length - 1 ? close() : setStep((current) => current + 1);

  return <>
    <button type="button" onClick={() => { setStep(0); setOpen(true); }} className="fixed bottom-20 right-4 z-[80] grid h-10 w-10 place-items-center rounded-full border border-sand/30 bg-[#191816] text-sand shadow-xl transition hover:bg-sand hover:text-onyx sm:bottom-5" aria-label="Guided tour нээх" title="Тусламж"><Compass className="h-4 w-4" /></button>
    {open && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="guided-tour-panel w-full max-w-sm rounded-2xl border border-sand/25 bg-[#171614] p-5 text-cream shadow-2xl" aria-live="polite">
        <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.15em] text-sand">ТАНИЛЦУУЛГА · {step + 1}/{steps.length}</span><button type="button" onClick={close} aria-label="Tour алгасах" className="grid h-8 w-8 place-items-center rounded-lg text-sand-400 hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        <h2 id="tour-title" className="mt-4 font-serif text-2xl">{steps[step][0]}</h2><p className="mt-2 text-sm leading-6 text-sand-300">{steps[step][1]}</p>
        <div className="mt-5 flex items-center justify-between"><button type="button" onClick={close} className="text-xs text-sand-500 hover:text-sand">Алгасах</button><div className="flex gap-2">{step > 0 && <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Өмнөх</button>}<button type="button" onClick={next} autoFocus className="rounded-lg bg-sand px-4 py-2 text-xs font-bold text-onyx">{step === steps.length - 1 ? 'Дуусгах' : 'Дараах'}</button></div></div>
      </div>
    </div>}
  </>;
}
