import { CalendarEvent } from '../types/calendar';

const DB_NAME = 'calhub_database_v1';
const DB_VERSION = 2;
const STORE_EVENTS = 'events';
const STORE_SYNC_QUEUE = 'sync_queue';
const STORAGE_KEY_FALLBACK_QUEUE = 'calhub_sync_queue_v1';

export interface SyncQueueItem {
  id: string; // unique queue item ID: e.g. `sq_${Date.now()}_${rand}`
  action: 'insert' | 'update' | 'delete';
  calendarId: string;
  eventId: string; // The event's current ID (could be local tempId or Google event ID)
  eventData?: Partial<CalendarEvent>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Open or create IndexedDB instance for CalHub.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all stored events from IndexedDB.
 */
export async function loadEventsFromDb(): Promise<CalendarEvent[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EVENTS, 'readonly');
      const store = tx.objectStore(STORE_EVENTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load from IndexedDB, falling back to empty:', err);
    return [];
  }
}

/**
 * Save multiple events into IndexedDB (upsert).
 */
export async function saveEventsToDb(events: CalendarEvent[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EVENTS, 'readwrite');
      const store = tx.objectStore(STORE_EVENTS);

      events.forEach((event) => {
        if (event && event.id) {
          store.put(event);
        }
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save events to IndexedDB:', err);
  }
}

/**
 * Delete specific events by calendarId or all events.
 */
export async function clearEventsDb(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EVENTS, 'readwrite');
      const store = tx.objectStore(STORE_EVENTS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to clear IndexedDB:', err);
  }
}

/**
 * Delete a single event by ID.
 */
export async function deleteEventFromDb(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EVENTS, 'readwrite');
      const store = tx.objectStore(STORE_EVENTS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete event from IndexedDB:', err);
  }
}

// ==========================================
// OUTBOX / SYNC QUEUE IMPLEMENTATION
// ==========================================

function getFallbackQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FALLBACK_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveFallbackQueue(items: SyncQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FALLBACK_QUEUE, JSON.stringify(items));
  } catch {}
}

/**
 * Load all pending SyncQueueItems from IndexedDB (or localStorage fallback).
 */
export async function loadSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
      return getFallbackQueue();
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items: SyncQueueItem[] = request.result || [];
        // Merge with fallback queue if any
        const fallback = getFallbackQueue();
        if (fallback.length > 0) {
          const map = new Map<string, SyncQueueItem>();
          items.forEach((it) => map.set(it.id, it));
          fallback.forEach((it) => map.set(it.id, it));
          resolve(Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt));
        } else {
          resolve(items.sort((a, b) => a.createdAt - b.createdAt));
        }
      };
      request.onerror = () => resolve(getFallbackQueue());
    });
  } catch {
    return getFallbackQueue();
  }
}

/**
 * Add or update an item in the Sync Queue.
 */
export async function addToSyncQueue(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
): Promise<SyncQueueItem> {
  const queueItem: SyncQueueItem = {
    ...item,
    id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    retryCount: 0,
  };

  try {
    const fallback = getFallbackQueue();
    fallback.push(queueItem);
    saveFallbackQueue(fallback);

    const db = await openDB();
    if (db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      store.put(queueItem);
    }
  } catch (e) {
    console.warn('Failed to persist sync queue item to IndexedDB, fallback stored:', e);
  }

  return queueItem;
}

/**
 * Remove an item from the Sync Queue by its queue item ID.
 */
export async function removeSyncQueueItem(queueItemId: string): Promise<void> {
  try {
    const fallback = getFallbackQueue().filter((it) => it.id !== queueItemId);
    saveFallbackQueue(fallback);

    const db = await openDB();
    if (db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      store.delete(queueItemId);
    }
  } catch (e) {
    console.warn('Failed to remove sync queue item:', e);
  }
}

/**
 * Clear the entire Sync Queue once fully processed.
 */
export async function clearSyncQueue(): Promise<void> {
  try {
    saveFallbackQueue([]);
    const db = await openDB();
    if (db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      store.clear();
    }
  } catch (e) {
    console.warn('Failed to clear sync queue:', e);
  }
}
