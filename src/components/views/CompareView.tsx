import React, { useState } from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { EventChip } from '../events/EventChip';
import { formatLocalDate, isEventOnDate } from '../../services/dateUtils';

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
  const { filteredEvents, moveEventCalendar, moveEventDate } = useEvents();
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // Active calendars to compare
  const activeCalendars = calendars.filter((c) => visibleCalendarIds.has(c.id));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
              className="flex-1 min-w-[130px] py-2 px-2 text-center border-r border-slate-200/60 dark:border-slate-800 flex items-center justify-center gap-1.5"
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
          const dateStr = formatLocalDate(dateObj);

          return (
            <div
              key={d}
              onClick={() => onDateClick(dateObj)}
              className="flex border-b border-slate-200/50 dark:border-slate-800/50 min-h-[46px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
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
                <span className="text-xs tabular-nums font-semibold">{d}日</span>
              </div>

              {/* Each Calendar Lane */}
              <div className="flex-1 flex overflow-x-auto no-scrollbar">
                {activeCalendars.map((cal) => {
                  const eventsInCell = filteredEvents.filter((ev) => {
                    if (ev.calendarId !== cal.id) return false;
                    return isEventOnDate(ev, dateStr);
                  });

                  return (
                    <div
                      key={cal.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, cal.id, dateStr)}
                      className="flex-1 min-w-[130px] p-1 border-r border-slate-200/40 dark:border-slate-800/40 flex flex-col gap-1 overflow-hidden transition-colors hover:bg-blue-50/20"
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
  );
};
