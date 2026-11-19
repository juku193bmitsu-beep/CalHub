import React, { useRef, useState, useEffect } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { CalendarEvent } from '../../types/calendar';
import { VerticalDayRow } from './VerticalDayRow';
import { MultiDayArrowCanvas } from './MultiDayArrowCanvas';
import { usePinchZoom } from '../../hooks/usePinchZoom';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { suppressNextClicks } from '../../services/gestureUtils';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import {
  formatLocalDate,
  isEventOnDate,
  getEventStartDateStr,
  getEventEndDateInclusiveStr,
} from '../../services/dateUtils';

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
  const { arrowSettings, showZoomControls } = useCalendar();

  const [isZoomExpanded, setIsZoomExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12
  const daysInMonth = new Date(year, month, 0).getDate();

  // Measure container height to calculate 1-screen fit row height
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pinch zoom hook
  const {
    zoom,
    containerRef: pinchRef,
    resetZoom,
    zoomIn,
    zoomOut,
  } = usePinchZoom({
    minZoom: 1.0,
    maxZoom: 2.8,
    initialZoom: 1.0,
  });

  // Swipe for month change (with direction locking, speed/distance hybrid & safeguards)
  const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = useSwipeNavigation({
    onSwipeLeft: onNextMonth,
    onSwipeRight: onPrevMonth,
    disabled: zoom > 1.25, // Lock horizontal swipe when zoomed in to avoid accidental flips
  });

  // Handle scroll to suppress accidental clicks during or immediately after vertical scrolling
  const handleScroll = () => {
    suppressNextClicks(220);
  };

  // Calculate base row height so all days fit without scroll at zoom 1.0
  const baseRowHeight = Math.max(22, Math.floor(containerHeight / daysInMonth));
  const effectiveRowHeight = Math.floor(baseRowHeight * zoom);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === currentDate.getMonth();
  const todayDateNum = today.getDate();

  // Generate days array
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    return new Date(year, month - 1, i + 1);
  });

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        pinchRef.current = el;
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onScroll={handleScroll}
      className="relative flex-1 w-full h-full overflow-y-auto overflow-x-hidden select-none bg-white dark:bg-slate-900"
    >
      <div className="relative min-w-full pb-20">
        {/* Multi-day arrow SVG layer */}
        <MultiDayArrowCanvas
          events={filteredEvents}
          year={year}
          month={month}
          daysInMonth={daysInMonth}
          rowHeight={effectiveRowHeight}
          arrowSettings={arrowSettings}
          onEventClick={onEventClick}
        />

        {/* Day rows list */}
        {days.map((date) => {
          const dayNum = date.getDate();
          const isToday = isCurrentMonth && dayNum === todayDateNum;
          const dateStr = formatLocalDate(date);

          // Find events for this day
          const dayEvents = filteredEvents.filter((e) => isEventOnDate(e, dateStr));

          // Check if a multi-day arrow is passing through this day (strictly day 2 to end)
          const hasArrowPassing = filteredEvents.some((e) => {
            const startStr = getEventStartDateStr(e);
            const endStr = getEventEndDateInclusiveStr(e);
            if (!startStr || !endStr || startStr === endStr) return false;
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

      {/* Floating Zoom Controls: Collapsible & Non-intrusive */}
      {showZoomControls && (
        <div className="fixed right-2.5 bottom-16 sm:bottom-18 z-20">
          {!isZoomExpanded ? (
            <button
              type="button"
              onClick={() => setIsZoomExpanded(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/75 dark:bg-slate-800/75 hover:bg-white/95 dark:hover:bg-slate-800/95 backdrop-blur-md shadow-md border border-slate-200/80 dark:border-slate-700/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 opacity-60 hover:opacity-100 transition active:scale-95 cursor-pointer text-xs"
              title="拡大・縮小ツールを開く"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              {zoom > 1.05 && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-1.5 py-1 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={zoomIn}
                className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-90"
                title="拡大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoom > 1.05 && (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition active:scale-90"
                  title="全体表示にリセット"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= 1.0}
                className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition active:scale-90 disabled:opacity-30"
                title="縮小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={() => setIsZoomExpanded(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition active:scale-90"
                title="閉じる"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
