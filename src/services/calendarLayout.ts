import { CalendarEvent } from '../types/calendar';
import {
  getEventStartDateStr,
  getEventEndDateInclusiveStr,
  formatLocalDate,
} from './dateUtils';

export interface LayoutEventSegment {
  event: CalendarEvent;
  startCol: number; // 0 (Sun) - 6 (Sat)
  endCol: number;   // 0 (Sun) - 6 (Sat)
  span: number;     // 1 - 7
  lane: number;     // Vertical slot row index (0, 1, 2...)
  isStartsThisWeek: boolean;
  isEndsThisWeek: boolean;
  isAllDayOrMultiDay: boolean;
}

export interface WeekLayoutResult {
  segments: LayoutEventSegment[];
  maxLane: number;
}

/**
 * Calculates optimal multi-day spanning bars and lane assignments for a 7-day week (Sun to Sat)
 */
export function computeWeekLayout(
  events: CalendarEvent[],
  weekDays: Date[] // Exactly 7 dates: Sun (idx 0) to Sat (idx 6)
): WeekLayoutResult {
  const weekStartStr = formatLocalDate(weekDays[0]);
  const weekEndStr = formatLocalDate(weekDays[6]);

  // Filter events overlapping with this week
  const overlapping = events.filter((e) => {
    const s = getEventStartDateStr(e);
    const endInc = getEventEndDateInclusiveStr(e);
    if (!s) return false;
    return s <= weekEndStr && endInc >= weekStartStr;
  });

  // Sort events:
  // 1. Multi-day / All-day first
  // 2. Longer spans first (to pack tightly at top lanes)
  // 3. Earlier start date first
  const sorted = overlapping.sort((a, b) => {
    const aIsAllDay = !!a.isAllDay || (!a.start.dateTime && !!a.start.date);
    const bIsAllDay = !!b.isAllDay || (!b.start.dateTime && !!b.start.date);
    const aStart = getEventStartDateStr(a);
    const bStart = getEventStartDateStr(b);
    const aEnd = getEventEndDateInclusiveStr(a);
    const bEnd = getEventEndDateInclusiveStr(b);

    const aIsMulti = aStart !== aEnd;
    const bIsMulti = bStart !== bEnd;

    const aPriority = aIsMulti || aIsAllDay ? 2 : 1;
    const bPriority = bIsMulti || bIsAllDay ? 2 : 1;
    if (aPriority !== bPriority) return bPriority - aPriority;

    const aDuration = new Date(aEnd).getTime() - new Date(aStart).getTime();
    const bDuration = new Date(bEnd).getTime() - new Date(bStart).getTime();
    if (aDuration !== bDuration) return bDuration - aDuration;

    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return (a.id || '').localeCompare(b.id || '');
  });

  const segments: LayoutEventSegment[] = [];
  const laneOccupancy: boolean[][] = []; // laneOccupancy[laneIndex][colIndex 0..6]

  sorted.forEach((event) => {
    const sStr = getEventStartDateStr(event);
    const endStr = getEventEndDateInclusiveStr(event);

    const isAllDay = !!event.isAllDay || (!event.start.dateTime && !!event.start.date);
    const isMultiDay = sStr !== endStr;
    const isAllDayOrMultiDay = isAllDay || isMultiDay;

    // Calculate clamped columns within this week [0..6]
    let startCol = 0;
    while (startCol < 7 && formatLocalDate(weekDays[startCol]) < sStr) {
      startCol++;
    }

    let endCol = 6;
    while (endCol >= 0 && formatLocalDate(weekDays[endCol]) > endStr) {
      endCol--;
    }

    if (startCol > endCol) return;

    const span = endCol - startCol + 1;
    const isStartsThisWeek = sStr >= weekStartStr;
    const isEndsThisWeek = endStr <= weekEndStr;

    // Find first available lane with no conflicts in [startCol..endCol]
    let lane = 0;
    while (true) {
      if (!laneOccupancy[lane]) {
        laneOccupancy[lane] = [false, false, false, false, false, false, false];
      }

      let conflict = false;
      for (let c = startCol; c <= endCol; c++) {
        if (laneOccupancy[lane][c]) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        // Occupy this lane
        for (let c = startCol; c <= endCol; c++) {
          laneOccupancy[lane][c] = true;
        }
        break;
      }
      lane++;
    }

    segments.push({
      event,
      startCol,
      endCol,
      span,
      lane,
      isStartsThisWeek,
      isEndsThisWeek,
      isAllDayOrMultiDay,
    });
  });

  return {
    segments,
    maxLane: laneOccupancy.length,
  };
}

