import React, { useState } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { getJapaneseHoliday } from '../../constants/holidays';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { formatLocalDate, isEventOnDate } from '../../services/dateUtils';
import { EventChip } from '../events/EventChip';
import { Plus } from 'lucide-react';

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

  const selectedDateStr = formatLocalDate(selectedDay);

  const selectedEvents = filteredEvents.filter((ev) => isEventOnDate(ev, selectedDateStr));

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
                // Note: Do NOT open modal here. Only switch day view.
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
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {selectedDay.getMonth() + 1}月{selectedDay.getDate()}日（
              {weekdayNames[selectedDay.getDay()]}）
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
              {selectedEvents.length} 件
            </span>
          </div>

          <button
            onClick={() => onDateClick(selectedDay)}
            className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition active:scale-95 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>予定を追加</span>
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <div
            onClick={() => onDateClick(selectedDay)}
            className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/60 transition"
          >
            予定はありません。タップしてこの日に予定を追加
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {selectedEvents.map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer active:scale-99"
                onClick={() => onEventClick(event)}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: event.backgroundColor || '#039be5' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {event.summary}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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

                <div onClick={(e) => e.stopPropagation()}>
                  <EventChip
                    event={event}
                    onOpenDetail={onEventClick}
                    isCompact
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
