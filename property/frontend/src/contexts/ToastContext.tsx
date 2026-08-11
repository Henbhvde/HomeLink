import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import Button from '../components/ui/Button';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = ToastOptions & {
  id: string;
  tone: ToastTone;
  duration: number;
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ToastContextValue = {
  showToast: (input: string | ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-50',
  error: 'border-red-400/25 bg-red-400/10 text-red-50',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-50',
  info: 'border-white/10 bg-[#171614] text-sand-100',
};

const toneIcons: Record<ToastTone, JSX.Element> = {
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <AlertTriangle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = (input: string | ToastOptions) => {
    const payload = typeof input === 'string' ? { title: input } : input;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const toast: ToastItem = {
      id,
      title: payload.title,
      description: payload.description,
      tone: payload.tone ?? 'info',
      duration: payload.duration ?? 2800,
    };

    setToasts((current) => [...current, toast]);
    window.setTimeout(() => removeToast(id), toast.duration);
  };

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve, tone: options.tone ?? 'default' });
    });

  const closeConfirm = () => {
    if (!confirmState) return;
    confirmState.resolve(false);
    setConfirmState(null);
  };

  const acceptConfirm = () => {
    if (!confirmState) return;
    confirmState.resolve(true);
    setConfirmState(null);
  };

  const value = useMemo(() => ({ showToast, confirm }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex w-[min(24rem,calc(100%-1.5rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${toneStyles[toast.tone]}`}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{toneIcons[toast.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description && <p className="mt-1 text-sm/5 text-current/80">{toast.description}</p>}
              </div>
              <button type="button" onClick={() => removeToast(toast.id)} className="shrink-0 text-current/70 transition hover:text-current" aria-label="Хаах">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171614] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-9 w-9 place-items-center rounded-full ${confirmState.tone === 'danger' ? 'bg-red-400/10 text-red-200' : 'bg-sand/10 text-sand'}`}>
                {confirmState.tone === 'danger' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-[.18em] text-sand">CONFIRM ACTION</p>
                <h2 className="mt-2 font-serif text-2xl text-cream">{confirmState.title}</h2>
                <p className="mt-2 text-sm text-sand-400">{confirmState.description}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={closeConfirm}>{confirmState.cancelLabel ?? 'Болих'}</Button>
              <Button type="button" onClick={acceptConfirm} className={confirmState.tone === 'danger' ? 'bg-red-500/90 hover:bg-red-500' : ''}>{confirmState.confirmLabel ?? 'Батлах'}</Button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
