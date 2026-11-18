import React from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { EventChip } from '../events/EventChip';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';

interface MonthlyViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevMonth,
  onNextMonth,
}) => {
  const { filteredEvents } = useEvents();

  const { onTouchStart, onTouchEnd } = useSwipeNavigation({
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
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete week rows
  const remaining = (7 - (days.length % 7)) % 7;
  for (let n = 1; n <= remaining; n++) {
    days.push({
      date: new Date(year, month + 1, n),
      isCurrentMonth: false,
    });
  }

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div
      onTouchStart={onTouchStart}
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

      {/* Days Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 sm:grid-rows-6 border-b border-slate-200 dark:border-slate-800">
        {days.map(({ date, isCurrentMonth }, idx) => {
          const holiday = getJapaneseHoliday(date);
          const dayNum = date.getDate();
          const dayOfWeek = date.getDay();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(dayNum)}`;

          const dayEvents = filteredEvents.filter((ev) => {
            const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
            const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10) || startStr;
            return dateStr >= (startStr || '') && dateStr <= (endStr || '');
          });

          const isCurrentToday = isToday(date);

          return (
            <div
              key={idx}
              onClick={() => onDateClick(date)}
              className={`border-r border-b border-slate-200/50 dark:border-slate-800/60 p-1 flex flex-col overflow-hidden transition-colors cursor-pointer active:bg-blue-50/50 dark:active:bg-slate-800/50 hover:bg-slate-100/40 dark:hover:bg-slate-800/20 ${
                !isCurrentMonth ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/40' : 'bg-white dark:bg-slate-900'
              } ${isCurrentToday ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-0.5">
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
                  <span className="hidden md:inline text-[9px] text-rose-500 truncate max-w-[50px]">
                    {holiday}
                  </span>
                )}
              </div>

              {/* Event Chips */}
              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onOpenDetail={onEventClick}
                    isCompact
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium px-1">
                    他 {dayEvents.length - 3} 件
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
