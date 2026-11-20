import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { isClickSuppressed, suppressNextClicks, triggerHaptic } from '../../services/gestureUtils';
import { formatLocalDate, isEventOnDate } from '../../services/dateUtils';
import { computeWeekLayout, hexToRgba } from '../../services/calendarLayout';
import { resolveEventTextColor } from '../../services/colorUtils';

interface MonthlyViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const MAX_VISIBLE_LANES = 3;

interface MonthGridProps {
  date: Date;
  filteredEvents: CalendarEvent[];
  onCellClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  dragOverDateStr: string | null;
  onDragOver: (e: React.DragEvent, dateStr: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetDateStr: string) => void;
}

/**
 * Renders the 5-6 week calendar grid for a specific month.
 */
const MonthGrid: React.FC<MonthGridProps> = ({
  date,
  filteredEvents,
  onCellClick,
  onEventClick,
  dragOverDateStr,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const { timedEventStyle, calendars } = useCalendar();
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = useMemo(() => {
    const list: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      list.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    const remaining = (7 - (list.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      list.push({
        date: new Date(year, month + 1, n),
        isCurrentMonth: false,
      });
    }
    return list;
  }, [year, month, firstDayOfWeek, daysInMonth]);

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

  return (
    <div className="h-full w-full flex flex-col divide-y divide-slate-200/70 dark:divide-slate-800/80 overflow-hidden bg-white dark:bg-slate-900 select-none">
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
              {week.map(({ date: cellDate, isCurrentMonth }, colIdx) => {
                const holiday = getJapaneseHoliday(cellDate);
                const dayNum = cellDate.getDate();
                const dayOfWeek = cellDate.getDay();
                const dateStr = formatLocalDate(cellDate);

                const isCurrentToday = isToday(cellDate);
                const isOverThisDay = dragOverDateStr === dateStr;

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
                    onClick={() => onCellClick(cellDate)}
                    onDragOver={(e) => onDragOver(e, dateStr)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, dateStr)}
                    className={`border-r border-slate-200/50 dark:border-slate-800/60 p-1 flex flex-col justify-between pointer-events-auto cursor-pointer transition-colors ${
                      !isCurrentMonth
                        ? 'opacity-35 bg-slate-50/50 dark:bg-slate-950/40'
                        : 'bg-white dark:bg-slate-900'
                    } ${
                      isCurrentToday
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-600 dark:ring-blue-500 rounded-sm z-10 shadow-xs'
                        : ''
                    } ${
                      isOverThisDay
                        ? 'bg-blue-100/90 dark:bg-blue-900/50 ring-2 ring-blue-500 z-10'
                        : ''
                    }`}
                  >
                    {/* Day Number & Holiday Header */}
                    <div className="flex items-center justify-between select-none pointer-events-none mb-1">
                      <span
                        className={`w-5 h-5 flex items-center justify-center text-xs tabular-nums ${
                          isCurrentToday
                            ? 'bg-blue-600 text-white font-extrabold rounded-[4px] shadow-sm ring-1 ring-blue-400 dark:ring-blue-300'
                            : holiday || dayOfWeek === 0
                            ? 'rounded-full font-semibold text-rose-500'
                            : dayOfWeek === 6
                            ? 'rounded-full font-semibold text-blue-500'
                            : 'rounded-full font-semibold text-slate-700 dark:text-slate-300'
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

                    {/* "+N More" Indicator */}
                    {hiddenCountOnDay > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onCellClick(cellDate);
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
                const eventCal = calendars.find((c) => c.id === event.calendarId);
                const isSpanOrAllDay = isAllDayOrMultiDay || span > 1;
                const customTextColor = resolveEventTextColor(event, eventCal, isSpanOrAllDay, rawColor);

                if (isSpanOrAllDay) {
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
                        ...(customTextColor ? { color: customTextColor } : {}),
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

                const isUnderbar = timedEventStyle === 'underbar';
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
                      backgroundColor: isUnderbar ? 'transparent' : bgColorLight,
                      borderColor: isUnderbar ? 'transparent' : borderColorLight,
                      borderBottom: isUnderbar ? `2.5px solid ${rawColor}` : undefined,
                      ...(customTextColor ? { color: customTextColor } : {}),
                    }}
                    className={`absolute pointer-events-auto flex items-center px-1 text-[10px] font-medium text-slate-800 dark:text-slate-100 truncate cursor-grab active:cursor-grabbing hover:brightness-95 dark:hover:brightness-110 transition-all select-none ${
                      isUnderbar ? 'rounded-none' : 'rounded-md border shadow-2xs'
                    }`}
                    title={event.summary}
                  >
                    <span className="truncate">{event.summary || '(予定なし)'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const MonthlyView: React.FC<MonthlyViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevMonth,
  onNextMonth,
}) => {
  const { filteredEvents, moveEventDate } = useEvents();
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 400;
  });

  // Track container width for precise continuous pixel translation
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Compute Adjacent Months for Continuous Carousel
  const prevMonthDate = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [currentDate]);

  const nextMonthDate = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [currentDate]);

  // Touch gesture & continuous drag tracking
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean>(false);
  const isVerticalScrollRef = useRef<boolean>(false);
  const currentOffsetRef = useRef<number>(0);

  const handleCellClick = useCallback(
    (date: Date) => {
      if (isClickSuppressed() || Math.abs(currentOffsetRef.current) > 5) return;
      triggerHaptic('light');
      onDateClick(date);
    },
    [onDateClick]
  );

  const handleSafeEventClick = useCallback(
    (event: CalendarEvent) => {
      if (isClickSuppressed() || Math.abs(currentOffsetRef.current) > 5) return;
      triggerHaptic('light');
      onEventClick(event);
    },
    [onEventClick]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating || e.touches.length > 1) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = false;
    isVerticalScrollRef.current = false;
    currentOffsetRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null || isVerticalScrollRef.current) {
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startXRef.current;
    const dy = currentY - startYRef.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Initial direction discrimination
    if (!isHorizontalSwipeRef.current && !isVerticalScrollRef.current && (absDx >= 10 || absDy >= 10)) {
      if (absDy > absDx * 1.4) {
        isVerticalScrollRef.current = true;
        return;
      } else if (absDx > absDy * 1.1) {
        isHorizontalSwipeRef.current = true;
      }
    }

    if (isHorizontalSwipeRef.current) {
      // Finger follows drag with slight resistance at extreme bounds
      suppressNextClicks(350);
      currentOffsetRef.current = dx;
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;

    if (isHorizontalSwipeRef.current) {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startXRef.current;
      const duration = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = Math.abs(dx) / duration;

      suppressNextClicks(400);

      const threshold = containerWidth * 0.18; // 18% width threshold for page turn
      const isQuickFlick = Math.abs(dx) > 30 && velocity > 0.32 && duration < 320;

      if ((dx < -threshold || (dx < -30 && isQuickFlick)) && !isAnimating) {
        // Swipe Left -> Next Month
        setIsAnimating(true);
        setDragOffset(-containerWidth);
        triggerHaptic('light');

        setTimeout(() => {
          onNextMonth();
          setDragOffset(0);
          currentOffsetRef.current = 0;
          setIsAnimating(false);
        }, 260);
      } else if ((dx > threshold || (dx > 30 && isQuickFlick)) && !isAnimating) {
        // Swipe Right -> Prev Month
        setIsAnimating(true);
        setDragOffset(containerWidth);
        triggerHaptic('light');

        setTimeout(() => {
          onPrevMonth();
          setDragOffset(0);
          currentOffsetRef.current = 0;
          setIsAnimating(false);
        }, 260);
      } else {
        // Snap back to current month
        setIsAnimating(true);
        setDragOffset(0);
        currentOffsetRef.current = 0;
        setTimeout(() => {
          setIsAnimating(false);
        }, 220);
      }
    }

    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = false;
    isVerticalScrollRef.current = false;
  };

  const handleTouchCancel = () => {
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = false;
    isVerticalScrollRef.current = false;
    setDragOffset(0);
    currentOffsetRef.current = 0;
    setIsAnimating(false);
  };

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
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="flex-1 flex flex-col h-full w-full select-none bg-slate-50 dark:bg-slate-900 overflow-hidden relative"
    >
      {/* Fixed Sticky Weekday Header Bar */}
      <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs text-center py-1.5 shrink-0 z-20">
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

      {/* 3-Month Continuous Sliding Viewport */}
      <div className="flex-1 overflow-hidden relative w-full h-full">
        <div
          style={{
            transform: `translateX(calc(-33.3333% + ${dragOffset}px))`,
            transition: isAnimating
              ? 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
            width: '300%',
          }}
          className="flex h-full will-change-transform"
        >
          {/* Panel 1: Previous Month (Smoothly reveals from left) */}
          <div className="w-1/3 h-full border-r border-slate-200/50 dark:border-slate-800/50">
            <MonthGrid
              date={prevMonthDate}
              filteredEvents={filteredEvents}
              onCellClick={handleCellClick}
              onEventClick={handleSafeEventClick}
              dragOverDateStr={dragOverDateStr}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>

          {/* Panel 2: Current Active Month */}
          <div className="w-1/3 h-full shadow-xs z-10">
            <MonthGrid
              date={currentDate}
              filteredEvents={filteredEvents}
              onCellClick={handleCellClick}
              onEventClick={handleSafeEventClick}
              dragOverDateStr={dragOverDateStr}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>

          {/* Panel 3: Next Month (Smoothly enters from right) */}
          <div className="w-1/3 h-full border-l border-slate-200/50 dark:border-slate-800/50">
            <MonthGrid
              date={nextMonthDate}
              filteredEvents={filteredEvents}
              onCellClick={handleCellClick}
              onEventClick={handleSafeEventClick}
              dragOverDateStr={dragOverDateStr}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
