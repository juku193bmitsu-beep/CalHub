import React from 'react';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';
import { getJapaneseHoliday } from '../../constants/holidays';
import { useClipboard } from '../../contexts/ClipboardContext';
import { useEvents } from '../../contexts/EventContext';

interface VerticalDayRowProps {
  date: Date;
  events: CalendarEvent[];
  rowHeight: number;
  isToday: boolean;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const VerticalDayRow: React.FC<VerticalDayRowProps> = ({
  date,
  events,
  rowHeight,
  isToday,
  onDateClick,
  onEventClick,
}) => {
  const { copiedEvent } = useClipboard();
  const { addEvent } = useEvents();

  const dayNum = date.getDate();
  const dayOfWeek = date.getDay(); // 0: Sun, 6: Sat
  const holiday = getJapaneseHoliday(date);

  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isHoliday = !!holiday;

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const weekdayStr = weekdayNames[dayOfWeek];

  const handleRowClick = () => {
    // If copying, paste here!
    if (copiedEvent) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const targetDateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

      if (copiedEvent.isAllDay || copiedEvent.start.date) {
        addEvent({
          ...copiedEvent,
          start: { date: targetDateStr },
          end: { date: targetDateStr },
        });
      } else {
        const oldStart = new Date(copiedEvent.start.dateTime || '');
        const oldEnd = new Date(copiedEvent.end.dateTime || '');
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        const newStart = new Date(oldStart);
        newStart.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        const newEnd = new Date(newStart.getTime() + durationMs);

        addEvent({
          ...copiedEvent,
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        });
      }
      return;
    }

    onDateClick(date);
  };

  // Determine weekday color
  let dayColorClass = 'text-slate-800 dark:text-slate-200';
  let badgeClass = 'text-slate-500 dark:text-slate-400';

  if (isSunday || isHoliday) {
    dayColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
    badgeClass = 'text-rose-500 dark:text-rose-400 font-medium';
  } else if (isSaturday) {
    dayColorClass = 'text-blue-600 dark:text-blue-400 font-bold';
    badgeClass = 'text-blue-500 dark:text-blue-400 font-medium';
  }

  // Filter events: in vertical view, multi-day non-start days don't repeat title chip
  const pad = (n: number) => n.toString().padStart(2, '0');
  const thisDateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(dayNum)}`;

  const visibleChips = events.filter((ev) => {
    const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
    const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10);
    const isMultiDay = startStr && endStr && startStr !== endStr;

    // If multi-day, only render chip on start day
    if (isMultiDay && startStr !== thisDateStr) {
      return false;
    }
    return true;
  });

  return (
    <div
      onClick={handleRowClick}
      style={{ height: `${rowHeight}px` }}
      className={`group relative flex items-center border-b border-slate-200/50 dark:border-slate-800/60 px-2 cursor-pointer transition-colors active:bg-blue-50/50 dark:active:bg-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
        isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
      }`}
    >
      {/* Date Indicator (Left Column) */}
      <div className="flex items-center gap-1.5 w-[68px] shrink-0 select-none">
        <span
          className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
            isToday
              ? 'bg-blue-600 text-white shadow-sm'
              : dayColorClass
          }`}
        >
          {dayNum}
        </span>
        <span className={`text-[11px] ${badgeClass}`}>{weekdayStr}</span>
        {holiday && (
          <span className="hidden sm:inline text-[9px] text-rose-500 dark:text-rose-400 truncate max-w-[45px]">
            {holiday}
          </span>
        )}
      </div>

      {/* Events Lane (Right Column) */}
      <div className="flex-1 flex items-center gap-1.5 overflow-hidden pl-1 min-w-0">
        {visibleChips.slice(0, 3).map((event) => (
          <EventChip
            key={event.id}
            event={event}
            onOpenDetail={onEventClick}
            isCompact={rowHeight < 32}
          />
        ))}

        {visibleChips.length > 3 && (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
            +{visibleChips.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};
