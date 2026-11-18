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

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.floor(60 / stepMinute) },
    (_, i) => i * stepMinute
  );

  const ITEM_HEIGHT = 36; // px per item

  // Scroll to selected position
  useEffect(() => {
    if (hourScrollRef.current) {
      hourScrollRef.current.scrollTop = hour * ITEM_HEIGHT;
    }
  }, [hour]);

  useEffect(() => {
    if (minuteScrollRef.current) {
      const minIndex = Math.floor(minute / stepMinute);
      minuteScrollRef.current.scrollTop = minIndex * ITEM_HEIGHT;
    }
  }, [minute, stepMinute]);

  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const selectedIdx = Math.round(top / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(23, selectedIdx));
    if (clamped !== hour) {
      onChange(clamped, minute);
    }
  };

  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const selectedIdx = Math.round(top / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(minutes.length - 1, selectedIdx));
    const targetMin = minutes[clampedIdx];
    if (targetMin !== minute) {
      onChange(hour, targetMin);
    }
  };

  return (
    <div className="relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-2 select-none h-40 overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Center highlight bar */}
      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-9 bg-blue-500/15 dark:bg-blue-400/20 rounded-xl pointer-events-none border border-blue-500/30" />

      {/* Hour column */}
      <div
        ref={hourScrollRef}
        onScroll={handleHourScroll}
        className="w-20 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[52px]"
      >
        {hours.map((h) => {
          const isSelected = h === hour;
          return (
            <div
              key={h}
              style={{ height: `${ITEM_HEIGHT}px` }}
              onClick={() => onChange(h, minute)}
              className={`flex items-center justify-center snap-center text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 text-lg scale-110 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {h.toString().padStart(2, '0')}時
            </div>
          );
        })}
      </div>

      <span className="text-base font-bold text-slate-400 dark:text-slate-500 px-1">
        :
      </span>

      {/* Minute column */}
      <div
        ref={minuteScrollRef}
        onScroll={handleMinuteScroll}
        className="w-20 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[52px]"
      >
        {minutes.map((m) => {
          const isSelected = m === minute;
          return (
            <div
              key={m}
              style={{ height: `${ITEM_HEIGHT}px` }}
              onClick={() => onChange(hour, m)}
              className={`flex items-center justify-center snap-center text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'text-blue-600 dark:text-blue-400 text-lg scale-110 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
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
