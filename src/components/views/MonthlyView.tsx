import React, { useState, useMemo } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { formatLocalDate, isEventOnDate } from '../../services/dateUtils';
import { computeWeekLayout, hexToRgba } from '../../services/calendarLayout';

interface MonthlyViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const MAX_VISIBLE_LANES = 3; // Maximum visible event lanes per week row

export const MonthlyView: React.FC<MonthlyViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevMonth,
  onNextMonth,
}) => {
  const { filteredEvents, moveEventDate } = useEvents();
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: onNextMonth,
    onSwipeRight: onPrevMonth,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // First day of current month
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sun

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Grid cells (total 35 or 42 cells)
  const days: { date: Date; isCurrentMonth: boolean }[] = useMemo(() => {
    const list: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month trailing days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      list.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month leading days to complete week rows
    const remaining = (7 - (list.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      list.push({
        date: new Date(year, month + 1, n),
        isCurrentMonth: false,
      });
    }
    return list;
  }, [year, month, firstDayOfWeek, daysInMonth]);

  // Group into 7-day weeks
  const weeks = useMemo(() => {
    const rows: { date: Date; isCurrentMonth: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [days]);

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDateStr !== dateStr) {
      setDragOverDateStr(dateStr);
    }
  };

  const handleDragLeave = () => {
    setDragOverDateStr(null);
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDateStr(null);
    const eventId = e.dataTransfer.getData('text/plain');
    if (eventId) {
      moveEventDate(eventId, targetDateStr);
    }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="flex-1 flex flex-col h-full w-full select-none bg-slate-50 dark:bg-slate-900 overflow-hidden"
    >
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-center py-1.5 shrink-0">
        {weekdays.map((w, idx) => (
          <div
            key={w}
            className={`text-xs font-semibold ${
              idx === 0
                ? 'text-rose-500'
                : idx === 6
                ? 'text-blue-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Week Rows Grid */}
      <div className="flex-1 flex flex-col divide-y divide-slate-200/70 dark:divide-slate-800/80 overflow-hidden">
        {weeks.map((week, weekIdx) => {
          const weekDates = week.map((w) => w.date);
          const weekLayout = computeWeekLayout(filteredEvents, weekDates);

          return (
            <div
              key={weekIdx}
              className="flex-1 relative flex flex-col min-h-0 bg-white dark:bg-slate-900"
            >
              {/* Layer 1: Background 7-Day Columns (Headers, Dates, Holidays, Drop Targets) */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {week.map(({ date, isCurrentMonth }, colIdx) => {
                  const holiday = getJapaneseHoliday(date);
                  const dayNum = date.getDate();
                  const dayOfWeek = date.getDay();
                  const dateStr = formatLocalDate(date);

                  const isCurrentToday = isToday(date);
                  const isOverThisDay = dragOverDateStr === dateStr;

                  // Count hidden events if exceeding MAX_VISIBLE_LANES on this day
                  const dayEvents = filteredEvents.filter((ev) => isEventOnDate(ev, dateStr));
                  const visibleCountOnDay = weekLayout.segments.filter(
                    (seg) =>
                      seg.startCol <= colIdx &&
                      seg.endCol >= colIdx &&
                      seg.lane < MAX_VISIBLE_LANES
                  ).length;
                  const hiddenCountOnDay = Math.max(0, dayEvents.length - visibleCountOnDay);

                  return (
                    <div
                      key={colIdx}
                      onClick={() => onDateClick(date)}
                      onDragOver={(e) => handleDragOver(e, dateStr)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, dateStr)}
                      className={`border-r border-slate-200/50 dark:border-slate-800/60 p-1 flex flex-col justify-between pointer-events-auto cursor-pointer transition-colors ${
                        !isCurrentMonth
                          ? 'opacity-35 bg-slate-50/50 dark:bg-slate-950/40'
                          : 'bg-white dark:bg-slate-900'
                      } ${isCurrentToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''} ${
                        isOverThisDay
                          ? 'bg-blue-100/90 dark:bg-blue-900/50 ring-2 ring-blue-500 z-10'
                          : ''
                      }`}
                    >
                      {/* Day Number & Holiday Header */}
                      <div className="flex items-center justify-between select-none pointer-events-none mb-1">
                        <span
                          className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                            isCurrentToday
                              ? 'bg-blue-600 text-white shadow-xs'
                              : holiday || dayOfWeek === 0
                              ? 'text-rose-500'
                              : dayOfWeek === 6
                              ? 'text-blue-500'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {dayNum}
                        </span>

                        {holiday && (
                          <span
                            className="text-[9px] text-rose-500 font-medium truncate max-w-[56px] sm:max-w-[90px] leading-tight"
                            title={holiday}
                          >
                            {holiday}
                          </span>
                        )}
                      </div>

                      {/* "+N More" Indicator if events exceed MAX_VISIBLE_LANES */}
                      {hiddenCountOnDay > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onDateClick(date);
                          }}
                          className="text-[9px] text-slate-500 dark:text-slate-400 font-medium hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer hover:underline self-start px-0.5"
                        >
                          他 {hiddenCountOnDay} 件
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Layer 2: Spanning Events Overlay (Banners and Chips) */}
              <div className="relative mt-7 flex-1 pointer-events-none overflow-hidden">
                {weekLayout.segments.map((seg) => {
                  if (seg.lane >= MAX_VISIBLE_LANES) return null;

                  const {
                    event,
                    startCol,
                    span,
                    lane,
                    isStartsThisWeek,
                    isEndsThisWeek,
                    isAllDayOrMultiDay,
                  } = seg;

                  const leftPercent = (startCol / 7) * 100;
                  const widthPercent = (span / 7) * 100;
                  const topPx = lane * 21;
                  const rawColor = event.backgroundColor || '#039be5';

                  if (isAllDayOrMultiDay || span > 1) {
                    // Spanning Banner for Multi-Day or All-Day
                    return (
                      <div
                        key={`${event.id}-${startCol}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', event.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        style={{
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          top: `${topPx}px`,
                          height: '19px',
                          backgroundColor: rawColor,
                        }}
                        className={`absolute pointer-events-auto flex items-center px-1.5 text-[10px] font-medium text-white shadow-2xs truncate cursor-grab active:cursor-grabbing hover:brightness-105 transition-all select-none ${
                          isStartsThisWeek ? 'rounded-l-md' : 'rounded-l-none'
                        } ${isEndsThisWeek ? 'rounded-r-md' : 'rounded-r-none'}`}
                        title={event.summary}
                      >
                        {!isStartsThisWeek && (
                          <span className="mr-0.5 text-[8px] opacity-75">◀</span>
                        )}
                        <span className="truncate">{event.summary || '(予定なし)'}</span>
                        {!isEndsThisWeek && (
                          <span className="ml-auto pl-0.5 text-[8px] opacity-75">▶</span>
                        )}
                      </div>
                    );
                  }

                  // Single-Day Timed Event Chip (Higher contrast for visibility, time hidden as per user request to maximize title space)
                  const bgColorLight = hexToRgba(rawColor, 0.22);
                  const borderColorLight = hexToRgba(rawColor, 0.55);

                  return (
                    <div
                      key={`${event.id}-${startCol}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', event.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      style={{
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        top: `${topPx}px`,
                        height: '19px',
                        backgroundColor: bgColorLight,
                        borderColor: borderColorLight,
                      }}
                      className="absolute pointer-events-auto flex items-center gap-1 px-1.5 text-[10px] font-medium text-slate-800 dark:text-slate-100 rounded-md border shadow-2xs truncate cursor-grab active:cursor-grabbing hover:brightness-95 dark:hover:brightness-110 transition-all select-none"
                      title={event.summary}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: rawColor }}
                      />
                      <span className="truncate">{event.summary || '(予定なし)'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
