import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';
import { getJapaneseHoliday } from '../../constants/holidays';
import {
  formatLocalDate,
  getEventStartDateStr,
  isMultiDayEvent,
  compareEventsByDisplayOrder,
} from '../../services/dateUtils';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
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
  const { verticalFontSize, verticalFontWeight } = useCalendar();
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
  // In vertical view, multi-day non-start days don't repeat the title chip (covered by vertical arrow).
  // Multi-day start events (where arrow line originates) MUST be strictly sorted to the FIRST (leftmost) slot
  // so the arrow emerges directly beneath the chip at x=76px without colliding or misalignment!
  const visibleChips = events
    .filter((ev) => {
      const isMulti = isMultiDayEvent(ev);
      const startStr = getEventStartDateStr(ev);

      // If multi-day, only render chip on start day (days 2..end are covered by vertical arrow line)
      if (isMulti && startStr !== thisDateStr) {
        return false;
      }
      return true;
    })
    .sort(compareEventsByDisplayOrder);

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
          ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-[3.5px] border-l-blue-600 dark:border-l-blue-400 pl-[calc(0.5rem-3.5px)] font-medium border-y border-y-blue-200/70 dark:border-y-blue-800/70'
          : ''
      }`}
    >
      {/* Date Indicator (Left Column: fixed 58px width) */}
      <div className="flex items-center gap-1 w-[58px] shrink-0 select-none">
        <span
          className={`w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${
            verticalFontSize === 'xlarge'
              ? 'text-[15px]'
              : verticalFontSize === 'large'
              ? 'text-[13.5px]'
              : 'text-xs'
          } ${
            verticalFontWeight === 'extrabold'
              ? 'font-black'
              : verticalFontWeight === 'bold'
              ? 'font-bold'
              : 'font-semibold'
          } ${
            isToday
              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 dark:ring-blue-600'
              : dayColorClass
          }`}
        >
          {dayNum}
        </span>
        {isToday ? (
          <span
            className={`font-bold text-blue-600 dark:text-blue-400 bg-blue-100/90 dark:bg-blue-900/60 px-1 py-0.2 rounded leading-none ${
              verticalFontSize === 'xlarge' ? 'text-xs' : 'text-[10px]'
            }`}
          >
            今日
          </span>
        ) : (
          <span
            className={`${
              verticalFontSize === 'xlarge'
                ? 'text-[13px]'
                : verticalFontSize === 'large'
                ? 'text-xs'
                : 'text-[11px]'
            } ${
              verticalFontWeight === 'extrabold'
                ? 'font-black'
                : verticalFontWeight === 'bold'
                ? 'font-bold'
                : 'font-medium'
            } ${badgeClass}`}
          >
            {weekdayStr}
          </span>
        )}
      </div>

      {/* Events Lane:
          When arrows pass through on days 2..end, offset by pl-6 to provide clean rail for arrow lines.
          On start days, offset by pl-1 so the chip's anchor dot aligns precisely at x=76px!
          Mobile layout uses CSS Grid (1fr 1fr 1fr auto when badge exists, 3 cols otherwise)
          so 3 chips + badge fill the full width with zero trailing dead space.
      */}
      <div
        className={`flex-1 grid ${
          visibleChips.length > 3
            ? 'grid-cols-[1fr_1fr_1fr_auto]'
            : 'grid-cols-3'
        } sm:flex sm:items-center gap-1 items-center overflow-hidden min-w-0 transition-all ${
          hasArrowPassing ? 'pl-6' : 'pl-1'
        }`}
      >
        {visibleChips.slice(0, 3).map((event) => {
          const isMultiDayStart = isMultiDayEvent(event) && getEventStartDateStr(event) === thisDateStr;

          return (
            <EventChip
              key={event.id}
              event={event}
              onOpenDetail={onEventClick}
              isCompact={rowHeight < 32}
              isDraggable={isDraggable}
              isMultiDayStart={isMultiDayStart}
              className="w-full min-w-0 sm:w-[130px] md:w-[150px] sm:flex-none"
            />
          );
        })}

        {visibleChips.length > 3 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              onDateClick(date);
            }}
            className="flex items-center justify-center shrink-0 h-[20px] px-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded-md shadow-2xs hover:bg-blue-100 dark:hover:bg-blue-900 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title={`他 ${visibleChips.length - 3} 件の予定があります（タップで詳細表示）`}
          >
            +{visibleChips.length - 3}
          </button>
        )}
      </div>
    </div>
  );
};
