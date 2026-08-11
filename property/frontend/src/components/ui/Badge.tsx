import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
};

const tones: Record<BadgeTone, string> = {
  neutral: 'border-white/10 bg-white/6 text-sand-200',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  danger: 'border-red-400/25 bg-red-400/10 text-red-200',
  info: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
};

export default function Badge({ className, tone = 'neutral', children, ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', tones[tone], className)} {...props}>{children}</span>;
}
