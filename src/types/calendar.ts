export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  customTextColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: 'reader' | 'writer' | 'owner';
}

export interface CalendarEventDateTime {
  dateTime?: string; // ISO string e.g. "2026-11-18T14:00:00+09:00"
  date?: string;     // YYYY-MM-DD for all-day events e.g. "2026-11-18"
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarEventDateTime;
  end: CalendarEventDateTime;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  isAllDay?: boolean;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  recurringEventId?: string;
}

export interface PaletteColor {
  background: string;
  foreground: string;
}

export interface GoogleColorsResponse {
  calendar: Record<string, PaletteColor>;
  event: Record<string, PaletteColor>;
}
