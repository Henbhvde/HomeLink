import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export default function Reveal({ children, className, delay = 0 }: RevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} style={{ transitionDelay: reducedMotion ? '0ms' : `${delay}ms` }} className={cn('transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none', isVisible || reducedMotion ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0', className)}>{children}</div>;
}
