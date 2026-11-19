import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Check } from 'lucide-react';

interface YearMonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onSelectYearMonth: (year: number, month: number) => void;
}

const MIN_YEAR = 1980;
const MAX_YEAR = 2040;
const ITEM_HEIGHT = 40; // px height per row item

export const YearMonthPickerModal: React.FC<YearMonthPickerModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onSelectYearMonth,
}) => {
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const yearScrollRef = useRef<HTMLDivElement | null>(null);
  const monthScrollRef = useRef<HTMLDivElement | null>(null);

  const isUserScrollingYearRef = useRef(false);
  const isUserScrollingMonthRef = useRef(false);
  const yearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Sync state when opened with currentDate
  useEffect(() => {
    if (isOpen) {
      setSelectedYear(currentDate.getFullYear());
      setSelectedMonth(currentDate.getMonth() + 1);
    }
  }, [isOpen, currentDate]);

  // Escape key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Programmatic scroll to selected year
  useEffect(() => {
    if (!isOpen) return;
    const yearIdx = years.indexOf(selectedYear);
    if (yearIdx >= 0 && yearScrollRef.current && !isUserScrollingYearRef.current) {
      yearScrollRef.current.scrollTop = yearIdx * ITEM_HEIGHT;
    }
  }, [isOpen, selectedYear, years]);

  // Programmatic scroll to selected month
  useEffect(() => {
    if (!isOpen) return;
    const monthIdx = selectedMonth - 1;
    if (monthScrollRef.current && !isUserScrollingMonthRef.current) {
      monthScrollRef.current.scrollTop = monthIdx * ITEM_HEIGHT;
    }
  }, [isOpen, selectedMonth]);

  if (!isOpen) return null;

  // Handle year scroll with gesture detection
  const handleYearScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isUserScrollingYearRef.current) return;

    const top = e.currentTarget.scrollTop;
    const idx = Math.round(top / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(years.length - 1, idx));
    const targetYear = years[clampedIdx];

    if (yearTimeoutRef.current) clearTimeout(yearTimeoutRef.current);
    yearTimeoutRef.current = setTimeout(() => {
      isUserScrollingYearRef.current = false;
      setSelectedYear(targetYear);
    }, 120);
  };

  // Handle month scroll with gesture detection
  const handleMonthScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isUserScrollingMonthRef.current) return;

    const top = e.currentTarget.scrollTop;
    const idx = Math.round(top / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(11, idx));
    const targetMonth = clampedIdx + 1;

    if (monthTimeoutRef.current) clearTimeout(monthTimeoutRef.current);
    monthTimeoutRef.current = setTimeout(() => {
      isUserScrollingMonthRef.current = false;
      setSelectedMonth(targetMonth);
    }, 120);
  };

  const handleSelectYear = (y: number) => {
    isUserScrollingYearRef.current = false;
    setSelectedYear(y);
    const idx = years.indexOf(y);
    if (yearScrollRef.current && idx >= 0) {
      yearScrollRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
    }
  };

  const handleSelectMonth = (m: number) => {
    isUserScrollingMonthRef.current = false;
    setSelectedMonth(m);
    if (monthScrollRef.current) {
      monthScrollRef.current.scrollTo({ top: (m - 1) * ITEM_HEIGHT, behavior: 'smooth' });
    }
  };

  const handleJumpToday = () => {
    const today = new Date();
    handleSelectYear(today.getFullYear());
    handleSelectMonth(today.getMonth() + 1);
  };

  const handleConfirm = () => {
    onSelectYearMonth(selectedYear, selectedMonth);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                年月を選択
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ドラムをスクロールまたはタップ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleJumpToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition active:scale-95"
            >
              今月
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dual Drum Roll Wheels (Year Roll & Month Roll) */}
        <div className="p-5 flex flex-col items-center">
          {/* Drum Rolls Container */}
          <div className="relative flex items-center justify-center w-full bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl p-2 h-52 overflow-hidden border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            {/* Top Column Labels (Clean non-overlapping header bar) */}
            <div className="absolute inset-x-0 top-0 h-7 flex items-center justify-around pointer-events-none z-20 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200/50 dark:border-slate-700/50">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                年
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                月
              </span>
            </div>

            {/* Top Fade Gradient Mask */}
            <div className="absolute inset-x-0 top-7 h-8 bg-gradient-to-b from-slate-100/90 dark:from-slate-800/90 to-transparent pointer-events-none z-10" />

            {/* Center Selection Highlight Bar */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-10 bg-blue-500/15 dark:bg-blue-400/20 rounded-xl pointer-events-none border border-blue-500/30 shadow-xs" />

            {/* Bottom Fade Gradient Mask */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-100/90 dark:from-slate-800/90 to-transparent pointer-events-none z-10" />

            {/* 1. Year Drum Column */}
            <div className="flex-1 flex flex-col items-center h-full">
              <div
                ref={yearScrollRef}
                onScroll={handleYearScroll}
                onTouchStart={() => { isUserScrollingYearRef.current = true; }}
                onMouseDown={() => { isUserScrollingYearRef.current = true; }}
                onWheel={() => { isUserScrollingYearRef.current = true; }}
                className="w-full h-full overflow-y-auto snap-y snap-mandatory py-[68px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {years.map((y) => {
                  const isSelected = y === selectedYear;
                  return (
                    <div
                      key={y}
                      style={{ height: `${ITEM_HEIGHT}px` }}
                      onClick={() => handleSelectYear(y)}
                      className={`flex items-center justify-center snap-center text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400 text-lg scale-110 font-bold'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {y}年
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-28 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2 z-10" />

            {/* 2. Month Drum Column */}
            <div className="flex-1 flex flex-col items-center h-full">
              <div
                ref={monthScrollRef}
                onScroll={handleMonthScroll}
                onTouchStart={() => { isUserScrollingMonthRef.current = true; }}
                onMouseDown={() => { isUserScrollingMonthRef.current = true; }}
                onWheel={() => { isUserScrollingMonthRef.current = true; }}
                className="w-full h-full overflow-y-auto snap-y snap-mandatory py-[68px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {months.map((m) => {
                  const isSelected = m === selectedMonth;
                  return (
                    <div
                      key={m}
                      style={{ height: `${ITEM_HEIGHT}px` }}
                      onClick={() => handleSelectMonth(m)}
                      className={`flex items-center justify-center snap-center text-sm tabular-nums font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400 text-lg scale-110 font-bold'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {m}月
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Target Preview Display */}
          <div className="mt-4 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 w-full text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">移動先: </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {selectedYear}年 {selectedMonth}月
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>移動する</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
