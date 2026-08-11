import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
}

export default function BlurText({ text, delay = 35, className = '', animateBy = 'letters' }: BlurTextProps) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const reducedMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className={`inline-block ${className}`}>
      {elements.map((elem, idx) => (
        <span
          key={idx}
          className="inline-block transition-all duration-700 ease-out"
          style={{
            opacity: isMounted || reducedMotion ? 1 : 0,
            filter: isMounted || reducedMotion ? 'blur(0px)' : 'blur(8px)',
            transform: isMounted || reducedMotion ? 'translateY(0px)' : 'translateY(12px)',
            transitionDelay: reducedMotion ? '0ms' : `${idx * delay}ms`,
            marginRight: animateBy === 'words' ? '0.25em' : '0.01em',
            whiteSpace: elem === ' ' ? 'pre' : 'normal',
          }}
        >
          {elem}
        </span>
      ))}
    </span>
  );
}
