import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-sand/15 bg-[linear-gradient(145deg,rgba(31,34,29,.88),rgba(13,16,14,.94))] shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return <div className={cn('flex items-start justify-between gap-4 p-5 pb-0', className)} {...props}>{children}</div>;
}

export function CardContent({ className, children, ...props }: CardProps) {
  return <div className={cn('p-5', className)} {...props}>{children}</div>;
}
