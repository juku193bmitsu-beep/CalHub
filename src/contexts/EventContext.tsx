import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarEvent } from '../types/calendar';
import { generateInitialMockEvents } from '../services/mockData';
import { useCalendar } from './CalendarContext';
import { CalendarApiService } from '../services/calendarApi';
import { isEventOnDate } from '../services/dateUtils';

interface EventContextType {
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  isSyncingEvents: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  moveEventDate: (id: string, targetDateStr: string) => Promise<void>;
  moveEventCalendar: (id: string, targetCalendarId: string) => Promise<void>;
  searchEvents: (query: string) => CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  refreshEvents: () => Promise<void>;
  clearAllEvents: () => void;
  resetToMockEvents: () => void;
}

const EventContext = createContext<EventContextType | null>(null);

const STORAGE_KEY_EVENTS = 'calhub_events_v2';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visibleCalendarIds, authToken, calendars } = useCalendar();
  const [isSyncingEvents, setIsSyncingEvents] = useState<boolean>(false);

  // Load from localStorage or initialize with mock data
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return generateInitialMockEvents();
  });

  // Save to localStorage whenever events change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (e) {
      console.error('Failed to save events to localStorage', e);
    }
  }, [events]);

  // Sync events from Google Calendar API
  const refreshEvents = useCallback(async () => {
    if (!authToken || visibleCalendarIds.size === 0) return;

    try {
      setIsSyncingEvents(true);
      // Fetch 3 months range around current time
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();

      const promises = Array.from(visibleCalendarIds).map((calId) => {
        const cal = calendars.find((c) => c.id === calId);
        return CalendarApiService.listEvents(
          authToken,
          calId,
          timeMin,
          timeMax,
          undefined,
          cal?.backgroundColor
        ).catch((err) => {
          console.warn(`Failed to fetch events for calendar ${calId}:`, err);
          return [] as CalendarEvent[];
        });
      });

      const results = await Promise.all(promises);
      const fetchedEvents = results.flat();

      if (fetchedEvents.length > 0) {
        // Merge with non-active calendar events to preserve them
        setEvents((prev) => {
          const unaffected = prev.filter((e) => !visibleCalendarIds.has(e.calendarId));
          return [...fetchedEvents, ...unaffected];
        });
      }
    } catch (err) {
      console.error('Error syncing events from Google:', err);
    } finally {
      setIsSyncingEvents(false);
    }
  }, [authToken, visibleCalendarIds, calendars]);

  // Fetch when token or visible calendars change
  useEffect(() => {
    if (authToken) {
      refreshEvents();
    }
  }, [authToken, visibleCalendarIds, refreshEvents]);

  // Filter events based on active calendar selections, and ensure calendar color is inherited
  const filteredEvents = useMemo(() => {
    const calMap = new Map(calendars.map((c) => [c.id, c.backgroundColor]));
    return events
      .filter((e) => visibleCalendarIds.has(e.calendarId))
      .map((e) => {
        if (!e.backgroundColor && calMap.has(e.calendarId)) {
          return {
            ...e,
            backgroundColor: calMap.get(e.calendarId),
          };
        }
        return e;
      });
  }, [events, visibleCalendarIds, calendars]);

  // 1. Add Event
  const addEvent = async (newEventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    const tempId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const created: CalendarEvent = {
      ...newEventData,
      id: tempId,
    };

    // Optimistic UI update
    setEvents((prev) => [created, ...prev]);

    // If Google token exists, sync to API
    if (authToken && newEventData.calendarId) {
      try {
        const apiCreated = await CalendarApiService.insertEvent(
          authToken,
          newEventData.calendarId,
          newEventData
        );
        // Replace temp ID with Google Event ID
        setEvents((prev) =>
          prev.map((e) => (e.id === tempId ? { ...e, id: apiCreated.id } : e))
        );
        return { ...created, id: apiCreated.id };
      } catch (err) {
        console.error('Failed to sync inserted event to Google API:', err);
      }
    }

    return created;
  };

  // 2. Update Event
  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const target = events.find((e) => e.id === id);
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

    if (authToken && target) {
      try {
        const calId = updates.calendarId || target.calendarId;
        await CalendarApiService.patchEvent(authToken, calId, id, updates);
      } catch (err) {
        console.error('Failed to sync updated event to Google API:', err);
      }
    }
  };

  // 3. Delete Event
  const deleteEvent = async (id: string) => {
    const target = events.find((e) => e.id === id);
    setEvents((prev) => prev.filter((e) => e.id !== id));

    if (authToken && target) {
      try {
        await CalendarApiService.deleteEvent(authToken, target.calendarId, id);
      } catch (err) {
        console.error('Failed to sync deleted event to Google API:', err);
      }
    }
  };

  // 4. Move Event Date (Drag & Drop or Reschedule)
  const moveEventDate = async (id: string, targetDateStr: string) => {
    let updatedEvent: CalendarEvent | null = null;

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;

        if (ev.isAllDay || ev.start.date) {
          const updated: CalendarEvent = {
            ...ev,
            start: { date: targetDateStr },
            end: { date: targetDateStr },
          };
          updatedEvent = updated;
          return updated;
        }

        const oldStart = new Date(ev.start.dateTime || '');
        const oldEnd = new Date(ev.end.dateTime || '');
        const diffMs = oldEnd.getTime() - oldStart.getTime();

        const [y, m, d] = targetDateStr.split('-').map(Number);
        const newStart = new Date(oldStart);
        newStart.setFullYear(y, m - 1, d);
        const newEnd = new Date(newStart.getTime() + diffMs);

        const updated: CalendarEvent = {
          ...ev,
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        };
        updatedEvent = updated;
        return updated;
      })
    );

    if (authToken && updatedEvent) {
      try {
        const target: CalendarEvent = updatedEvent;
        await CalendarApiService.patchEvent(authToken, target.calendarId, id, {
          start: target.start,
          end: target.end,
        });
      } catch (err) {
        console.error('Failed to sync moved event date to Google API:', err);
      }
    }
  };

  // 5. Move across calendars (Compare View)
  const moveEventCalendar = async (id: string, targetCalendarId: string) => {
    const target = events.find((e) => e.id === id);
    const destCal = calendars.find((c) => c.id === targetCalendarId);

    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === id
          ? {
              ...ev,
              calendarId: targetCalendarId,
              backgroundColor: destCal?.backgroundColor || ev.backgroundColor,
            }
          : ev
      )
    );

    if (authToken && target) {
      try {
        await CalendarApiService.moveEvent(authToken, target.calendarId, id, targetCalendarId);
      } catch (err) {
        console.error('Failed to move event across calendars via Google API:', err);
      }
    }
  };

  // Search by query across all events
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

  // Get events falling on a specific date (safe handling of all-day and multi-day)
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const targetStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return filteredEvents.filter((ev) => isEventOnDate(ev, targetStr));
  };

  const clearAllEvents = () => {
    setEvents([]);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
  };

  const resetToMockEvents = () => {
    const mocks = generateInitialMockEvents();
    setEvents(mocks);
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(mocks));
  };

  return (
    <EventContext.Provider
      value={{
        events,
        filteredEvents,
        isSyncingEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        moveEventDate,
        moveEventCalendar,
        searchEvents,
        getEventsForDate,
        refreshEvents,
        clearAllEvents,
        resetToMockEvents,
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
