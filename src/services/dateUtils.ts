import { CalendarEvent } from '../types/calendar';

/**
 * Formats a Date object as YYYY-MM-DD in local time
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD or ISO string into a local Date object safely
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

/**
 * Returns start date in YYYY-MM-DD string
 */
export function getEventStartDateStr(event: CalendarEvent): string {
  if (event.start.date) return event.start.date;
  if (event.start.dateTime) return event.start.dateTime.slice(0, 10);
  return '';
}

/**
 * Returns inclusive end date in YYYY-MM-DD string.
 * Google Calendar API defines all-day end.date as exclusive (the day after the last day).
 * If it's an all-day event and end.date differs from start.date, we decrement 1 day to make it inclusive.
 */
export function getEventEndDateInclusiveStr(event: CalendarEvent): string {
  const isAllDay = !!event.isAllDay || (!event.start.dateTime && !!event.start.date);
  const startStr = getEventStartDateStr(event);

  if (isAllDay) {
    const rawEnd = event.end.date || event.end.dateTime?.slice(0, 10) || startStr;
    if (!rawEnd || rawEnd === startStr) {
      return startStr;
    }
    // Check if rawEnd is strictly after startStr
    if (rawEnd > startStr) {
      // If from Google Calendar API, end date is exclusive.
      // E.g. start: 2026-11-18, end: 2026-11-19 means 1 day only (11-18).
      const [ey, em, ed] = rawEnd.split('-').map(Number);
      const endDate = new Date(ey, em - 1, ed);
      endDate.setDate(endDate.getDate() - 1);
      const decStr = formatLocalDate(endDate);
      // In case decStr < startStr, clamp to startStr
      return decStr >= startStr ? decStr : startStr;
    }
    return rawEnd;
  }

  // Timed event: end.dateTime
  const endStr = event.end.dateTime?.slice(0, 10) || event.end.date || startStr;
  return endStr;
}

/**
 * Checks if an event occurs on target YYYY-MM-DD date.
 * - Multi-day events (spans >= 2 days or >= 24h) occur on all dates from start to end inclusive.
 * - Single-day events and overnight timed events (< 24h) occur ONLY on their start date.
 */
export function isEventOnDate(event: CalendarEvent, targetDateStr: string): boolean {
  const startStr = getEventStartDateStr(event);
  if (!startStr) return false;

  if (isMultiDayEvent(event)) {
    const endInclusiveStr = getEventEndDateInclusiveStr(event);
    return targetDateStr >= startStr && targetDateStr <= endInclusiveStr;
  }

  return targetDateStr === startStr;
}

/**
 * Checks if an event is multi-day (requires arrows or spanning bars).
 * - All-day events spanning 2 or more days return true.
 * - Timed events lasting 24 hours or longer return true.
 * - Overnight timed events under 24h (e.g. 23:00 to 02:00 next day) return FALSE
 *   so they are treated as single-day timed events on the start date.
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  const startStr = getEventStartDateStr(event);
  const endInclusiveStr = getEventEndDateInclusiveStr(event);
  if (!startStr || !endInclusiveStr || startStr === endInclusiveStr) {
    return false;
  }

  const isAllDay = !!event.isAllDay || (!event.start.dateTime && !!event.start.date);
  if (isAllDay) {
    return true;
  }

  // Timed event spanning dates: check if duration >= 24 hours (86,400,000 ms)
  if (event.start.dateTime && event.end.dateTime) {
    const s = new Date(event.start.dateTime).getTime();
    const e = new Date(event.end.dateTime).getTime();
    if (!isNaN(s) && !isNaN(e)) {
      return (e - s) >= 24 * 60 * 60 * 1000;
    }
  }

  // Default: overnight timed events (< 24h) are treated as single-day events on start date
  return false;
}

/**
 * Priority rank for event ordering:
 * 1: Multi-day arrow event (spans >= 2 days or >= 24h)
 * 2: Single-day all-day event
 * 3: Timed event (including overnight events < 24h)
 */
export function getEventPriorityRank(event: CalendarEvent): number {
  if (isMultiDayEvent(event)) {
    return 1;
  }
  const isAllDay = !!event.isAllDay || (!event.start.dateTime && !!event.start.date);
  if (isAllDay) {
    return 2;
  }
  return 3;
}

/**
 * Standard comparator for sorting calendar events according to the defined rules:
 * 1. Multi-day arrow events first
 *    - longer duration first, then earlier start date, then title
 * 2. Single-day all-day events second
 *    - title order
 * 3. Timed events third (including overnight events)
 *    - earlier start time first, then longer duration, then title
 */
export function compareEventsByDisplayOrder(a: CalendarEvent, b: CalendarEvent): number {
  const aRank = getEventPriorityRank(a);
  const bRank = getEventPriorityRank(b);

  if (aRank !== bRank) {
    return aRank - bRank;
  }

  // Sub-sort for Rank 1 (Multi-day arrows)
  if (aRank === 1) {
    const aStart = getEventStartDateStr(a);
    const bStart = getEventStartDateStr(b);
    const aEnd = getEventEndDateInclusiveStr(a);
    const bEnd = getEventEndDateInclusiveStr(b);

    const aDur = new Date(aEnd).getTime() - new Date(aStart).getTime();
    const bDur = new Date(bEnd).getTime() - new Date(bStart).getTime();
    if (aDur !== bDur) {
      return bDur - aDur; // longer duration first
    }
    if (aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    return (a.summary || '').localeCompare(b.summary || '', 'ja');
  }

  // Sub-sort for Rank 2 (Single-day all-day)
  if (aRank === 2) {
    return (a.summary || '').localeCompare(b.summary || '', 'ja');
  }

  // Sub-sort for Rank 3 (Timed events)
  const aTime = a.start.dateTime || a.start.date || '';
  const bTime = b.start.dateTime || b.start.date || '';
  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }

  // If start times match, longer duration first
  const aStartMs = new Date(a.start.dateTime || a.start.date || '').getTime();
  const aEndMs = new Date(a.end.dateTime || a.end.date || a.start.dateTime || '').getTime();
  const bStartMs = new Date(b.start.dateTime || b.start.date || '').getTime();
  const bEndMs = new Date(b.end.dateTime || b.end.date || b.start.dateTime || '').getTime();
  const aDur = aEndMs - aStartMs;
  const bDur = bEndMs - bStartMs;
  if (!isNaN(aDur) && !isNaN(bDur) && aDur !== bDur) {
    return bDur - aDur;
  }

  return (a.summary || '').localeCompare(b.summary || '', 'ja');
}

/**
 * Safely adds or subtracts months from a date, avoiding the JavaScript Date
 * end-of-month rollover bug (e.g., March 31 - 1 month != March 3, but Feb 28).
 */
export function addMonthsSafe(date: Date, months: number): Date {
  const target = new Date(date);
  const originalDay = target.getDate();

  // Set day to 1st to avoid overflow during month change
  target.setDate(1);
  target.setMonth(target.getMonth() + months);

  // Clamp to maximum days in the target month
  const maxDays = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, maxDays));

  return target;
}

