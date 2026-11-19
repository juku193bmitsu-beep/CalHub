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
  isFetchingMonth: boolean;
  syncStatusMessage: string | null;
  eventStats: EventStats;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  moveEventDate: (id: string, targetDateStr: string) => Promise<void>;
  moveEventCalendar: (id: string, targetCalendarId: string) => Promise<void>;
  searchEvents: (query: string) => CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  fetchEventsForMonth: (year: number, month: number, force?: boolean) => Promise<number>;
  refreshEvents: () => Promise<void>;
  clearAllEvents: () => void;
  resetToMockEvents: () => void;
}

const EventContext = createContext<EventContextType | null>(null);

const STORAGE_KEY_EVENTS = 'calhub_events_v2';
const STORAGE_KEY_HAS_SYNCED = 'calhub_has_synced_v1';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visibleCalendarIds, authToken, calendars, setAuthToken } = useCalendar();
  const [isSyncingEvents, setIsSyncingEvents] = useState<boolean>(false);
  const [isFetchingMonth, setIsFetchingMonth] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);
  const fetchedMonthsRef = useRef<Set<string>>(new Set());

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

  // On-demand fetch for viewed month window (1 month before to 1 month after, 3 months total)
  // Ensures whenever the user views ANY past or future month, events load immediately in real-time!
  const fetchEventsForMonth = useCallback(
    async (year: number, month: number, force: boolean = false): Promise<number> => {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (!authToken || visibleCalendarIds.size === 0) return 0;
      if (!force && fetchedMonthsRef.current.has(monthKey)) return 0;

      try {
        setIsFetchingMonth(true);
        // 3-month window centered on target month to safely capture multi-day events
        const rangeStart = new Date(year, month - 2, 1);
        const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59);

        const timeMin = rangeStart.toISOString();
        const timeMax = rangeEnd.toISOString();

        const activeCalList = Array.from(visibleCalendarIds).map((calId) => ({
          id: calId,
          color: calendars.find((c) => c.id === calId)?.backgroundColor,
        }));

        let newEventsCount = 0;
        const allFetched: CalendarEvent[] = [];

        for (const cal of activeCalList) {
          try {
            const calEvents = await CalendarApiService.listEvents(
              authToken,
              cal.id,
              timeMin,
              timeMax,
              undefined,
              cal.color
            );
            if (calEvents.length > 0) {
              allFetched.push(...calEvents);
            }
          } catch (err: any) {
            console.warn(`[fetchEventsForMonth] Failed for cal ${cal.id} in ${monthKey}:`, err);
          }
        }

        if (allFetched.length > 0) {
          setEvents((prev) => {
            const map = new Map<string, CalendarEvent>();
            prev.forEach((ev) => map.set(ev.id, ev));
            let added = 0;
            allFetched.forEach((ev) => {
              if (!map.has(ev.id)) added++;
              map.set(ev.id, ev);
            });
            newEventsCount = added;
            const merged = Array.from(map.values());
            saveEventsToDb(merged);
            return merged;
          });
        }

        fetchedMonthsRef.current.add(monthKey);
        return newEventsCount;
      } catch (err) {
        console.error(`[fetchEventsForMonth] Error for ${monthKey}:`, err);
        return 0;
      } finally {
        setIsFetchingMonth(false);
      }
    },
    [authToken, visibleCalendarIds, calendars]
  );

  // Sync events from Google Calendar API in sequential polite slices
  // Slice 1: Current & Future 3 Years (Strictly prioritized from current month to end of 3 years future: e.g. 2026-11 to 2029-12-31)
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
        // 1. Current & Future 3 Years (Covers all future planning)
        {
          name: `現在〜未来3年（${currentYear}〜${currentYear + 3}年）`,
          timeMin: startOfCurrentMonth.toISOString(),
          timeMax: new Date(currentYear + 3, 11, 31, 23, 59, 59).toISOString(),
        },
        // 2. Recent Past (Past 1 to 3 years: 2023〜2026)
        {
          name: `過去1〜3年（${currentYear - 3}〜${currentYear}年）`,
          timeMin: new Date(currentYear - 3, 0, 1).toISOString(),
          timeMax: startOfCurrentMonth.toISOString(),
        },
        // 3. Mid Past (Past 4 to 6 years: 2020〜2023)
        {
          name: `過去4〜6年（${currentYear - 6}〜${currentYear - 3}年）`,
          timeMin: new Date(currentYear - 6, 0, 1).toISOString(),
          timeMax: new Date(currentYear - 3, 0, 1).toISOString(),
        },
        // 4. Deep Past (Past 7 to 10 years: 2016〜2020)
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

      try {
        localStorage.setItem(STORAGE_KEY_HAS_SYNCED, 'true');
      } catch {}
      setSyncStatusMessage(`同期完了: 過去10年〜未来3年（計 ${totalSyncedCount} 件）`);
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

  // Only trigger full 10-year sync on initial login when no cached data exists.
  // When events are already cached in IndexedDB/localStorage, we avoid downloading 10 years
  // every single time the app launches, loading instantly from cache instead!
  useEffect(() => {
    if (!authToken) return;

    try {
      const hasSyncedFlag = localStorage.getItem(STORAGE_KEY_HAS_SYNCED) === 'true';
      if (hasSyncedFlag) return;
    } catch {}

    // Check if we already have non-mock events cached
    const hasRealEvents = events.some((e) => !e.id.startsWith('mock-'));
    if (hasRealEvents) {
      try {
        localStorage.setItem(STORAGE_KEY_HAS_SYNCED, 'true');
      } catch {}
      return;
    }

    // Only run if truly a fresh connection with no cached events
    refreshEvents();
  }, [authToken, events, refreshEvents]);

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
    try {
      localStorage.removeItem(STORAGE_KEY_EVENTS);
      localStorage.removeItem(STORAGE_KEY_HAS_SYNCED);
    } catch {}
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
        isFetchingMonth,
        syncStatusMessage,
        eventStats,
        addEvent,
        updateEvent,
        deleteEvent,
        moveEventDate,
        moveEventCalendar,
        searchEvents,
        getEventsForDate,
        fetchEventsForMonth,
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
