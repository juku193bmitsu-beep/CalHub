import React, { createContext, useContext, useState, useMemo } from 'react';
import { CalendarEvent } from '../types/calendar';
import { generateInitialMockEvents } from '../services/mockData';
import { useCalendar } from './CalendarContext';

interface EventContextType {
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, 'id'>) => CalendarEvent;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  moveEventDate: (id: string, targetDateStr: string) => void;
  moveEventCalendar: (id: string, targetCalendarId: string) => void;
  searchEvents: (query: string) => CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
}

const EventContext = createContext<EventContextType | null>(null);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visibleCalendarIds } = useCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>(generateInitialMockEvents);

  // Filter events based on active calendar selections
  const filteredEvents = useMemo(() => {
    return events.filter((e) => visibleCalendarIds.has(e.calendarId));
  }, [events, visibleCalendarIds]);

  const addEvent = (newEventData: Omit<CalendarEvent, 'id'>): CalendarEvent => {
    const created: CalendarEvent = {
      ...newEventData,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setEvents((prev) => [created, ...prev]);
    return created;
  };

  const updateEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // Drag and drop date move
  const moveEventDate = (id: string, targetDateStr: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;

        // If it's an all-day event
        if (ev.isAllDay || ev.start.date) {
          return {
            ...ev,
            start: { date: targetDateStr },
            end: { date: targetDateStr },
          };
        }

        // If it has specific time, retain time while replacing date
        const oldStart = new Date(ev.start.dateTime || '');
        const oldEnd = new Date(ev.end.dateTime || '');
        const diffMs = oldEnd.getTime() - oldStart.getTime();

        const [y, m, d] = targetDateStr.split('-').map(Number);
        const newStart = new Date(oldStart);
        newStart.setFullYear(y, m - 1, d);
        const newEnd = new Date(newStart.getTime() + diffMs);

        return {
          ...ev,
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        };
      })
    );
  };

  // Move across calendars (for compare view)
  const moveEventCalendar = (id: string, targetCalendarId: string) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, calendarId: targetCalendarId } : ev))
    );
  };

  // Search by query across all events (even out of current view)
  const searchEvents = (query: string): CalendarEvent[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return events.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q))
    );
  };

  // Get events falling on a specific date (including multi-day spans)
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const targetStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return filteredEvents.filter((ev) => {
      const startStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
      const endStr = ev.end.date || ev.end.dateTime?.slice(0, 10) || startStr;

      if (!startStr) return false;
      return targetStr >= startStr && targetStr <= (endStr || startStr);
    });
  };

  return (
    <EventContext.Provider
      value={{
        events,
        filteredEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        moveEventDate,
        moveEventCalendar,
        searchEvents,
        getEventsForDate,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used within an EventProvider');
  return context;
};
