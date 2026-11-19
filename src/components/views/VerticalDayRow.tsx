import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';
import { getJapaneseHoliday } from '../../constants/holidays';
import { formatLocalDate } from '../../services/dateUtils';
import { useEvents } from '../../contexts/EventContext';
import { isClickSuppressed, suppressNextClicks, triggerHaptic } from '../../services/gestureUtils';

interface VerticalDayRowProps {
  date: Date;
  events: CalendarEvent[];
  rowHeight: number;
  isToday: boolean;
  hasArrowPassing?: boolean;
  isDraggable?: boolean;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const VerticalDayRow: React.FC<VerticalDayRowProps> = ({
  date,
  events,
  rowHeight,
  isToday,
  hasArrowPassing = false,
  isDraggable = true,
  onDateClick,
  onEventClick,
}) => {
  const { moveEventDate } = useEvents();
  const [isDragOver, setIsDragOver] = useState(false);

  const dayNum = date.getDate();
  const dayOfWeek = date.getDay(); // 0: Sun, 6: Sat
  const holiday = getJapaneseHoliday(date);

  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isHoliday = !!holiday;

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const weekdayStr = weekdayNames[dayOfWeek];

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

  const thisDateStr = formatLocalDate(date);

  // Filter & sort events:
  // In vertical view, multi-day non-start days don't repeat the title chip (covered by arrow).
  // Multi-day start events are strictly sorted to the FIRST slot so that multi-day arrows
  // always emerge cleanly from the primary left rail at x=76px without colliding with single-day events.
  const isMultiDay = (ev: CalendarEvent) => {
    const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
    const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10);
    return !!startStr && !!endStr && startStr !== endStr;
  };

  const visibleChips = events
    .filter((ev) => {
      const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
      const isMulti = isMultiDay(ev);

      // If multi-day, only render chip on start day
      if (isMulti && startStr !== thisDateStr) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aMulti = isMultiDay(a);
      const bMulti = isMultiDay(b);
      if (aMulti && !bMulti) return -1;
      if (!aMulti && bMulti) return 1;
      return 0;
    });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const eventId = e.dataTransfer.getData('text/plain');
    if (eventId) {
      moveEventDate(eventId, thisDateStr);
    }
  };

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchStartTime = useRef<number>(0);
  const touchMoved = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchStartTime.current = Date.now();
    touchMoved.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      touchMoved.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (touchMoved.current) {
      suppressNextClicks(300);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Prevent accidental date click if gesture suppression is active or finger moved during touch
    if (isClickSuppressed() || touchMoved.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const duration = Date.now() - touchStartTime.current;
    if (touchStartPos.current && duration > 450) {
      // Released after a long hold -> suppress
      return;
    }

    triggerHaptic('light');
    onDateClick(date);
  };

  return (
    <div
      onClick={handleRowClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ height: `${rowHeight}px` }}
      className={`group relative flex items-center border-b border-slate-200/50 dark:border-slate-800/60 px-2 cursor-pointer transition-colors active:bg-blue-50/50 dark:active:bg-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
        isDragOver
          ? 'bg-blue-100/80 dark:bg-blue-900/50 border-blue-400 scale-[1.002] z-10 shadow-xs'
          : isToday
          ? 'bg-blue-50/40 dark:bg-blue-950/20'
          : ''
      }`}
    >
      {/* Date Indicator (Left Column: fixed 58px width) */}
      <div className="flex items-center gap-1 w-[58px] shrink-0 select-none">
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
      </div>

      {/* Events Lane:
          When arrows pass through on days 2..end, offset by pl-6 to provide clean rail for arrow lines.
          On start days, offset by pl-1 so the chip's anchor dot aligns precisely at x=76px!
      */}
      <div className={`flex-1 flex items-center gap-1.5 overflow-hidden min-w-0 transition-all ${
        hasArrowPassing ? 'pl-6' : 'pl-1'
      }`}>
        {visibleChips.slice(0, 3).map((event) => {
          const startStr = event.start.date || event.start.dateTime?.slice(0, 10);
          const endStr = event.end.date || event.end.dateTime?.slice(0, 10);
          const isMultiDayStart = !!startStr && !!endStr && startStr !== endStr && startStr === thisDateStr;

          return (
            <EventChip
              key={event.id}
              event={event}
              onOpenDetail={onEventClick}
              isCompact={rowHeight < 32}
              isDraggable={isDraggable}
              isMultiDayStart={isMultiDayStart}
            />
          );
        })}

        {visibleChips.length > 3 && (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
            +{visibleChips.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};
