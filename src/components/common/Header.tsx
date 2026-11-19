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
  CalendarRange,
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
    { type: 'timegrid', label: '週枠', icon: <CalendarRange className="w-3.5 h-3.5" /> },
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
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 pt-safe px-2.5 sm:px-4 py-1.5 z-30 shrink-0 transition-colors">
      <div className="flex items-center justify-between gap-1 sm:gap-3 max-w-7xl mx-auto">
        {/* Left: Month Year Display & Date Navigation (＜ 2026年11月 ＞) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
          <button
            onClick={onToday}
            className="px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 shrink-0 shadow-2xs"
            title="今日へ移動"
          >
            今日
          </button>

          {/* ＜ 2026年11月 ＞ Navigation Group */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onPrev}
              className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
              aria-label="前へ"
              title="前へ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month & Year Title: Clickable Drum Roll Trigger */}
            <button
              type="button"
              onClick={onOpenYearMonthPicker}
              className="px-1.5 sm:px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer text-center"
              title="タップして年月をドラムロールで選択"
            >
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:white tabular-nums whitespace-nowrap">
                {year}年{month}月
              </h1>
            </button>

            <button
              onClick={onNext}
              className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
              aria-label="次へ"
              title="次へ"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: View Switcher */}
        {/* On Mobile: Single Compact Dropdown Pill to save header space */}
        <div className="relative shrink-0" ref={viewMenuRef}>
          <button
            onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
            className="sm:hidden flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition shadow-2xs"
            title="カレンダー表示形式を切り替え"
          >
            {currentViewOption.icon}
            <span>{currentViewOption.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Mobile Dropdown Menu */}
          {isViewMenuOpen && (
            <div className="sm:hidden absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 w-32 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-lg transition-all ${
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

        {/* Right: Quick Action icons (Search & Settings, Theme moved to Settings) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenSearch}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="全期間予定検索"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenArrowSettings}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="設定（テーマ・カレンダー・デザイン）"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
