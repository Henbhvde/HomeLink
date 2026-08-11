import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] px-6 py-10 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-sand/20 bg-sand/10 text-sand">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-serif text-xl text-cream">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-sand-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
