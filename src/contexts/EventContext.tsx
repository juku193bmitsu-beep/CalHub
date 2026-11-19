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
  syncStatusMessage: string | null;
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
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

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

  // Save to localStorage whenever events change (with automatic safe fallback for large datasets)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (e) {
      console.warn('Storage quota exceeded, caching recent 3 years to localStorage while keeping all in memory:', e);
      try {
        const cutoffYear = new Date().getFullYear() - 3;
        const recentEvents = events.filter((ev) => {
          const dateStr = ev.start.date || ev.start.dateTime;
          return dateStr ? parseInt(dateStr.slice(0, 4), 10) >= cutoffYear : true;
        });
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(recentEvents));
      } catch {
        // Ignore if storage is completely full
      }
    }
  }, [events]);

  // Sync events from Google Calendar API in safe, chunked multi-year slices (Past 10 years to Future 1 year)
  const refreshEvents = useCallback(async () => {
    if (!authToken || visibleCalendarIds.size === 0) return;

    try {
      setIsSyncingEvents(true);
      setSyncStatusMessage('Googleカレンダーから予定を取得中...');

      const now = new Date();
      const currentYear = now.getFullYear();
      const startYear = currentYear - 10; // 10 years ago
      const endYear = currentYear + 1;    // 1 year ahead

      // Generate 2-year chunks to prevent Google API recurrences/singleEvents explosion & timeouts
      // Prioritize current & future years first, then sequentially/parallelly load past years
      interface TimeChunk {
        name: string;
        timeMin: string;
        timeMax: string;
      }

      const chunks: TimeChunk[] = [];
      // 1. Current & Future Chunk (First priority)
      chunks.push({
        name: `${currentYear}〜${endYear}年`,
        timeMin: new Date(currentYear, 0, 1).toISOString(),
        timeMax: new Date(endYear, 11, 31, 23, 59, 59).toISOString(),
      });

      // 2. Past Chunks (2-year steps back to 10 years ago)
      for (let y = currentYear - 1; y >= startYear; y -= 2) {
        const chunkStart = Math.max(startYear, y - 1);
        const chunkEnd = y;
        chunks.push({
          name: `${chunkStart}〜${chunkEnd}年`,
          timeMin: new Date(chunkStart, 0, 1).toISOString(),
          timeMax: new Date(chunkEnd, 11, 31, 23, 59, 59).toISOString(),
        });
      }

      const activeCalList = Array.from(visibleCalendarIds).map((calId) => {
        return {
          id: calId,
          color: calendars.find((c) => c.id === calId)?.backgroundColor,
        };
      });

      // Map to deduplicate events by id
      const eventMap = new Map<string, CalendarEvent>();

      // Fetch Chunk 1 (Current & Future) immediately so user sees their active calendar right away
      const initialChunk = chunks[0];
      const initialPromises = activeCalList.map(({ id, color }) =>
        CalendarApiService.listEvents(
          authToken,
          id,
          initialChunk.timeMin,
          initialChunk.timeMax,
          undefined,
          color
        ).catch((err) => {
          console.warn(`Initial chunk fetch failed for ${id}:`, err);
          return [] as CalendarEvent[];
        })
      );

      const initialResults = await Promise.all(initialPromises);
      initialResults.flat().forEach((ev) => eventMap.set(ev.id, ev));

      // Update events immediately with current/future data
      if (eventMap.size > 0) {
        setEvents((prev) => {
          const unaffected = prev.filter((e) => !visibleCalendarIds.has(e.calendarId));
          return [...Array.from(eventMap.values()), ...unaffected];
        });
      }

      // Fetch past chunks sequentially to avoid rate limiting and ensure complete past 10-year depth
      const pastChunks = chunks.slice(1);
      for (let i = 0; i < pastChunks.length; i++) {
        const chunk = pastChunks[i];
        setSyncStatusMessage(`過去の予定を同期中... (${chunk.name})`);

        const chunkPromises = activeCalList.map(({ id, color }) =>
          CalendarApiService.listEvents(
            authToken,
            id,
            chunk.timeMin,
            chunk.timeMax,
            undefined,
            color
          ).catch((err) => {
            console.warn(`Chunk ${chunk.name} failed for ${id}:`, err);
            return [] as CalendarEvent[];
          })
        );

        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.flat().forEach((ev) => eventMap.set(ev.id, ev));

        // Periodically update state as past data streams in
        setEvents((prev) => {
          const unaffected = prev.filter((e) => !visibleCalendarIds.has(e.calendarId));
          return [...Array.from(eventMap.values()), ...unaffected];
        });
      }

      setSyncStatusMessage(`同期完了: 過去10年分の予定（計 ${eventMap.size} 件）`);
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error syncing events from Google:', err);
      setSyncStatusMessage('同期エラーが発生しました');
      setTimeout(() => setSyncStatusMessage(null), 4000);
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
        syncStatusMessage,
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
