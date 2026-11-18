import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sliders,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  Columns3,
  AlignJustify,
  Grid3X3,
} from 'lucide-react';
import { CalendarViewType } from '../../types/view';
import { useCalendar } from '../../contexts/CalendarContext';

interface HeaderProps {
  currentDate: Date;
  viewType: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSearch: () => void;
  onOpenArrowSettings: () => void;
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
}) => {
  const { theme, toggleTheme } = useCalendar();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const viewOptions: { type: CalendarViewType; label: string; icon: React.ReactNode }[] = [
    { type: 'vertical', label: '縦型', icon: <AlignJustify className="w-3.5 h-3.5" /> },
    { type: 'month', label: '月間', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { type: 'week', label: '週間', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { type: 'compare', label: '並列', icon: <Columns3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 pt-safe px-3 py-2 z-30 shrink-0 transition-colors">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Month Year Display & Navigation */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 shrink-0"
            title="今日へ移動"
          >
            今日
          </button>
          
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrev}
              className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
              aria-label="前へ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
              aria-label="次へ"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-baseline gap-1.5 ml-1">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {year}年{month}月
            </span>
          </div>
        </div>

        {/* Center/Right: View Switcher Segmented Control */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
          {viewOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onViewChange(opt.type)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewType === opt.type
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {opt.icon}
              <span className="hidden xs:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Action icons */}
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
            title="矢印デザイン設定"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="テーマ切り替え"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
