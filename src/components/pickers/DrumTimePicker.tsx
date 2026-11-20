import React, { useRef, useEffect } from 'react';

interface DrumTimePickerProps {
  hour: number;   // 0 - 23
  minute: number; // 0 - 59
  onChange: (hour: number, minute: number) => void;
  stepMinute?: number; // 1 or 5
}

export const DrumTimePicker: React.FC<DrumTimePickerProps> = ({
  hour,
  minute,
  onChange,
  stepMinute = 5,
}) => {
  const hourScrollRef = useRef<HTMLDivElement | null>(null);
  const minuteScrollRef = useRef<HTMLDivElement | null>(null);

  const isUserInteractingHourRef = useRef(false);
  const isUserInteractingMinuteRef = useRef(false);
  const hourTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.floor(60 / stepMinute) },
    (_, i) => i * stepMinute
  );

  const ITEM_HEIGHT = 32; // px per item

  // Scroll to selected position whenever hour changes from outside and user is not interacting
  useEffect(() => {
    if (hourScrollRef.current && !isUserInteractingHourRef.current) {
      hourScrollRef.current.scrollTop = hour * ITEM_HEIGHT;
    }
  }, [hour]);

  // Scroll to selected position whenever minute changes from outside and user is not interacting
  useEffect(() => {
    if (minuteScrollRef.current && !isUserInteractingMinuteRef.current) {
      const minIndex = Math.max(0, minutes.indexOf(minute));
      const targetIdx = minIndex >= 0 ? minIndex : Math.floor(minute / stepMinute);
      minuteScrollRef.current.scrollTop = targetIdx * ITEM_HEIGHT;
    }
  }, [minute, stepMinute, minutes]);

  // Handle Hour Scroll: ONLY trigger onChange if user is actively interacting (touch/wheel/mouse)
  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isUserInteractingHourRef.current) return;

    const top = e.currentTarget.scrollTop;
    const selectedIdx = Math.round(top / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(23, selectedIdx));

    if (hourTimeoutRef.current) clearTimeout(hourTimeoutRef.current);
    hourTimeoutRef.current = setTimeout(() => {
      isUserInteractingHourRef.current = false;
      if (clamped !== hour) {
        onChange(clamped, minute);
      }
    }, 120);
  };

  // Handle Minute Scroll: ONLY trigger onChange if user is actively interacting
  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isUserInteractingMinuteRef.current) return;

    const top = e.currentTarget.scrollTop;
    const selectedIdx = Math.round(top / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(minutes.length - 1, selectedIdx));
    const targetMin = minutes[clampedIdx];

    if (minuteTimeoutRef.current) clearTimeout(minuteTimeoutRef.current);
    minuteTimeoutRef.current = setTimeout(() => {
      isUserInteractingMinuteRef.current = false;
      if (targetMin !== minute) {
        onChange(hour, targetMin);
      }
    }, 120);
  };

  const handleSelectHour = (h: number) => {
    isUserInteractingHourRef.current = false;
    onChange(h, minute);
    if (hourScrollRef.current) {
      hourScrollRef.current.scrollTo({ top: h * ITEM_HEIGHT, behavior: 'smooth' });
    }
  };

  const handleSelectMinute = (m: number) => {
    isUserInteractingMinuteRef.current = false;
    onChange(hour, m);
    if (minuteScrollRef.current) {
      const idx = Math.max(0, minutes.indexOf(m));
      minuteScrollRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 select-none h-32 overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Center highlight bar */}
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-8 bg-blue-500/15 dark:bg-blue-400/20 rounded-lg pointer-events-none border border-blue-500/30" />

      {/* Hour column */}
      <div
        ref={hourScrollRef}
        onScroll={handleHourScroll}
        onTouchStart={() => { isUserInteractingHourRef.current = true; }}
        onMouseDown={() => { isUserInteractingHourRef.current = true; }}
        onWheel={() => { isUserInteractingHourRef.current = true; }}
        className="w-16 sm:w-20 h-full overflow-y-auto snap-y snap-mandatory py-[48px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {hours.map((h) => {
          const isSelected = h === hour;
          return (
            <div
              key={h}
              style={{ height: `${ITEM_HEIGHT}px` }}
              onClick={() => handleSelectHour(h)}
              className={`flex items-center justify-center snap-center text-xs sm:text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 text-base scale-110 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {h.toString().padStart(2, '0')}時
            </div>
          );
        })}
      </div>

      <span className="text-sm font-bold text-slate-400 dark:text-slate-500 px-1">
        :
      </span>

      {/* Minute column */}
      <div
        ref={minuteScrollRef}
        onScroll={handleMinuteScroll}
        onTouchStart={() => { isUserInteractingMinuteRef.current = true; }}
        onMouseDown={() => { isUserInteractingMinuteRef.current = true; }}
        onWheel={() => { isUserInteractingMinuteRef.current = true; }}
        className="w-16 sm:w-20 h-full overflow-y-auto snap-y snap-mandatory py-[48px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {minutes.map((m) => {
          const isSelected = m === minute;
          return (
            <div
              key={m}
              style={{ height: `${ITEM_HEIGHT}px` }}
              onClick={() => handleSelectMinute(m)}
              className={`flex items-center justify-center snap-center text-xs sm:text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 text-base scale-110 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {m.toString().padStart(2, '0')}分
            </div>
          );
        })}
      </div>
    </div>
  );
};
