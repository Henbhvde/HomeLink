

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export default function ShinyText({ text, disabled = false, speed = 6, className = '' }: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block text-transparent bg-clip-text ${
        disabled
          ? 'text-slate-300'
          : 'bg-gradient-to-r from-neutral-300 via-white to-neutral-300 bg-[length:200%_auto] animate-shine'
      } ${className}`}
      style={{
        animationDuration: disabled ? undefined : animationDuration,
        backgroundImage: disabled
          ? undefined
          : 'linear-gradient(120deg, rgba(255, 255, 255, 0.4) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0.4) 70%)',
      }}
    >
      {text}
    </span>
  );
}
