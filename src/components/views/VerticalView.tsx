import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { CalendarEvent } from '../../types/calendar';
import { ArrowDesignSettings } from '../../types/settings';
import { VerticalDayRow } from './VerticalDayRow';
import { MultiDayArrowCanvas } from './MultiDayArrowCanvas';
import { usePinchZoom } from '../../hooks/usePinchZoom';
import { suppressNextClicks, triggerHaptic } from '../../services/gestureUtils';
import {
  formatLocalDate,
  isEventOnDate,
  getEventStartDateStr,
  getEventEndDateInclusiveStr,
  isMultiDayEvent,
  addMonthsSafe,
} from '../../services/dateUtils';

interface VerticalMonthPanelProps {
  targetDate: Date;
  effectiveRowHeight: number;
  filteredEvents: CalendarEvent[];
  arrowSettings: ArrowDesignSettings;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onScroll?: () => void;
}

const VerticalMonthPanel: React.FC<VerticalMonthPanelProps> = React.memo(
  ({
    targetDate,
    effectiveRowHeight,
    filteredEvents,
    arrowSettings,
    onDateClick,
    onEventClick,
    onScroll,
  }) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() === targetDate.getMonth();
    const todayDateNum = today.getDate();

    const days = useMemo(() => {
      return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
    }, [year, month, daysInMonth]);

    return (
      <div
        onScroll={onScroll}
        className="w-full h-full overflow-y-auto overflow-x-hidden relative select-none bg-white dark:bg-slate-900"
      >
        <div className="relative min-w-full pb-0">
          <MultiDayArrowCanvas
            events={filteredEvents}
            year={year}
            month={month}
            daysInMonth={daysInMonth}
            rowHeight={effectiveRowHeight}
            arrowSettings={arrowSettings}
            onEventClick={onEventClick}
          />

          {days.map((date) => {
            const dayNum = date.getDate();
            const isToday = isCurrentMonth && dayNum === todayDateNum;
            const dateStr = formatLocalDate(date);

            const dayEvents = filteredEvents.filter((e) => isEventOnDate(e, dateStr));

            const hasArrowPassing = filteredEvents.some((e) => {
              if (!isMultiDayEvent(e)) return false;
              const startStr = getEventStartDateStr(e);
              const endStr = getEventEndDateInclusiveStr(e);
              if (!startStr || !endStr) return false;
              return dateStr > startStr && dateStr <= endStr;
            });

            return (
              <VerticalDayRow
                key={dateStr}
                date={date}
                events={dayEvents}
                rowHeight={effectiveRowHeight}
                isToday={isToday}
                hasArrowPassing={hasArrowPassing}
                isDraggable={true}
                onDateClick={onDateClick}
                onEventClick={onEventClick}
              />
            );
          })}
        </div>
      </div>
    );
  }
);