/**
 * Converts a hex color string to rgba with specified alpha opacity
 */
export function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface TimedEventLayoutItem {
  event: CalendarEvent;
  colIndex: number;
  totalCols: number;
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
  timeStr: string;
}

/**
 * Computes side-by-side column positioning for overlapping timed events in a day column.
 * - Clusters mutually overlapping events.
 * - Assigns the lowest available column index to each event within the cluster.
 * - Computes width = 100% / totalCols and left = colIndex * width so all events are visible without covering each other.
 */
export function computeOverlappingTimedLayout(
  events: CalendarEvent[],
  hourHeight: number
): TimedEventLayoutItem[] {
  if (!events || events.length === 0) return [];

  interface ParsedItem {
    event: CalendarEvent;
    startMin: number;
    endMin: number;
    timeStr: string;
    colIndex: number;
  }

  const parsedList: ParsedItem[] = events
    .filter((ev) => !!ev.start.dateTime)
    .map((ev) => {
      const s = new Date(ev.start.dateTime!);
      const e = new Date(ev.end.dateTime || ev.start.dateTime!);
      const startMin = s.getHours() * 60 + s.getMinutes();
      let durationMin = (e.getTime() - s.getTime()) / (1000 * 60);
      if (isNaN(durationMin) || durationMin < 20) durationMin = 30;
      const endMin = Math.min(24 * 60, startMin + durationMin);

      const timeStr = `${s.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })} - ${e.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`;

      return {
        event: ev,
        startMin,
        endMin,
        timeStr,
        colIndex: 0,
      };
    })
    .sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return (b.endMin - b.startMin) - (a.endMin - a.startMin);
    });

  if (parsedList.length === 0) return [];

  // Group into connected overlapping clusters
  const clusters: ParsedItem[][] = [];
  let currentCluster: ParsedItem[] = [];
  let currentClusterEnd = -1;

  for (const item of parsedList) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      currentClusterEnd = item.endMin;
    } else if (item.startMin < currentClusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(item);
      currentClusterEnd = Math.max(currentClusterEnd, item.endMin);
    } else {
      // Starts after current cluster ends -> finalize and begin new cluster
      clusters.push(currentCluster);
      currentCluster = [item];
      currentClusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const results: TimedEventLayoutItem[] = [];

  for (const cluster of clusters) {
    // Column track tracking the end time of the last event in each column
    const colEndTimes: number[] = [];

    for (const item of cluster) {
      let placedCol = -1;
      for (let c = 0; c < colEndTimes.length; c++) {
        if (item.startMin >= colEndTimes[c]) {
          placedCol = c;
          colEndTimes[c] = item.endMin;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEndTimes.length;
        colEndTimes.push(item.endMin);
      }
      item.colIndex = placedCol;
    }

    const totalCols = Math.max(1, colEndTimes.length);
    const colWidthPercent = 100 / totalCols;

    for (const item of cluster) {
      const topPx = (item.startMin / 60) * hourHeight;
      const durationMin = item.endMin - item.startMin;
      const heightPx = Math.max(22, (durationMin / 60) * hourHeight - 2);
      const leftPercent = item.colIndex * colWidthPercent;

      results.push({
        event: item.event,
        colIndex: item.colIndex,
        totalCols,
        topPx,
        heightPx,
        leftPercent,
        widthPercent: colWidthPercent,
        timeStr: item.timeStr,
      });
    }
  }

  return results;
}
