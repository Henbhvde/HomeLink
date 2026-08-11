import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = { open: boolean; title: string; description?: string; children: ReactNode; footer?: ReactNode; onClose: () => void };

export default function Modal({ open, title, description, children, footer, onClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    panel?.querySelector<HTMLElement>('button,input,select,textarea')?.focus();
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose, open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div ref={panelRef} className="w-full max-w-lg rounded-modal border border-white/10 bg-charcoal p-card shadow-modal"><div className="flex justify-between gap-4"><div><h2 id="modal-title" className="font-serif text-section-title text-cream">{title}</h2>{description && <p className="mt-2 text-body text-sand-400">{description}</p>}</div><button type="button" onClick={onClose} aria-label="Хаах" className="grid h-10 w-10 place-items-center rounded-control"><X className="h-4 w-4" /></button></div><div className="mt-5">{children}</div>{footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}</div></div>;
}
