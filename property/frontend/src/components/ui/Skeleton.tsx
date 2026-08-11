import { cn } from '../../utils/cn';

type SkeletonProps = {
  className?: string;
};

export default function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-lg border border-white/[.035] bg-white/[.075]', className)} aria-hidden="true" />;
}
