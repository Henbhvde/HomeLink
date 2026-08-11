import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode };

export default function Input({ className, suffix: _suffix, ...props }: InputProps) {
  return (
    <input
      className={cn('h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-cream outline-none placeholder:text-sand-500 transition-colors focus:border-sand/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909] disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
  );
}
