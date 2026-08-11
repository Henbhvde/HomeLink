import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Button from './Button';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

export type PageStateStatus = 'loading' | 'ready' | 'error';

type PageStateWrapperProps = {
  status?: PageStateStatus;
  isEmpty?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
};

function PageSkeleton() {
  return (
    <div className="space-y-6 p-1" role="status" aria-busy="true" aria-label="Хуудас ачаалж байна">
      <span className="sr-only">Мэдээлэл ачаалж байна...</span>
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Stats/Cards Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-white/5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PageStateWrapper({
  status = 'ready',
  isEmpty = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  children,
}: PageStateWrapperProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCheckingOffline, setIsCheckingOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = () => {
    setIsCheckingOffline(true);
    setTimeout(() => {
      setIsCheckingOffline(false);
      setIsOnline(navigator.onLine);
    }, 800);
  };

  // 1. Offline State
  if (!isOnline) {
    return (
      <div className="flex min-h-[450px] flex-col items-center justify-center p-8 text-center residence-command">
        <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-500/20 text-amber-400">
          <WifiOff className="h-7 w-7 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
        <h2 className="font-serif text-2xl font-light text-cream">Интернет холболтгүй байна.</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-sand-400">
          Та сүлжээний холболтоо шалгаад дахин оролдоно уу. Сүлжээ сэргэхэд хуудас автоматаар ачааллах болно.
        </p>
        <Button
          onClick={checkConnection}
          className="mt-6 inline-flex items-center gap-2"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 ${isCheckingOffline ? 'animate-spin' : ''}`} />
          Холболтыг шалгах
        </Button>
      </div>
    );
  }

  // 2. Loading State
  if (status === 'loading') {
    return <PageSkeleton />;
  }

  // 3. Error State
  if (status === 'error') {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/10 to-rose-700/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="font-serif text-2xl font-light text-cream">Хүсэлтийг биелүүлэхэд алдаа гарлаа.</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-sand-400">
          Мэдээллийг ачаалахад алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.
        </p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-6 inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Дахин оролдох
          </Button>
        )}
      </div>
    );
  }

  // 4. Empty State
  if (isEmpty && emptyIcon && emptyTitle && emptyDescription) {
    return (
      <div className="p-1 animate-fadeIn">
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  // 5. Loaded / Ready State
  return <div className="animate-fadeIn">{children}</div>;
}
