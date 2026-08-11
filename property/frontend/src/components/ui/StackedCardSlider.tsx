import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SpotlightCard from './SpotlightCard';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface SliderItem {
  stepNumber: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

interface StackedCardSliderProps {
  items: SliderItem[];
}

export default function StackedCardSlider({ items }: StackedCardSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const next = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const prev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  React.useEffect(() => {
    if (reducedMotion) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [items.length, reducedMotion]);

  const getCardStyle = (idx: number) => {
    let offset = idx - activeIndex;
    const total = items.length;

    // Handle circular offsets
    if (offset < -Math.floor(total / 2)) offset += total;
    if (offset > Math.floor(total / 2)) offset -= total;

    const absOffset = Math.abs(offset);
    const isActive = offset === 0;

    // 3D perspective styling variables
    const zIndex = 30 - absOffset * 10;
    const translateX = offset * 85; // card spacing
    const translateY = absOffset * 10; // downward drift for background cards
    const scale = 1 - absOffset * 0.08;
    const rotate = offset * 4.5; // perspective tilt rotation
    const opacity = 1 - absOffset * 0.28;

    return {
      transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
      zIndex,
      opacity: opacity < 0 ? 0 : opacity,
      cursor: isActive ? 'default' : 'pointer',
    };
  };

  return (
    <div className="flex flex-col items-center w-full select-none overflow-visible">
      {/* 3D Stack Viewport */}
      <div className="relative w-full h-[320px] flex items-center justify-center overflow-visible">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={idx}
              onClick={() => !isActive && setActiveIndex(idx)}
              className="absolute w-[240px] sm:w-[260px] h-[280px] transition-all duration-500 ease-out origin-center"
              style={getCardStyle(idx)}
            >
              <SpotlightCard className={`w-full h-full p-6 flex flex-col justify-between border !backdrop-blur-none ${isActive ? 'border-sand !bg-[#1a1815]' : 'border-white/10 !bg-[#151411]'} shadow-2xl`}>
                <div className="flex justify-between items-start">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-sand/15 text-sand border border-sand/20' : 'bg-white/5 text-sand-400 border border-white/5'}`}>
                    {item.icon}
                  </div>
                  <span className={`font-serif text-5xl font-light leading-none ${isActive ? 'text-sand/20' : 'text-sand-500/10'}`}>
                    {item.stepNumber}
                  </span>
                </div>

                <div className="mt-auto">
                  <h4 className="font-serif text-base font-semibold text-cream">{item.title}</h4>
                  <p className="font-sans font-light text-[11px] text-sand-300 leading-relaxed mt-2.5">
                    {item.desc}
                  </p>
                </div>
              </SpotlightCard>
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Өмнөх алхам"
          onClick={prev}
          className="absolute left-[calc(50%-165px)] top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand/35 bg-[#161512] text-sand shadow-lg transition-colors hover:bg-sand hover:text-onyx sm:left-[calc(50%-185px)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Дараах алхам"
          onClick={next}
          className="absolute right-[calc(50%-165px)] top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand/35 bg-[#161512] text-sand shadow-lg transition-colors hover:bg-sand hover:text-onyx sm:right-[calc(50%-185px)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
