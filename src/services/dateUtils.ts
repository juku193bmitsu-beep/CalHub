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
 * Checks if an event occurs on target YYYY-MM-DD date
 */
export function isEventOnDate(event: CalendarEvent, targetDateStr: string): boolean {
  const startStr = getEventStartDateStr(event);
  const endInclusiveStr = getEventEndDateInclusiveStr(event);

  if (!startStr) return false;
  return targetDateStr >= startStr && targetDateStr <= endInclusiveStr;
}

/**
 * Checks if an event is multi-day (spans across multiple dates)
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  const startStr = getEventStartDateStr(event);
  const endInclusiveStr = getEventEndDateInclusiveStr(event);
  return !!startStr && !!endInclusiveStr && startStr !== endInclusiveStr;
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

