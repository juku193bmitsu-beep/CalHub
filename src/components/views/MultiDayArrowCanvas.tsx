import React from 'react';
import { CalendarEvent } from '../../types/calendar';
import { ArrowDesignSettings } from '../../types/settings';
import {
  getEventStartDateStr,
  getEventEndDateInclusiveStr,
  isMultiDayEvent,
} from '../../services/dateUtils';

interface MultiDaySpan {
  event: CalendarEvent;
  startDay: number;
  endDay: number;
  lane: number;
}

interface MultiDayArrowCanvasProps {
  events: CalendarEvent[];
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  rowHeight: number;
  arrowSettings: ArrowDesignSettings;
  onEventClick: (event: CalendarEvent) => void;
}

export const MultiDayArrowCanvas: React.FC<MultiDayArrowCanvasProps> = ({
  events,
  year,
  month,
  daysInMonth,
  rowHeight,
  arrowSettings,
  onEventClick,
}) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const monthStartStr = `${year}-${pad(month)}-01`;
  const monthEndStr = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  // Find multi-day events that overlap with this month (requires vertical arrows)
  const multiDayEvents = events.filter((e) => {
    if (!isMultiDayEvent(e)) return false;
    const startStr = getEventStartDateStr(e);
    const endStr = getEventEndDateInclusiveStr(e);
    if (!startStr || !endStr) return false;

    // Overlaps with current month
    return startStr <= monthEndStr && endStr >= monthStartStr;
  });

  if (multiDayEvents.length === 0) return null;

  // Compute lane assignments for overlapping arrows
  const spans: MultiDaySpan[] = [];

  multiDayEvents.forEach((event) => {
    const startStr = getEventStartDateStr(event);
    const endStr = getEventEndDateInclusiveStr(event);

    // Calculate clamped day numbers in current month
    let startDay = 1;
    if (startStr >= monthStartStr) {
      startDay = parseInt(startStr.slice(8, 10), 10);
    }

    let endDay = daysInMonth;
    if (endStr <= monthEndStr) {
      endDay = parseInt(endStr.slice(8, 10), 10);
    }

    // Allocate lane
    let lane = 0;
    while (true) {
      const conflict = spans.some(
        (s) => s.lane === lane && !(endDay < s.startDay || startDay > s.endDay)
      );
      if (!conflict) break;
      lane++;
    }

    spans.push({ event, startDay, endDay, lane });
  });

  const laneWidth = 10;
  // Precise anchor origin aligning with the event chip's anchor dot
  const laneBaseOffset = 76;

  // Arrow style mappings
  const strokeWidth =
    arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4 : 2.8;

  const strokeDash =
    arrowSettings.pattern === 'dashed'
      ? `${strokeWidth * 2} ${strokeWidth * 1.5}`
      : undefined;

  // Highly visible arrow head scale (distinct, solid & crisp)
  const markerScale =
    arrowSettings.thickness === 'thin' ? 4.5 : arrowSettings.thickness === 'thick' ? 3.6 : 4.0;

  return (
    <svg
      className="absolute top-0 left-0 w-full pointer-events-none z-10"
      style={{ height: `${daysInMonth * rowHeight}px` }}
    >
      <defs>
        {spans.map(({ event }) => {
          const color = event.backgroundColor || '#3b82f6';

          return (
            <marker
              key={`marker-${event.id}`}
              id={`arrowhead-${event.id}`}
              markerWidth={markerScale}
              markerHeight={markerScale}
              viewBox="0 0 12 12"
              refX="10.5"
              refY="6"
              orient="auto"
              markerUnits="strokeWidth"
            >
              {arrowSettings.headStyle === 'circle' ? (
                // Solid filled circle
                <circle cx="6" cy="6" r="4.5" fill={color} />
              ) : arrowSettings.headStyle === 'minimal' ? (
                // Crisp directional arrow
                <path
                  d="M 2 1.5 L 10.5 6 L 2 10.5 L 4.5 6 Z"
                  fill={color}
                />
              ) : arrowSettings.headStyle === 'none' ? null : (
                // Standard: Classic Solid Sharp Arrowhead with high visibility
                <path
                  d="M 1.5 1 L 11 6 L 1.5 11 L 4 6 Z"
                  fill={color}
                />
              )}
            </marker>
          );
        })}
      </defs>

      {spans.map(({ event, startDay, endDay, lane }) => {
        const startStr = getEventStartDateStr(event);
        const isStartedInCurrentMonth = startStr >= monthStartStr;

        if (isStartedInCurrentMonth && endDay <= startDay) {
          return null;
        }

        // Start directly from the bottom edge of the start-day event chip (or top of the month if continuing)
        const topY = isStartedInCurrentMonth
          ? startDay * rowHeight - 2
          : 0;

        // End precisely at the bottom of the final day row (border boundary)
        const bottomY = endDay * rowHeight - 4;
        const xPos = laneBaseOffset + lane * laneWidth;
        const color = event.backgroundColor || '#3b82f6';

        return (
          <g
            key={`arrow-${event.id}`}
            className="cursor-pointer pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(event);
            }}
          >
            {/* Direct vertical solid or dashed arrow line extending to the bottom of the final day row */}
            <line
              x1={xPos}
              y1={topY}
              x2={xPos}
              y2={bottomY}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeLinecap="round"
              markerEnd={`url(#arrowhead-${event.id})`}
            />

            {/* Invisible thicker hit area for touch/click */}
            <line
              x1={xPos}
              y1={topY}
              x2={xPos}
              y2={bottomY}
              stroke="transparent"
              strokeWidth={20}
            />
          </g>
        );
      })}
    </svg>
  );
};
