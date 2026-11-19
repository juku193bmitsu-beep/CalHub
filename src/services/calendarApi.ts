import { GoogleCalendar, CalendarEvent } from '../types/calendar';
import { GOOGLE_EVENT_COLORS } from '../constants/googlePalette';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

export class CalendarApiService {
  private static async request<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      // Handle Rate Limiting (429) or Server Overload (500, 503) with exponential backoff retry
      if ((res.status === 429 || res.status >= 500) && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000 + Math.floor(Math.random() * 500);
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(endpoint, token, options, retryCount + 1);
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const error: any = new Error(errBody.error?.message || `API error ${res.status}`);
        error.status = res.status;
        error.code = errBody.error?.code;
        if (res.status === 401) {
          error.isAuthError = true;
        }
        throw error;
      }

      if (res.status === 204) {
        return {} as T;
      }

      return res.json();
    } catch (err: any) {
      if (retryCount < 2 && (err?.status === 429 || err?.message?.includes('network'))) {
        await new Promise((r) => setTimeout(r, 1200));
        return this.request<T>(endpoint, token, options, retryCount + 1);
      }
      throw err;
    }
  }

  // 1. Get all calendars
  public static async listCalendars(token: string): Promise<GoogleCalendar[]> {
    const data = await this.request<any>('/users/me/calendarList', token);
    const items = data.items || [];

    return items.map((item: any) => ({
      id: item.id,
      summary: item.summaryOverride || item.summary,
      description: item.description,
      backgroundColor: item.backgroundColor || '#039be5',
      foregroundColor: item.foregroundColor || '#ffffff',
      primary: !!item.primary,
      selected: item.selected !== false,
      accessRole: item.accessRole,
    }));
  }

  // 2. Fetch events in date range (supports multi-year range & robust pagination)
  public static async listEvents(
    token: string,
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
    query?: string,
    calendarColor?: string
  ): Promise<CalendarEvent[]> {
    const encodedCalId = encodeURIComponent(calendarId);
    let allItems: any[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 50; // Google allows up to 2500 per page -> 50 pages = up to 125,000 events

    do {
      try {
        const params = new URLSearchParams();
        if (pageToken) {
          // Google Calendar API: when pageToken is passed, pass only pageToken to avoid parameter conflicts
          params.set('pageToken', pageToken);
        } else {
          params.set('singleEvents', 'true');
          params.set('orderBy', 'startTime');
          params.set('maxResults', '2500'); // Maximum allowed by Google Calendar API (10x faster than 250)
          if (timeMin) params.set('timeMin', timeMin);
          if (timeMax) params.set('timeMax', timeMax);
          if (query) params.set('q', query);
        }

        const data = await this.request<any>(
          `/calendars/${encodedCalId}/events?${params.toString()}`,
          token
        );

        const items = data.items || [];
        allItems = allItems.concat(items);
        pageToken = data.nextPageToken;
        pageCount++;

        // Brief pause between paginated calls to respect Google burst limits
        if (pageToken) {
          await new Promise((r) => setTimeout(r, 60));
        }
      } catch (err: any) {
        console.warn(`[CalendarApiService] Failed fetching page ${pageCount + 1} for ${calendarId}:`, err);
        // Break out of pagination loop but preserve already accumulated allItems
        break;
      }
    } while (pageToken && pageCount < MAX_PAGES);

    return allItems.map((item: any) => {
      const colorId = item.colorId;
      const palette = colorId ? GOOGLE_EVENT_COLORS[colorId] : undefined;
      const bg = palette?.background || calendarColor || undefined;
      const fg = palette?.foreground || (bg ? '#ffffff' : undefined);

      return {
        id: item.id,
        calendarId,
        summary: item.summary || '(タイトルなし)',
        description: item.description,
        location: item.location,
        start: {
          dateTime: item.start?.dateTime,
          date: item.start?.date,
          timeZone: item.start?.timeZone,
        },
        end: {
          dateTime: item.end?.dateTime,
          date: item.end?.date,
          timeZone: item.end?.timeZone,
        },
        colorId,
        backgroundColor: bg,
        foregroundColor: fg,
        isAllDay: !item.start?.dateTime && !!item.start?.date,
        status: item.status,
        recurringEventId: item.recurringEventId,
      };
    });
  }

  // 3. Create event
  public static async insertEvent(
    token: string,
    calendarId: string,
    event: Omit<CalendarEvent, 'id'>
  ): Promise<CalendarEvent> {
    const encodedCalId = encodeURIComponent(calendarId);
    const body: any = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
    };

    if (event.colorId) body.colorId = event.colorId;

    const created = await this.request<any>(
      `/calendars/${encodedCalId}/events`,
      token,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      ...event,
      id: created.id,
    };
  }

  // 4. Update event
  public static async patchEvent(
    token: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<void> {
    const encodedCalId = encodeURIComponent(calendarId);
    const encodedEventId = encodeURIComponent(eventId);

    const body: any = {};
    if (updates.summary !== undefined) body.summary = updates.summary;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.location !== undefined) body.location = updates.location;
    if (updates.start !== undefined) body.start = updates.start;
    if (updates.end !== undefined) body.end = updates.end;
    if (updates.colorId !== undefined) body.colorId = updates.colorId;

    await this.request(
      `/calendars/${encodedCalId}/events/${encodedEventId}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );
  }

  // 5. Delete event
  public static async deleteEvent(
    token: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const encodedCalId = encodeURIComponent(calendarId);
    const encodedEventId = encodeURIComponent(eventId);

    await this.request(
      `/calendars/${encodedCalId}/events/${encodedEventId}`,
      token,
      {
        method: 'DELETE',
      }
    );
  }

  // 6. Move event across calendars
  public static async moveEvent(
    token: string,
    calendarId: string,
    eventId: string,
    destinationCalendarId: string
  ): Promise<void> {
    const encodedCalId = encodeURIComponent(calendarId);
    const encodedEventId = encodeURIComponent(eventId);
    const encodedDest = encodeURIComponent(destinationCalendarId);

    await this.request(
      `/calendars/${encodedCalId}/events/${encodedEventId}/move?destination=${encodedDest}`,
      token,
      {
        method: 'POST',
      }
    );
  }
}
