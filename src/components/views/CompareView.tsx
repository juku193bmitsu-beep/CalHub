import React from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';

interface CompareViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  currentDate,
  onDateClick,
  onEventClick,
}) => {
  const { calendars, visibleCalendarIds } = useCalendar();
  const { filteredEvents } = useEvents();

  // Active calendars to compare
  const activeCalendars = calendars.filter((c) => visibleCalendarIds.has(c.id));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="flex-1 flex flex-col h-full w-full select-none bg-white dark:bg-slate-900 overflow-hidden">
      {/* Column Headers for each active calendar */}
      <div className="flex border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
        <div className="w-14 shrink-0 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200/60 dark:border-slate-800">
          日付
        </div>
        <div className="flex-1 flex overflow-x-auto no-scrollbar">
          {activeCalendars.map((cal) => (
            <div
              key={cal.id}
              className="flex-1 min-w-[120px] py-2 px-2 text-center border-r border-slate-200/60 dark:border-slate-800 flex items-center justify-center gap-1.5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {cal.summary}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of days x calendars */}
      <div className="flex-1 overflow-y-auto">
        {days.map((d) => {
          const dateObj = new Date(year, month - 1, d);
          const dayOfWeek = dateObj.getDay();
          const isSun = dayOfWeek === 0;
          const isSat = dayOfWeek === 6;
          const dateStr = `${year}-${pad(month)}-${pad(d)}`;

          return (
            <div
              key={d}
              onClick={() => onDateClick(dateObj)}
              className="flex border-b border-slate-200/50 dark:border-slate-800/50 min-h-[44px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
            >
              {/* Date Column */}
              <div
                className={`w-14 shrink-0 py-2 flex flex-col items-center justify-center border-r border-slate-200/60 dark:border-slate-800 ${
                  isSun
                    ? 'text-rose-500 font-bold'
                    : isSat
                    ? 'text-blue-500 font-bold'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs tabular-nums">{d}日</span>
              </div>

              {/* Each Calendar Lane */}
              <div className="flex-1 flex overflow-x-auto no-scrollbar">
                {activeCalendars.map((cal) => {
                  const eventsInCell = filteredEvents.filter((ev) => {
                    if (ev.calendarId !== cal.id) return false;
                    const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
                    const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10) || startStr;
                    return dateStr >= (startStr || '') && dateStr <= (endStr || '');
                  });

                  return (
                    <div
                      key={cal.id}
                      className="flex-1 min-w-[120px] p-1 border-r border-slate-200/40 dark:border-slate-800/40 flex flex-col gap-1 overflow-hidden"
                    >
                      {eventsInCell.map((ev) => (
                        <EventChip
                          key={ev.id}
                          event={ev}
                          onOpenDetail={onEventClick}
                          isCompact
                        />
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
  );
};
