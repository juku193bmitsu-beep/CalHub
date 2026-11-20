import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Sliders,
  Calendar as CalendarIcon,
  Columns3,
  AlignJustify,
  Grid3X3,
} from 'lucide-react';
import { CalendarViewType } from '../../types/view';

interface HeaderProps {
  currentDate: Date;
  viewType: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSearch: () => void;
  onOpenArrowSettings: () => void;
  onOpenYearMonthPicker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  viewType,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onOpenSearch,
  onOpenArrowSettings,
  onOpenYearMonthPicker,
}) => {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const viewOptions: { type: CalendarViewType; label: string; icon: React.ReactNode }[] = [
    { type: 'vertical', label: '縦型', icon: <AlignJustify className="w-3.5 h-3.5" /> },
    { type: 'month', label: '月間', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { type: 'week', label: '週間', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { type: 'compare', label: '並列', icon: <Columns3 className="w-3.5 h-3.5" /> },
  ];

  const currentViewOption = viewOptions.find((v) => v.type === viewType) || viewOptions[0];

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    if (isViewMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewMenuOpen]);

  return (
    <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 pb-safe pt-2 sm:py-3.5 px-2 sm:px-5 z-30 shrink-0 transition-colors shadow-lg">
      <div className="flex items-center justify-between gap-1 sm:gap-3 max-w-7xl mx-auto w-full">
        {/* Left: Month Year Display & Date Navigation (＜ 2026年11月 ＞) */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={onPrev}
            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
            aria-label="前へ"
            title="前へ"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 h-5" />
          </button>

          {/* Month & Year Title: Clickable Drum Roll Trigger */}
          <button
            type="button"
            onClick={onOpenYearMonthPicker}
            className="px-1.5 sm:px-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer text-center"
            title="タップして年月をドラムロールで選択"
          >
            <h1 className="text-sm sm:text-lg md:text-xl font-bold sm:font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
              {year}年{month}月
            </h1>
          </button>

          <button
            onClick={onNext}
            className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
            aria-label="次へ"
            title="次へ"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 h-5" />
          </button>
        </div>

        {/* Center: "今日" Button - Prominently Centered for Easy Thumb Reach */}
        <div className="flex items-center justify-center shrink-0">
          <button
            onClick={onToday}
            className="px-2.5 sm:px-5 py-1 sm:py-1.5 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 transition active:scale-90 shadow-2xs"
            title="今日へ移動"
          >
            今日
          </button>
        </div>

        {/* Right: View Switcher & Action Icons */}
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          {/* View Switcher */}
          {/* On Mobile: Single Compact Dropdown Pill to save header space */}
          <div className="relative shrink-0" ref={viewMenuRef}>
            <button
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="sm:hidden flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition shadow-2xs"
              title="カレンダー表示形式を切り替え"
            >
              {currentViewOption.icon}
              <span>{currentViewOption.label}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Mobile Dropdown Menu (Opens Upwards for Bottom Bar) */}
            {isViewMenuOpen && (
              <div className="sm:hidden absolute bottom-full mb-2 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl py-1.5 w-36 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                {viewOptions.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      onViewChange(opt.type);
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition ${
                      viewType === opt.type
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* On Desktop/Tablet: Clean Segmented Control */}
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
              {viewOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => onViewChange(opt.type)}
                  title={opt.label}
                  className={`flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    viewType === opt.type
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Action icons (Search & Settings) */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="全期間予定検索"
          >
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          <button
            onClick={onOpenArrowSettings}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="設定（テーマ・カレンダー・デザイン）"
          >
            <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
