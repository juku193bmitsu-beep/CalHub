import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarEvent } from '../types/calendar';
import { generateInitialMockEvents } from '../services/mockData';
import { useCalendar } from './CalendarContext';
import { CalendarApiService } from '../services/calendarApi';
import { isEventOnDate } from '../services/dateUtils';
import { loadEventsFromDb, saveEventsToDb, deleteEventFromDb, clearEventsDb } from '../services/storageDb';

export interface EventStats {
  total: number;
  minYear: number | null;
  maxYear: number | null;
}

interface EventContextType {
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  isSyncingEvents: boolean;
  syncStatusMessage: string | null;
  eventStats: EventStats;
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
  const { visibleCalendarIds, authToken, calendars, setAuthToken } = useCalendar();
  const [isSyncingEvents, setIsSyncingEvents] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);

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

  // Load complete multi-year archive from IndexedDB on mount
  useEffect(() => {
    loadEventsFromDb().then((dbEvents) => {
      if (dbEvents && dbEvents.length > 0) {
        setEvents((prev) => {
          // Merge IndexedDB events with current state, prioritizing IndexedDB
          const map = new Map<string, CalendarEvent>();
          prev.forEach((e) => map.set(e.id, e));
          dbEvents.forEach((e) => map.set(e.id, e));
          return Array.from(map.values());
        });
      }
    });
  }, []);

  // Save to IndexedDB (complete storage) and localStorage (fast cache fallback)
  useEffect(() => {
    if (events.length > 0) {
      saveEventsToDb(events);
    }

    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (e) {
      // LocalStorage quota fallback: store recent 3 years
      try {
        const cutoffYear = new Date().getFullYear() - 3;
        const recentEvents = events.filter((ev) => {
          const dateStr = ev.start.date || ev.start.dateTime;
          return dateStr ? parseInt(dateStr.slice(0, 4), 10) >= cutoffYear : true;
        });
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(recentEvents));
      } catch {
        // Ignore quota error as IndexedDB safely holds all data
      }
    }
  }, [events]);

  // Compute stats on loaded events
  const eventStats: EventStats = useMemo(() => {
    if (events.length === 0) {
      return { total: 0, minYear: null, maxYear: null };
    }
    let minYear = 9999;
    let maxYear = 0;
    for (const ev of events) {
      const d = ev.start.date || ev.start.dateTime;
      if (d && d.length >= 4) {
        const y = parseInt(d.slice(0, 4), 10);
        if (!isNaN(y)) {
          if (y < minYear) minYear = y;
          if (y > maxYear) maxYear = y;
        }
      }
    }
    return {
      total: events.length,
      minYear: minYear === 9999 ? null : minYear,
      maxYear: maxYear === 0 ? null : maxYear,
    };
  }, [events]);

  // Sync events from Google Calendar API in sequential polite slices
  // Slice 1: Future 1 Year (From 1st of current month up to end of next year: e.g. 2026-11 to 2027-12-31)
  // Slice 2: Recent Past 1-3 Years
  // Slice 3: Mid Past 4-6 Years
  // Slice 4: Deep Past 7-10 Years
  const refreshEvents = useCallback(async () => {
    if (!authToken) {
      setSyncStatusMessage('Googleカレンダーが未接続です。設定から接続してください');
      setTimeout(() => setSyncStatusMessage(null), 4000);
      return;
    }
    if (visibleCalendarIds.size === 0 || isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      setIsSyncingEvents(true);

      const now = new Date();
      const currentYear = now.getFullYear();
      // Start of current month in local time
      const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);

      interface TimeSlice {
        name: string;
        timeMin: string;
        timeMax: string;
      }

      const slices: TimeSlice[] = [
        // 1. Current & Future 1 Year (Strictly prioritized from current month to end of next year: e.g. 2026-11 to 2027-12-31)
        {
          name: `未来1年（今月〜${currentYear + 1}年末）`,
          timeMin: startOfCurrentMonth.toISOString(),
          timeMax: new Date(currentYear + 1, 11, 31, 23, 59, 59).toISOString(),
        },
        // 2. Recent Past (Past 1 to 3 years back from current month)
        {
          name: `過去1〜3年（${currentYear - 3}年〜今月）`,
          timeMin: new Date(currentYear - 3, 0, 1).toISOString(),
          timeMax: startOfCurrentMonth.toISOString(),
        },
        // 3. Mid Past (Past 4 to 6 years)
        {
          name: `過去4〜6年（${currentYear - 6}〜${currentYear - 3}年）`,
          timeMin: new Date(currentYear - 6, 0, 1).toISOString(),
          timeMax: new Date(currentYear - 3, 0, 1).toISOString(),
        },
        // 4. Deep Past (Past 7 to 10 years)
        {
          name: `過去7〜10年（${currentYear - 10}〜${currentYear - 6}年）`,
          timeMin: new Date(currentYear - 10, 0, 1).toISOString(),
          timeMax: new Date(currentYear - 6, 0, 1).toISOString(),
        },
      ];

      const activeCalList = Array.from(visibleCalendarIds).map((calId) => {
        return {
          id: calId,
          color: calendars.find((c) => c.id === calId)?.backgroundColor,
        };
      });

      let totalSyncedCount = 0;

      for (let s = 0; s < slices.length; s++) {
        const slice = slices[s];
        setSyncStatusMessage(`同期中 (${s + 1}/${slices.length}): ${slice.name}`);

        // Fetch each calendar sequentially to guarantee zero 429 rate-limits
        for (const cal of activeCalList) {
          try {
            const calEvents = await CalendarApiService.listEvents(
              authToken,
              cal.id,
              slice.timeMin,
              slice.timeMax,
              undefined,
              cal.color
            );

            if (calEvents.length > 0) {
              totalSyncedCount += calEvents.length;
              setEvents((prev) => {
                const map = new Map<string, CalendarEvent>();
                prev.forEach((ev) => map.set(ev.id, ev));
                calEvents.forEach((ev) => map.set(ev.id, ev));
                const merged = Array.from(map.values());
                saveEventsToDb(merged);
                return merged;
              });
            }
          } catch (err: any) {
            if (err?.status === 401 || err?.isAuthError) {
              setAuthToken(null);
              setSyncStatusMessage('Google認証の期限が切れました。設定から再接続してください');
              setTimeout(() => setSyncStatusMessage(null), 5000);
              return;
            }
            console.warn(`Calendar ${cal.id} failed in slice ${slice.name}:`, err);
          }

          // Gentle pause between calendars
          await new Promise((r) => setTimeout(r, 60));
        }

        // Gentle pause between slices
        await new Promise((r) => setTimeout(r, 100));
      }

      setSyncStatusMessage(`同期完了: 過去10年〜未来1年（計 ${totalSyncedCount} 件）`);
      setTimeout(() => setSyncStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Error syncing events from Google:', err);
      if (err?.status === 401 || err?.isAuthError) {
        setAuthToken(null);
        setSyncStatusMessage('Google認証の期限が切れました。設定から再接続してください');
      } else {
        setSyncStatusMessage('同期エラーが発生しました');
      }
      setTimeout(() => setSyncStatusMessage(null), 4000);
    } finally {
      setIsSyncingEvents(false);
      isSyncingRef.current = false;
    }
  }, [authToken, visibleCalendarIds, calendars, setAuthToken]);

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
    deleteEventFromDb(id);

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
    clearEventsDb();
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
        eventStats,
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
