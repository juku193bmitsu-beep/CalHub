import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarEvent } from '../types/calendar';
import { generateInitialMockEvents } from '../services/mockData';
import { useCalendar } from './CalendarContext';
import { CalendarApiService } from '../services/calendarApi';
import { isEventOnDate } from '../services/dateUtils';
import { loadEventsFromDb, saveEventsToDb, deleteEventFromDb, clearEventsDb } from '../services/storageDb';

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

  // Sync events from Google Calendar API in dedicated slices (Future is strictly prioritized from current month, Past is split in 3 slices back 10 years)
  const refreshEvents = useCallback(async () => {
    if (!authToken || visibleCalendarIds.size === 0 || isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      setIsSyncingEvents(true);
      setSyncStatusMessage('Googleカレンダーから予定を取得中...');

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
        // 1. Current & Future Slice (PRIORITY: From start of current month up to end of next 2 years)
        // Starts strictly from current month so orderBy: 'startTime' immediately fetches today, next month, 2027, etc. without being choked by past events!
        {
          name: `現在〜未来（今月〜${currentYear + 2}年末まで）`,
          timeMin: startOfCurrentMonth.toISOString(),
          timeMax: new Date(currentYear + 2, 11, 31, 23, 59, 59).toISOString(),
        },
        // 2. Recent Past (Past 1 to 3 years back from current month)
        {
          name: `直近過去（${currentYear - 3}年〜今月まで）`,
          timeMin: new Date(currentYear - 3, 0, 1).toISOString(),
          timeMax: startOfCurrentMonth.toISOString(),
        },
        // 3. Mid Past (Past 4 to 6 years)
        {
          name: `中期過去（${currentYear - 6}〜${currentYear - 3}年）`,
          timeMin: new Date(currentYear - 6, 0, 1).toISOString(),
          timeMax: new Date(currentYear - 3, 0, 1).toISOString(),
        },
        // 4. Deep Past (Past 7 to 10 years)
        {
          name: `長期過去（${currentYear - 10}〜${currentYear - 6}年）`,
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
        if (s > 0) {
          setSyncStatusMessage(`過去の予定を同期中... (${slice.name})`);
          // Throttle between slices to avoid burst rate limits
          await new Promise((r) => setTimeout(r, 120));
        }

        const slicePromises = activeCalList.map(({ id, color }) =>
          CalendarApiService.listEvents(
            authToken,
            id,
            slice.timeMin,
            slice.timeMax,
            undefined,
            color
          ).catch((err) => {
            console.warn(`Slice ${slice.name} failed for ${id}:`, err);
            return [] as CalendarEvent[];
          })
        );

        const sliceResults = await Promise.all(slicePromises);
        const newEvents = sliceResults.flat();
        totalSyncedCount += newEvents.length;

        if (newEvents.length > 0) {
          setEvents((prev) => {
            const map = new Map<string, CalendarEvent>();
            // Keep all existing events
            prev.forEach((ev) => map.set(ev.id, ev));
            // Merge / update with newly fetched events
            newEvents.forEach((ev) => map.set(ev.id, ev));
            return Array.from(map.values());
          });
        }
      }

      setSyncStatusMessage(`同期完了: 過去10年〜未来1年（計 ${totalSyncedCount} 件）`);
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error syncing events from Google:', err);
      setSyncStatusMessage('同期エラーが発生しました');
      setTimeout(() => setSyncStatusMessage(null), 4000);
    } finally {
      setIsSyncingEvents(false);
      isSyncingRef.current = false;
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
