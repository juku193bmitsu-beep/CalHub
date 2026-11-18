import React, { useState } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';

interface WeeklyViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
  onPrevWeek,
  onNextWeek,
}) => {
  const { filteredEvents } = useEvents();

  const { onTouchStart, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: onNextWeek,
    onSwipeRight: onPrevWeek,
  });

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

  const [activeDayIdx, setActiveDayIdx] = useState(currentDayOfWeek);
  const selectedDay = days[activeDayIdx] || currentDate;

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const selectedDateStr = `${selectedDay.getFullYear()}-${pad(selectedDay.getMonth() + 1)}-${pad(selectedDay.getDate())}`;

  const selectedEvents = filteredEvents.filter((ev) => {
    const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
    const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10) || startStr;
    return selectedDateStr >= (startStr || '') && selectedDateStr <= (endStr || '');
  });

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="flex-1 flex flex-col h-full w-full select-none bg-slate-50 dark:bg-slate-900 overflow-hidden"
    >
      {/* 7 Days Top Header Bar */}
      <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-1 py-2 gap-1 shrink-0">
        {days.map((date, idx) => {
          const isSelected = idx === activeDayIdx;
          const holiday = getJapaneseHoliday(date);
          const isSun = idx === 0;
          const isSat = idx === 6;

          let colorClass = 'text-slate-700 dark:text-slate-300';
          if (isSun || holiday) colorClass = 'text-rose-500';
          else if (isSat) colorClass = 'text-blue-500';

          return (
            <button
              key={idx}
              onClick={() => {
                setActiveDayIdx(idx);
                onDateClick(date);
              }}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md scale-102 font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`text-[11px] ${
                  isSelected ? 'text-blue-100' : colorClass
                }`}
              >
                {weekdayNames[idx]}
              </span>
              <span
                className={`text-base font-bold tabular-nums mt-0.5 ${
                  isSelected ? 'text-white' : colorClass
                }`}
              >
                {date.getDate()}
              </span>
              {isToday(date) && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day Events Schedule List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {selectedDay.getMonth() + 1}月{selectedDay.getDate()}日（
            {weekdayNames[selectedDay.getDay()]}）の予定
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedEvents.length} 件
          </span>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
            予定はありません
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            {selectedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-2 hover:border-blue-400 transition cursor-pointer active:scale-99"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-1.5 h-7 rounded-full shrink-0"
                    style={{ backgroundColor: event.backgroundColor || '#039be5' }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {event.summary}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {event.isAllDay || !event.start.dateTime
                        ? '終日'
                        : `${new Date(event.start.dateTime).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })} - ${new Date(event.end.dateTime || '').toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
