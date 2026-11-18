import React from 'react';
import { CalendarEvent } from '../../types/calendar';
import { ArrowDesignSettings } from '../../types/settings';

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

  // Find multi-day events that overlap with this month
  const multiDayEvents = events.filter((e) => {
    const startStr = e.start.date || e.start.dateTime?.slice(0, 10);
    const endStr = e.end.date || e.end.dateTime?.slice(0, 10);
    if (!startStr || !endStr) return false;
    if (startStr === endStr) return false; // single day

    // Overlaps with current month
    return startStr <= monthEndStr && endStr >= monthStartStr;
  });

  if (multiDayEvents.length === 0) return null;

  // Compute lane assignments for overlapping arrows
  const spans: MultiDaySpan[] = [];

  multiDayEvents.forEach((event) => {
    const startStr = event.start.date || event.start.dateTime?.slice(0, 10) || '';
    const endStr = event.end.date || event.end.dateTime?.slice(0, 10) || '';

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

  const laneWidth = 8;
  const laneBaseOffset = 77; // Centered inside the dedicated arrow lane (between date column and event chips)

  // Arrow style mappings
  const strokeWidth =
    arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4.5 : 3;

  const strokeDash =
    arrowSettings.pattern === 'dashed'
      ? '4 3'
      : undefined;

  return (
    <svg
      className="absolute top-0 left-0 w-full pointer-events-none z-10"
      style={{ height: `${daysInMonth * rowHeight}px` }}
    >
      <defs>
        {spans.map(({ event }) => {
          const color = event.backgroundColor || '#3b82f6';
          return (
            <React.Fragment key={`defs-${event.id}`}>
              <marker
                id={`arrowhead-${event.id}`}
                markerWidth="6"
                markerHeight="6"
                refX="3"
                refY="3"
                orient="auto"
              >
                {arrowSettings.headStyle === 'circle' ? (
                  <circle cx="3" cy="3" r="2.5" fill={color} />
                ) : arrowSettings.headStyle === 'minimal' ? (
                  <path d="M 0 0 L 3 3 L 0 6" fill="none" stroke={color} strokeWidth="1.5" />
                ) : arrowSettings.headStyle === 'none' ? null : (
                  <path d="M 0 0 L 4 3 L 0 6 Z" fill={color} />
                )}
              </marker>

              {arrowSettings.pattern === 'gradient' && (
                <linearGradient id={`grad-${event.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color={color} stop-opacity="1" />
                  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.9" />
                </linearGradient>
              )}
            </React.Fragment>
          );
        })}
      </defs>

      {spans.map(({ event, startDay, endDay, lane }) => {
        const startStr = event.start.date || event.start.dateTime?.slice(0, 10) || '';
        const isStartedInCurrentMonth = startStr >= monthStartStr;

        // If event starts this month, arrow begins right under the first day's row (startDay * rowHeight)
        // If continuing from previous month, it starts from top of month (0)
        if (isStartedInCurrentMonth && endDay <= startDay) {
          return null;
        }

        const topY = isStartedInCurrentMonth ? startDay * rowHeight : 0;
        const bottomY = (endDay - 1) * rowHeight + rowHeight * 0.55;
        const xPos = laneBaseOffset + lane * laneWidth;
        const color = event.backgroundColor || '#3b82f6';
        const strokeColor =
          arrowSettings.pattern === 'gradient' ? `url(#grad-${event.id})` : color;

        return (
          <g
            key={`arrow-${event.id}`}
            className="cursor-pointer pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(event);
            }}
          >
            {/* Vertical arrow line starting from below the event row */}
            <line
              x1={xPos}
              y1={topY}
              x2={xPos}
              y2={bottomY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeLinecap="round"
              markerEnd={`url(#arrowhead-${event.id})`}
            />

            {/* Invisible thicker line for easy touch tap */}
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
