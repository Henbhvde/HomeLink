import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) { return <div className="overflow-x-auto"><table className={cn('w-full text-left text-sm', className)} {...props} /></div>; }
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn('border-b border-white/10 text-caption font-bold uppercase tracking-wider text-sand-500', className)} {...props} />; }
export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) { return <tbody {...props} />; }
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn('border-b border-white/[.06] hover:bg-white/[.025]', className)} {...props} />; }
export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={cn('px-5 py-3', className)} {...props} />; }
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn('px-5 py-4', className)} {...props} />; }
