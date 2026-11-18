import React from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { Check } from 'lucide-react';

export const FilterBar: React.FC = () => {
  const {
    calendars,
    visibleCalendarIds,
    toggleCalendarVisibility,
    setAllCalendarsVisible,
  } = useCalendar();

  const isAllSelected = calendars.every((c) => visibleCalendarIds.has(c.id));

  return (
    <div
      className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/60 dark:border-slate-800/80 px-3 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-1.5 z-20 shrink-0"
      onTouchStart={(e) => e.stopPropagation()} // Prevent monthly swipe trigger when scrolling filters
    >
      {/* "All" button */}
      <button
        onClick={() => setAllCalendarsVisible(!isAllSelected)}
        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all shrink-0 flex items-center gap-1 border ${
          isAllSelected
            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }`}
      >
        <span>すべて</span>
      </button>

      {/* Individual Calendar Filter Pills */}
      {calendars.map((cal) => {
        const isSelected = visibleCalendarIds.has(cal.id);
        return (
          <button
            key={cal.id}
            onClick={() => toggleCalendarVisibility(cal.id)}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border active:scale-95 ${
              isSelected
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: cal.backgroundColor }}
            >
              {isSelected && <Check className="w-2 h-2 text-white stroke-[3]" />}
            </span>
            <span className="truncate max-w-[120px]">{cal.summary}</span>
          </button>
        );
      })}
    </div>
  );
};
