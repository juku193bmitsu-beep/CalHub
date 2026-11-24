import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarEvent } from '../types/calendar';
import { generateInitialMockEvents } from '../services/mockData';
import { useCalendar } from './CalendarContext';
import { CalendarApiService } from '../services/calendarApi';
import { isEventOnDate, formatLocalDate, parseLocalDate } from '../services/dateUtils';
import {
  loadEventsFromDb,
  saveEventsToDb,
  deleteEventFromDb,
  clearEventsDb,
  loadSyncQueue,
  addToSyncQueue,
  removeSyncQueueItem,
  clearSyncQueue,
} from '../services/storageDb';

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
  pendingSyncCount: number;
  processPendingSyncQueue: () => Promise<void>;
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
const STORAGE_KEY_SYNC_TOKENS = 'calhub_sync_tokens_v1';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visibleCalendarIds, authToken, calendars, setAuthToken } = useCalendar();
  const [isSyncingEvents, setIsSyncingEvents] = useState<boolean>(false);
  const [isFetchingMonth, setIsFetchingMonth] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);
  // Store fetched timestamps: monthKey -> timestamp
  const fetchedMonthsRef = useRef<Map<string, number>>(new Map());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Load sync queue count on mount
  useEffect(() => {
    loadSyncQueue().then((q) => {
      setPendingSyncCount(q.length);
    });
  }, []);

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

  // Process Outbox / Sync Queue
  const processPendingSyncQueue = useCallback(async () => {
    if (!authToken || isProcessingQueueRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      isProcessingQueueRef.current = true;
      const queue = await loadSyncQueue();
      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      let successCount = 0;

      for (const item of queue) {
        try {
          const calId = item.calendarId || 'primary';

          if (item.action === 'insert' && item.eventData) {
            const apiCreated = await CalendarApiService.insertEvent(
              authToken,
              calId,
              item.eventData as Omit<CalendarEvent, 'id'>
            );

            // Replace local temp ID with Google Event ID across events & db
            setEvents((prev) => {
              const updated = prev.map((ev) =>
                ev.id === item.eventId ? { ...ev, id: apiCreated.id } : ev
              );
              saveEventsToDb(updated);
              return updated;
            });
            deleteEventFromDb(item.eventId);
            await removeSyncQueueItem(item.id);
            successCount++;
          } else if (item.action === 'update' && item.eventData) {
            if (!item.eventId.startsWith('event-')) {
              await CalendarApiService.patchEvent(
                authToken,
                calId,
                item.eventId,
                item.eventData
              );
            }
            await removeSyncQueueItem(item.id);
            successCount++;
          } else if (item.action === 'delete') {
            if (!item.eventId.startsWith('event-')) {
              await CalendarApiService.deleteEvent(authToken, calId, item.eventId);
            }
            await removeSyncQueueItem(item.id);
            successCount++;
          }
        } catch (err: any) {
          if (err?.status === 401 || err?.isAuthError) {
            setAuthToken(null);
            setSyncStatusMessage('Google認証の期限が切れました。再接続すると未送信の予定が同期されます');
            setTimeout(() => setSyncStatusMessage(null), 5000);
            break;
          }
          console.warn(`Sync queue item ${item.id} retry postponed:`, err);
        }
      }

      const remaining = await loadSyncQueue();
      setPendingSyncCount(remaining.length);

      if (successCount > 0) {
        setSyncStatusMessage(`未送信の予定 ${successCount} 件をGoogleカレンダーに反映しました`);
        setTimeout(() => setSyncStatusMessage(null), 4000);
      }
    } catch (e) {
      console.error('Failed to process sync queue:', e);
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [authToken, setAuthToken]);

  // Auto-process queue when token becomes active
  useEffect(() => {
    if (authToken) {
      processPendingSyncQueue();
    }
  }, [authToken, processPendingSyncQueue]);

  // Auto-process queue when device comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (authToken) {
        processPendingSyncQueue();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authToken, processPendingSyncQueue]);

  // On-demand fetch for viewed month window (cached for 10 minutes, skips when offline)
  // Ensures whenever the user views ANY past or future month, events load cleanly without excessive calls!
  const fetchEventsForMonth = useCallback(
    async (year: number, month: number, force: boolean = false): Promise<number> => {
      // If offline, rely directly on IndexedDB / localStorage data
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 0;
      }

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (!authToken || visibleCalendarIds.size === 0) return 0;

      // 10-minute cache window to avoid repeated network calls when switching back and forth
      const lastFetched = fetchedMonthsRef.current.get(monthKey);
      if (!force && lastFetched && (Date.now() - lastFetched) < 10 * 60 * 1000) {
        return 0;
      }

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
            const res = await CalendarApiService.listEvents(
              authToken,
              cal.id,
              timeMin,
              timeMax,
              undefined,
              cal.color
            );
            if (res.events.length > 0) {
              allFetched.push(...res.events);
            }
          } catch (err: any) {
            if (err?.status === 401 || err?.isAuthError) {
              setAuthToken(null);
              return 0;
            }
            console.warn(`[fetchEventsForMonth] Failed for cal ${cal.id} in ${monthKey}:`, err);
          }
        }

        if (allFetched.length > 0) {
          setEvents((prev) => {
            const map = new Map<string, CalendarEvent>();
            prev.forEach((ev) => map.set(ev.id, ev));
            let added = 0;
            allFetched.forEach((ev) => {
              const existing = map.get(ev.id);
              if (!existing) added++;
              map.set(ev.id, {
                ...ev,
                ...(existing?.customTextColor ? { customTextColor: existing.customTextColor } : {}),
              });
            });
            newEventsCount = added;
            const merged = Array.from(map.values());
            saveEventsToDb(merged);
            return merged;
          });
        }

        fetchedMonthsRef.current.set(monthKey, Date.now());
        return newEventsCount;
      } catch (err) {
        console.error(`[fetchEventsForMonth] Error for ${monthKey}:`, err);
        return 0;
      } finally {
        setIsFetchingMonth(false);
      }
    },
    [authToken, visibleCalendarIds, calendars, setAuthToken]
  );

  // Sync events from Google Calendar API
  // Uses Google Incremental Sync (SyncToken) when available for near-instant diff sync & deletion sync.
  // Falls back to polite sequential slices on initial sync.
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

      // Load saved syncTokens per calendar
      let syncTokensMap: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SYNC_TOKENS);
        if (raw) syncTokensMap = JSON.parse(raw);
      } catch {}

      const activeCalList = Array.from(visibleCalendarIds).map((calId) => ({
        id: calId,
        color: calendars.find((c) => c.id === calId)?.backgroundColor,
      }));

      // Check if all active calendars already have a syncToken
      const allHaveTokens = activeCalList.every((c) => !!syncTokensMap[c.id]);

      if (allHaveTokens && activeCalList.length > 0) {
        // === 1. FAST INCREMENTAL SYNC (SyncToken) ===
        setSyncStatusMessage('Google差分同期中...');
        let totalChangedCount = 0;
        let totalDeletedCount = 0;

        for (const cal of activeCalList) {
          try {
            const savedToken = syncTokensMap[cal.id];
            const res = await CalendarApiService.listEvents(
              authToken,
              cal.id,
              undefined,
              undefined,
              undefined,
              cal.color,
              savedToken
            );

            if (res.nextSyncToken) {
              syncTokensMap[cal.id] = res.nextSyncToken;
            }

            // Handle deleted events from Google
            if (res.deletedEventIds.length > 0) {
              const delSet = new Set(res.deletedEventIds);
              totalDeletedCount += delSet.size;
              setEvents((prev) => {
                const next = prev.filter((ev) => !delSet.has(ev.id));
                delSet.forEach((id) => deleteEventFromDb(id));
                saveEventsToDb(next);
                return next;
              });
            }

            // Handle added / updated events
            if (res.events.length > 0) {
              totalChangedCount += res.events.length;
              setEvents((prev) => {
                const map = new Map<string, CalendarEvent>();
                prev.forEach((ev) => map.set(ev.id, ev));
                res.events.forEach((ev) => {
                  const existing = map.get(ev.id);
                  map.set(ev.id, {
                    ...ev,
                    ...(existing?.customTextColor ? { customTextColor: existing.customTextColor } : {}),
                  });
                });
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
            console.warn(`[refreshEvents] Incremental sync failed for ${cal.id}:`, err);
          }
          await new Promise((r) => setTimeout(r, 40));
        }

        try {
          localStorage.setItem(STORAGE_KEY_SYNC_TOKENS, JSON.stringify(syncTokensMap));
        } catch {}

        const totalDiff = totalChangedCount + totalDeletedCount;
        setSyncStatusMessage(
          totalDiff > 0
            ? `Google差分同期完了（更新 ${totalChangedCount} 件、削除 ${totalDeletedCount} 件）`
            : 'Googleカレンダーは最新です'
        );
        setTimeout(() => setSyncStatusMessage(null), 3000);
      } else {
        // === 2. INITIAL FULL SLICES SYNC ===
        const now = new Date();
        const currentYear = now.getFullYear();
        const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);

        interface TimeSlice {
          name: string;
          timeMin: string;
          timeMax: string;
        }

        const slices: TimeSlice[] = [
          {
            name: `現在〜未来3年（${currentYear}〜${currentYear + 3}年）`,
            timeMin: startOfCurrentMonth.toISOString(),
            timeMax: new Date(currentYear + 3, 11, 31, 23, 59, 59).toISOString(),
          },
          {
            name: `過去1〜3年（${currentYear - 3}〜${currentYear}年）`,
            timeMin: new Date(currentYear - 3, 0, 1).toISOString(),
            timeMax: startOfCurrentMonth.toISOString(),
          },
          {
            name: `過去4〜6年（${currentYear - 6}〜${currentYear - 3}年）`,
            timeMin: new Date(currentYear - 6, 0, 1).toISOString(),
            timeMax: new Date(currentYear - 3, 0, 1).toISOString(),
          },
          {
            name: `過去7〜10年（${currentYear - 10}〜${currentYear - 6}年）`,
            timeMin: new Date(currentYear - 10, 0, 1).toISOString(),
            timeMax: new Date(currentYear - 6, 0, 1).toISOString(),
          },
        ];

        let totalSyncedCount = 0;

        for (let s = 0; s < slices.length; s++) {
          const slice = slices[s];
          setSyncStatusMessage(`初回同期中 (${s + 1}/${slices.length}): ${slice.name}`);

          for (const cal of activeCalList) {
            try {
              const res = await CalendarApiService.listEvents(
                authToken,
                cal.id,
                slice.timeMin,
                slice.timeMax,
                undefined,
                cal.color
              );

              if (res.nextSyncToken) {
                syncTokensMap[cal.id] = res.nextSyncToken;
              }

              if (res.events.length > 0) {
                totalSyncedCount += res.events.length;
                setEvents((prev) => {
                  const map = new Map<string, CalendarEvent>();
                  prev.forEach((ev) => map.set(ev.id, ev));
                  res.events.forEach((ev) => {
                    const existing = map.get(ev.id);
                    map.set(ev.id, {
                      ...ev,
                      ...(existing?.customTextColor ? { customTextColor: existing.customTextColor } : {}),
                    });
                  });
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
            await new Promise((r) => setTimeout(r, 60));
          }
          await new Promise((r) => setTimeout(r, 100));
        }

        try {
          localStorage.setItem(STORAGE_KEY_HAS_SYNCED, 'true');
          localStorage.setItem(STORAGE_KEY_SYNC_TOKENS, JSON.stringify(syncTokensMap));
        } catch {}
        setSyncStatusMessage(`同期完了: 過去10年〜未来3年（計 ${totalSyncedCount} 件）`);
        setTimeout(() => setSyncStatusMessage(null), 3500);
      }
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
    const calId = newEventData.calendarId || 'primary';
    const created: CalendarEvent = {
      ...newEventData,
      calendarId: calId,
      id: tempId,
    };

    // Optimistic UI update
    setEvents((prev) => [created, ...prev]);

    const isOnline = typeof navigator === 'undefined' || navigator.onLine;

    // If Google token exists and online, attempt sync to API
    if (authToken && isOnline) {
      try {
        const apiCreated = await CalendarApiService.insertEvent(
          authToken,
          calId,
          newEventData
        );
        // Replace temp ID with Google Event ID
        setEvents((prev) =>
          prev.map((e) => (e.id === tempId ? { ...e, id: apiCreated.id } : e))
        );
        return { ...created, id: apiCreated.id };
      } catch (err: any) {
        console.warn('Failed to insert directly to Google API, queuing in outbox:', err);
        if (err?.status === 401 || err?.isAuthError) {
          setAuthToken(null);
        }
        await addToSyncQueue({
          action: 'insert',
          calendarId: calId,
          eventId: tempId,
          eventData: newEventData,
        });
        setPendingSyncCount((prev) => prev + 1);
        setSyncStatusMessage('端末に保存しました（Google再接続時に自動送信されます）');
        setTimeout(() => setSyncStatusMessage(null), 4000);
      }
    } else {
      // Offline or unauthenticated -> Safe Outbox enqueue
      await addToSyncQueue({
        action: 'insert',
        calendarId: calId,
        eventId: tempId,
        eventData: newEventData,
      });
      setPendingSyncCount((prev) => prev + 1);
      if (!authToken) {
        setSyncStatusMessage('端末に保存しました（Google接続時に自動送信されます）');
      } else {
        setSyncStatusMessage('オフライン保存しました（電波復帰時に自動送信されます）');
      }
      setTimeout(() => setSyncStatusMessage(null), 4000);
    }

    return created;
  };

  // 2. Update Event
  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const target = events.find((e) => e.id === id);
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

    const calId = updates.calendarId || target?.calendarId || 'primary';
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;

    if (authToken && isOnline && target && !id.startsWith('event-')) {
      try {
        await CalendarApiService.patchEvent(authToken, calId, id, updates);
      } catch (err: any) {
        console.warn('Failed to patch directly to Google API, queuing in outbox:', err);
        if (err?.status === 401 || err?.isAuthError) {
          setAuthToken(null);
        }
        await addToSyncQueue({
          action: 'update',
          calendarId: calId,
          eventId: id,
          eventData: updates,
        });
        setPendingSyncCount((prev) => prev + 1);
      }
    } else {
      await addToSyncQueue({
        action: 'update',
        calendarId: calId,
        eventId: id,
        eventData: updates,
      });
      setPendingSyncCount((prev) => prev + 1);
    }
  };

  // 3. Delete Event
  const deleteEvent = async (id: string) => {
    const target = events.find((e) => e.id === id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    deleteEventFromDb(id);

    const calId = target?.calendarId || 'primary';
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;

    if (authToken && isOnline && target && !id.startsWith('event-')) {
      try {
        await CalendarApiService.deleteEvent(authToken, calId, id);
      } catch (err: any) {
        console.warn('Failed to delete directly from Google API, queuing in outbox:', err);
        if (err?.status === 401 || err?.isAuthError) {
          setAuthToken(null);
        }
        await addToSyncQueue({
          action: 'delete',
          calendarId: calId,
          eventId: id,
        });
        setPendingSyncCount((prev) => prev + 1);
      }
    } else if (!id.startsWith('event-')) {
      await addToSyncQueue({
        action: 'delete',
        calendarId: calId,
        eventId: id,
      });
      setPendingSyncCount((prev) => prev + 1);
    }
  };

  // 4. Move Event Date (Drag & Drop or Reschedule)
  const moveEventDate = async (id: string, targetDateStr: string) => {
    let updatedEvent: CalendarEvent | null = null;

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;

        if (ev.isAllDay || ev.start.date) {
          const oldStartDate = ev.start.date || '';
          const oldEndDate = ev.end.date || oldStartDate;
          let daysSpan = 1;
          if (oldStartDate && oldEndDate && oldEndDate > oldStartDate) {
            const s = parseLocalDate(oldStartDate);
            const e = parseLocalDate(oldEndDate);
            daysSpan = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
          }

          const targetStartD = parseLocalDate(targetDateStr);
          const targetEndD = new Date(targetStartD);
          targetEndD.setDate(targetEndD.getDate() + daysSpan);
          const nextEndStr = formatLocalDate(targetEndD);

          const updated: CalendarEvent = {
            ...ev,
            start: { date: targetDateStr },
            end: { date: nextEndStr },
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

    if (updatedEvent) {
      const target: CalendarEvent = updatedEvent;
      await updateEvent(id, {
        start: target.start,
        end: target.end,
      });
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

    const isOnline = typeof navigator === 'undefined' || navigator.onLine;

    if (authToken && isOnline && target && !id.startsWith('event-')) {
      try {
        await CalendarApiService.moveEvent(authToken, target.calendarId, id, targetCalendarId);
      } catch (err: any) {
        console.warn('Failed to move event across calendars via Google API, queuing:', err);
        if (err?.status === 401 || err?.isAuthError) {
          setAuthToken(null);
        }
        await addToSyncQueue({
          action: 'update',
          calendarId: targetCalendarId,
          eventId: id,
          eventData: { calendarId: targetCalendarId },
        });
        setPendingSyncCount((prev) => prev + 1);
      }
    } else {
      await addToSyncQueue({
        action: 'update',
        calendarId: targetCalendarId,
        eventId: id,
        eventData: { calendarId: targetCalendarId },
      });
      setPendingSyncCount((prev) => prev + 1);
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
    clearSyncQueue();
    setPendingSyncCount(0);
    try {
      localStorage.removeItem(STORAGE_KEY_EVENTS);
      localStorage.removeItem(STORAGE_KEY_HAS_SYNCED);
      localStorage.removeItem(STORAGE_KEY_SYNC_TOKENS);
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
        pendingSyncCount,
        processPendingSyncQueue,
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
