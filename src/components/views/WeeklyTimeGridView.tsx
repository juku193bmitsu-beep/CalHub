import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { formatLocalDate, isEventOnDate, getEventStartDateStr, getEventEndDateInclusiveStr } from '../../services/dateUtils';
import { computeWeekLayout, hexToRgba } from '../../services/calendarLayout';
import { isClickSuppressed, suppressNextClicks, triggerHaptic } from '../../services/gestureUtils';

interface WeeklyTimeGridViewProps {
  currentDate: Date;
  onDateClick: (date: Date, initialHour?: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const HOUR_HEIGHT = 56; // Height in px per hour row

export const WeeklyTimeGridView: React.FC<WeeklyTimeGridViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevWeek,
  onNextWeek,
}) => {
  const { filteredEvents, moveEventDate, updateEvent } = useEvents();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = useSwipeNavigation({
    onSwipeLeft: onNextWeek,
    onSwipeRight: onPrevWeek,
  });

  const handleScroll = () => {
    suppressNextClicks(200);
  };

  // Calculate start of current week (Sunday)
  const currentDayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDayOfWeek);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  const todayStr = formatLocalDate(today);

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Scroll to roughly 7:30 AM or current hour on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetHour = Math.max(0, Math.min(20, today.getHours() - 1 || 7));
      scrollContainerRef.current.scrollTop = targetHour * HOUR_HEIGHT;
    }
  }, []);

  // Separate multi-day/all-day events from single-day timed events
  const { allDayAndMultiDayEvents, singleDayTimedEvents } = useMemo(() => {
    const allDayOrMulti: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    filteredEvents.forEach((ev) => {
      const isAllDay = !!ev.isAllDay || (!ev.start.dateTime && !!ev.start.date);
      const s = getEventStartDateStr(ev);
      const e = getEventEndDateInclusiveStr(ev);
      const isMulti = s !== e;

      if (isAllDay || isMulti) {
        allDayOrMulti.push(ev);
      } else {
        timed.push(ev);
      }
    });

    return { allDayAndMultiDayEvents: allDayOrMulti, singleDayTimedEvents: timed };
  }, [filteredEvents]);

  // Compute week layout for spanning all-day and multi-day events
  const weekLayout = useMemo(() => {
    return computeWeekLayout(allDayAndMultiDayEvents, days);
  }, [allDayAndMultiDayEvents, days]);

  // Separate all-day events vs timed events for each day
  const dayData = useMemo(() => {
    return days.map((date) => {
      const dateStr = formatLocalDate(date);
      const timedEvents = singleDayTimedEvents.filter((ev) => isEventOnDate(ev, dateStr));

      return {
        date,
        dateStr,
        timedEvents,
        holiday: getJapaneseHoliday(date),
        isToday: dateStr === todayStr,
      };
    });
  }, [days, singleDayTimedEvents, todayStr]);

  // Keep current time updated every minute
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentWeek = useMemo(() => {
    const todayFormatted = formatLocalDate(now);
    return days.some((d) => formatLocalDate(d) === todayFormatted);
  }, [days, now]);

  // Current time marker position (continuous minutes precision)
  const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = (currentMinutesTotal / 60) * HOUR_HEIGHT;

  const handleCellClick = (date: Date, hour: number) => {
    if (isClickSuppressed()) return;
    triggerHaptic('light');
    const targetDate = new Date(date);
    targetDate.setHours(hour, 0, 0, 0);
    onDateClick(targetDate, hour);
  };

  const handleSafeDateClick = (date: Date) => {
    if (isClickSuppressed()) return;
    triggerHaptic('light');
    onDateClick(date);
  };

  const handleSafeEventClick = (event: CalendarEvent) => {
    if (isClickSuppressed()) return;
    triggerHaptic('light');
    onEventClick(event);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string, dropHour?: number) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    if (!eventId) return;

    if (dropHour !== undefined) {
      // Move to target date with adjusted hour
      const target = filteredEvents.find((ev) => ev.id === eventId);
      if (target && target.start.dateTime && target.end.dateTime) {
        const oldStart = new Date(target.start.dateTime);
        const oldEnd = new Date(target.end.dateTime);
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        const [y, m, d] = targetDateStr.split('-').map(Number);
        const newStart = new Date(y, m - 1, d, dropHour, oldStart.getMinutes());
        const newEnd = new Date(newStart.getTime() + durationMs);

        updateEvent(eventId, {
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        });
      } else {
        moveEventDate(eventId, targetDateStr);
      }
    } else {
      moveEventDate(eventId, targetDateStr);
    }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="flex-1 flex flex-col h-full w-full select-none bg-white dark:bg-slate-900 overflow-hidden"
    >
      {/* 1. Sticky Header: 7 Days & All-Day Event Lane */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shrink-0 shadow-xs">
        {/* Day Column Headers */}
        <div className="flex">
          {/* Time gutter spacer */}
          <div className="w-12 sm:w-14 shrink-0 border-r border-slate-200/60 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400">
            時刻
          </div>

          {/* 7 Days */}
          <div className="flex-1 grid grid-cols-7">
            {dayData.map(({ date, holiday, isToday }, idx) => {
              const dayOfWeek = date.getDay();
              const isSun = dayOfWeek === 0;
              const isSat = dayOfWeek === 6;

              let colorClass = 'text-slate-700 dark:text-slate-300';
              if (isSun || holiday) colorClass = 'text-rose-500 font-bold';
              else if (isSat) colorClass = 'text-blue-500 font-bold';

              return (
                <div
                  key={idx}
                  onClick={() => handleSafeDateClick(date)}
                  className={`py-2 px-1 text-center border-r border-slate-200/50 dark:border-slate-800/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col items-center ${
                    isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <span className={`text-[11px] leading-tight ${colorClass}`}>
                    {weekdayNames[dayOfWeek]}
                  </span>
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold tabular-nums mt-0.5 ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-xs'
                        : colorClass
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* All-Day & Multi-Day Spanning Header Row */}
        {weekLayout.segments.length > 0 && (
          <div className="flex border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            {/* Left gutter label */}
            <div className="w-12 sm:w-14 shrink-0 border-r border-slate-200/60 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-medium select-none">
              終日
            </div>

            {/* 7 Columns Container */}
            <div
              className="flex-1 relative"
              style={{
                height: `${Math.max(1, weekLayout.maxLane) * 23 + 4}px`,
              }}
            >
              {/* Background 7-column grid for drop targets & cell borders */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {dayData.map(({ dateStr }, idx) => (
                  <div
                    key={idx}
                    className="border-r border-slate-200/40 dark:border-slate-800/40 h-full pointer-events-auto"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dateStr)}
                  />
                ))}
              </div>

              {/* Spanning Event Bars Layer */}
              <div className="relative w-full h-full pointer-events-none">
                {weekLayout.segments.map((seg) => {
                  const { event, startCol, span, lane, isStartsThisWeek, isEndsThisWeek } = seg;
                  const leftPercent = (startCol / 7) * 100;
                  const widthPercent = (span / 7) * 100;
                  const topPx = lane * 23 + 2;

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
                        handleSafeEventClick(event);
                      }}
                      style={{
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        top: `${topPx}px`,
                        height: '21px',
                        backgroundColor: event.backgroundColor || '#039be5',
                      }}
                      className={`absolute pointer-events-auto flex items-center px-1.5 text-[11px] font-medium text-white shadow-2xs truncate cursor-grab active:cursor-grabbing hover:brightness-105 transition-all select-none ${
                        isStartsThisWeek ? 'rounded-l-md' : 'rounded-l-none'
                      } ${isEndsThisWeek ? 'rounded-r-md' : 'rounded-r-none'}`}
                      title={event.summary}
                    >
                      {!isStartsThisWeek && <span className="mr-0.5 text-[9px] opacity-75">◀</span>}
                      <span className="truncate">{event.summary || '(予定なし)'}</span>
                      {!isEndsThisWeek && <span className="ml-auto pl-0.5 text-[9px] opacity-75">▶</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Scrollable 24-Hour Time Grid */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        <div className="flex relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Y-Axis: Hour Labels Column (00:00 - 23:00) */}
          <div className="w-12 sm:w-14 shrink-0 border-r border-slate-200/80 dark:border-slate-800 select-none bg-slate-50/60 dark:bg-slate-950/40">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="relative text-right pr-2 text-[10px] text-slate-400 font-medium tabular-nums"
              >
                <span className="-translate-y-2 block">
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* 7 Columns: 24 Hours Time Slots */}
          <div className="flex-1 grid grid-cols-7 relative">
            {/* Background Hour Grid Lines */}
            <div className="absolute inset-0 pointer-events-none">
              {hours.map((h) => (
                <div
                  key={`line-${h}`}
                  style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                  className="absolute inset-x-0 border-b border-slate-100 dark:border-slate-800/60"
                />
              ))}
            </div>

            {/* Current Time Indicator Red Line spanning across ALL 7 columns (Sunday through Saturday) */}
            {isCurrentWeek && (
              <div
                style={{ top: `${currentTimeTop}px` }}
                className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shrink-0 shadow-xs ring-2 ring-white dark:ring-slate-900" />
                <div className="h-[2px] bg-rose-500/95 flex-1 shadow-xs" />
              </div>
            )}

            {/* Day Columns */}
            {dayData.map(({ date, dateStr, timedEvents, isToday }, colIdx) => (
              <div
                key={colIdx}
                onDragOver={handleDragOver}
                className={`relative border-r border-slate-200/40 dark:border-slate-800/40 h-full ${
                  isToday ? 'bg-blue-50/15 dark:bg-blue-950/10' : ''
                }`}
              >
                {/* Clickable 1-hour Slot Targets */}
                {hours.map((h) => (
                  <div
                    key={h}
                    onClick={() => handleCellClick(date, h)}
                    onDrop={(e) => handleDrop(e, dateStr, h)}
                    style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    className="absolute inset-x-0 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-slate-800/30 transition-colors"
                  />
                ))}

                {/* Timed Event Blocks */}
                {timedEvents.map((ev) => {
                  const s = new Date(ev.start.dateTime || '');
                  const e = new Date(ev.end.dateTime || '');
                  const startMinutes = s.getHours() * 60 + s.getMinutes();
                  const durationMinutes = Math.max(
                    20,
                    (e.getTime() - s.getTime()) / (1000 * 60)
                  );

                  const top = (startMinutes / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, (durationMinutes / 60) * HOUR_HEIGHT - 2);

                  const rawColor = ev.backgroundColor || '#039be5';
                  const bgTint = hexToRgba(rawColor, 0.16);
                  const borderCol = hexToRgba(rawColor, 0.35);

                  const timeStr = `${s.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })} - ${e.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}`;

                  return (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={(dragEv) => {
                        dragEv.dataTransfer.setData('text/plain', ev.id);
                        dragEv.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(clickEv) => {
                        clickEv.stopPropagation();
                        handleSafeEventClick(ev);
                      }}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: bgTint,
                        borderColor: borderCol,
                        borderLeftColor: rawColor,
                      }}
                      className="absolute inset-x-0.5 rounded-lg p-1 border border-l-4 shadow-2xs hover:shadow-xs transition-all z-10 overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-105"
                      title={`${ev.summary} (${timeStr})`}
                    >
                      <div className="text-[11px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                        {ev.summary}
                      </div>
                      {height >= 34 && (
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                          {timeStr}
                        </div>
                      )}
                      {height >= 50 && ev.location && (
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          📍 {ev.location}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
