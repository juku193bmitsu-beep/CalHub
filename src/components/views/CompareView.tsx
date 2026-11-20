import React, { useState } from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';
import { getJapaneseHoliday } from '../../constants/holidays';
import { formatLocalDate, isEventOnDate, compareEventsByDisplayOrder } from '../../services/dateUtils';
import { isClickSuppressed, suppressNextClicks, triggerHaptic } from '../../services/gestureUtils';
import { Calendar } from 'lucide-react';

interface CompareViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
}) => {
  const { calendars, visibleCalendarIds } = useCalendar();
  const { filteredEvents, moveEventCalendar, moveEventDate } = useEvents();
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // NOTE: スワイプによる月切り替えは、横スクロールとの競合事故を防ぐため並列画面では廃止
  const handleScroll = () => {
    suppressNextClicks(200);
  };

  const handleCellClick = (date: Date) => {
    if (isClickSuppressed()) return;
    triggerHaptic('light');
    onDateClick(date);
  };

  // Active calendars to compare
  const activeCalendars = calendars.filter((c) => visibleCalendarIds.has(c.id));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === currentDate.getMonth();
  const todayDateNum = today.getDate();

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData('text/plain', eventId);
    setDraggedEventId(eventId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCalendarId: string, targetDateStr: string) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain') || draggedEventId;
    if (eventId) {
      moveEventCalendar(eventId, targetCalendarId);
      moveEventDate(eventId, targetDateStr);
    }
    setDraggedEventId(null);
  };

  if (activeCalendars.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-slate-900 select-none">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
          表示するカレンダーが選択されていません
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          右下の「設定」からカレンダーのチェックをオンにしてください
        </p>
      </div>
    );
  }

  return (
    <div
      onScroll={handleScroll}
      className="flex-1 w-full h-full overflow-auto select-none bg-white dark:bg-slate-900"
    >
      <div className="min-w-max inline-block">
        {/* Sticky Header Row */}
        <div className="sticky top-0 z-20 flex border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs">
          {/* Top-Left Corner: Sticky Date Header */}
          <div className="sticky left-0 z-30 w-16 shrink-0 py-2.5 text-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]">
            日付
          </div>

          {/* Calendar Category Column Headers */}
          <div className="flex">
            {activeCalendars.map((cal) => (
              <div
                key={cal.id}
                className="w-40 sm:w-48 shrink-0 py-2.5 px-2.5 text-center border-r border-slate-200/70 dark:border-slate-800 flex items-center justify-center gap-1.5"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
                <span
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                  title={cal.summary}
                >
                  {cal.summary}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Rows */}
        <div className="flex flex-col">
          {days.map((d) => {
            const dateObj = new Date(year, month - 1, d);
            const dayOfWeek = dateObj.getDay();
            const holiday = getJapaneseHoliday(dateObj);
            const isSun = dayOfWeek === 0;
            const isSat = dayOfWeek === 6;
            const isHoliday = !!holiday;
            const isToday = isCurrentMonth && d === todayDateNum;
            const dateStr = formatLocalDate(dateObj);

            return (
              <div
                key={d}
                onClick={() => handleCellClick(dateObj)}
                className={`flex border-b border-slate-200/50 dark:border-slate-800/50 min-h-[48px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                  isToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                }`}
              >
                {/* Sticky Left: Date Indicator */}
                <div
                  className={`sticky left-0 z-10 w-16 shrink-0 py-1.5 px-1 flex flex-col items-center justify-center border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)] ${
                    isToday
                      ? 'bg-blue-50/90 dark:bg-blue-950/70 border-l-[3.5px] border-l-blue-600 dark:border-l-blue-400 pl-[calc(0.25rem-3.5px)] font-medium'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-1 leading-none">
                    <span
                      className={`text-xs tabular-nums font-bold ${
                        isToday
                          ? 'w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs'
                          : isSun || isHoliday
                          ? 'text-rose-600 dark:text-rose-400'
                          : isSat
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {d}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        isSun || isHoliday
                          ? 'text-rose-500'
                          : isSat
                          ? 'text-blue-500'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {weekdayNames[dayOfWeek]}
                    </span>
                  </div>

                  {holiday && (
                    <span
                      className="text-[9px] text-rose-500 font-medium truncate max-w-[56px] leading-tight mt-0.5"
                      title={holiday}
                    >
                      {holiday}
                    </span>
                  )}
                </div>

                {/* Each Calendar Lane */}
                <div className="flex">
                  {activeCalendars.map((cal) => {
                    const eventsInCell = filteredEvents
                      .filter((ev) => {
                        if (ev.calendarId !== cal.id) return false;
                        return isEventOnDate(ev, dateStr);
                      })
                      .sort(compareEventsByDisplayOrder);

                    return (
                      <div
                        key={cal.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, cal.id, dateStr)}
                        className="w-40 sm:w-48 shrink-0 p-1 border-r border-slate-200/40 dark:border-slate-800/40 flex flex-col gap-1 overflow-hidden transition-colors hover:bg-blue-50/20"
                      >
                        {eventsInCell.map((ev) => (
                          <div
                            key={ev.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, ev.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-grab active:cursor-grabbing w-full min-w-0 max-w-full"
                          >
                            <EventChip
                              event={ev}
                              onOpenDetail={onEventClick}
                              isCompact
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