interface VerticalViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const VerticalView: React.FC<VerticalViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevMonth,
  onNextMonth,
}) => {
  const { filteredEvents } = useEvents();
  const { arrowSettings } = useCalendar();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Height measurement for fixed 31 days basis
  const [containerHeight, setContainerHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(500, window.innerHeight - 120);
    }
    return 700;
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const h = containerRef.current.clientHeight;
        if (h > 0) {
          setContainerHeight(h);
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pinch zoom hook (zoom with 2 fingers, clean and unobscured without buttons)
  const { zoom, containerRef: pinchRef } = usePinchZoom({
    minZoom: 1.0,
    maxZoom: 2.8,
    initialZoom: 1.0,
  });

  const baseRowHeight = Math.max(22, Math.floor(containerHeight / 31));
  const effectiveRowHeight = Math.floor(baseRowHeight * zoom);

  const prevMonthDate = useMemo(() => addMonthsSafe(currentDate, -1), [currentDate]);
  const nextMonthDate = useMemo(() => addMonthsSafe(currentDate, 1), [currentDate]);

  // Touch gesture state references
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMovedRef = useRef<boolean>(false);
  const isHorizontalSwipeRef = useRef<boolean>(false);
  const isVerticalScrollRef = useRef<boolean>(false);
  const directionLockedRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);

  const handleScroll = useCallback(() => {
    suppressNextClicks(220);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimatingRef.current) return;
      if (e.touches.length > 1) {
        // Multi-touch: allow pinch zoom to take over
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
      if (zoom > 1.15) {
        // Zoomed in: lock horizontal swipe to allow uninterrupted panning
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      startTimeRef.current = Date.now();
      isMovedRef.current = false;
      isHorizontalSwipeRef.current = false;
      isVerticalScrollRef.current = false;
      directionLockedRef.current = false;

      if (trackRef.current) {
        trackRef.current.style.transition = 'none';
      }
    },
    [zoom]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isAnimatingRef.current) return;
    if (startXRef.current === null || startYRef.current === null) return;
    if (e.touches.length > 1) return;
    if (isVerticalScrollRef.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startXRef.current;
    const dy = currentY - startYRef.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Direction locking during early movement (8px to 12px)
    if (!directionLockedRef.current && (absDx >= 8 || absDy >= 8)) {
      if (absDy >= absDx * 1.3) {
        // Clear vertical scroll -> Lock out horizontal swipe
        isVerticalScrollRef.current = true;
        directionLockedRef.current = true;
        return;
      } else if (absDx >= absDy * 1.1 && absDx >= 8) {
        // Clear horizontal swipe -> Lock in continuous carousel swipe
        isHorizontalSwipeRef.current = true;
        directionLockedRef.current = true;
        suppressNextClicks(350);
      }
    }

    if (isHorizontalSwipeRef.current && !isVerticalScrollRef.current) {
      isMovedRef.current = true;
      suppressNextClicks(350);

      // Real-time finger tracking: adjacent month slides into view directly with finger
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${dx}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimatingRef.current) return;
      if (startXRef.current === null || startYRef.current === null) {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      if (!isHorizontalSwipeRef.current || !isMovedRef.current) {
        if (isMovedRef.current) {
          suppressNextClicks(250);
        }
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const dx = endX - startXRef.current;
      const absDx = Math.abs(dx);
      const duration = Date.now() - startTimeRef.current;
      const velocity = absDx / Math.max(1, duration);
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;

      // Dual condition per user preference:
      // 1. サクサクめくれる軽め (Flick): quick flick (velocity >= 0.35 px/ms, distance >= 32px within 300ms)
      const isQuickFlick = duration <= 300 && velocity >= 0.35 && absDx >= 32;
      // 2. 誤めくり防止の標準 (Deliberate Drag): dragged >= 22% of container width (approx 80px)
      const isDeliberateDrag = absDx >= Math.min(100, containerWidth * 0.22);

      const shouldSwitch = isQuickFlick || isDeliberateDrag;

      if (shouldSwitch && trackRef.current) {
        isAnimatingRef.current = true;
        suppressNextClicks(450);
        triggerHaptic('light');

        const isNext = dx < 0;
        const targetTranslate = isNext ? -containerWidth : containerWidth;

        trackRef.current.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        trackRef.current.style.transform = `translateX(${targetTranslate}px)`;

        setTimeout(() => {
          if (trackRef.current) {
            trackRef.current.style.transition = 'none';
            trackRef.current.style.transform = 'translateX(0px)';
          }
          if (isNext) {
            onNextMonth();
          } else {
            onPrevMonth();
          }
          isAnimatingRef.current = false;
        }, 220);
      } else if (trackRef.current) {
        // Bounce back to current month
        trackRef.current.style.transition = 'transform 0.20s ease-out';
        trackRef.current.style.transform = 'translateX(0px)';
      }

      startXRef.current = null;
      startYRef.current = null;
      isMovedRef.current = false;
      isHorizontalSwipeRef.current = false;
      isVerticalScrollRef.current = false;
      directionLockedRef.current = false;
    },
    [onNextMonth, onPrevMonth]
  );

  const handleTouchCancel = useCallback(() => {
    if (trackRef.current && isHorizontalSwipeRef.current) {
      trackRef.current.style.transition = 'transform 0.20s ease-out';
      trackRef.current.style.transform = 'translateX(0px)';
    }
    startXRef.current = null;
    startYRef.current = null;
    isMovedRef.current = false;
    isHorizontalSwipeRef.current = false;
    isVerticalScrollRef.current = false;
    directionLockedRef.current = false;
  }, []);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        pinchRef.current = el;
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="relative flex-1 w-full h-full overflow-hidden select-none bg-white dark:bg-slate-900"
    >
      {/* Continuous 3-Panel Carousel Slider Track */}
      <div
        ref={trackRef}
        className="w-full h-full relative"
        style={{
          transform: 'translateX(0px)',
          willChange: 'transform',
        }}
      >
        {/* Panel -1: Previous Month (positioned just to the left) */}
        <div className="absolute top-0 bottom-0 left-[-100%] w-full h-full">
          <VerticalMonthPanel
            targetDate={prevMonthDate}
            effectiveRowHeight={effectiveRowHeight}
            filteredEvents={filteredEvents}
            arrowSettings={arrowSettings}
            onDateClick={onDateClick}
            onEventClick={onEventClick}
            onScroll={handleScroll}
          />
        </div>

        {/* Panel 0: Current Month (active center screen) */}
        <div className="absolute top-0 bottom-0 left-0 w-full h-full">
          <VerticalMonthPanel
            targetDate={currentDate}
            effectiveRowHeight={effectiveRowHeight}
            filteredEvents={filteredEvents}
            arrowSettings={arrowSettings}
            onDateClick={onDateClick}
            onEventClick={onEventClick}
            onScroll={handleScroll}
          />
        </div>

        {/* Panel +1: Next Month (positioned just to the right) */}
        <div className="absolute top-0 bottom-0 left-[100%] w-full h-full">
          <VerticalMonthPanel
            targetDate={nextMonthDate}
            effectiveRowHeight={effectiveRowHeight}
            filteredEvents={filteredEvents}
            arrowSettings={arrowSettings}
            onDateClick={onDateClick}
            onEventClick={onEventClick}
            onScroll={handleScroll}
          />
        </div>
      </div>
    </div>
  );
};
