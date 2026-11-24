import { GoogleCalendar, CalendarEvent } from '../types/calendar';
import { GOOGLE_EVENT_COLORS } from '../constants/googlePalette';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

/**
 * YYYY-MM-DD 形式の日付文字列に指定日数を加算
 */
function addDaysToDateStr(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dt = new Date(y, m - 1, d + days);
      const cy = dt.getFullYear();
      const cm = String(dt.getMonth() + 1).padStart(2, '0');
      const cd = String(dt.getDate()).padStart(2, '0');
      return `${cy}-${cm}-${cd}`;
    }
  }
  return dateStr;
}

export interface FetchEventsResult {
  events: CalendarEvent[];
  deletedEventIds: string[];
  nextSyncToken?: string;
  isIncremental: boolean;
}

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

  // 2. Fetch events in date range or via Incremental Sync (SyncToken)
  public static async listEvents(
    token: string,
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
    query?: string,
    calendarColor?: string,
    syncToken?: string
  ): Promise<FetchEventsResult> {
    const encodedCalId = encodeURIComponent(calendarId);
    let allItems: any[] = [];
    let pageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 50; // Google allows up to 2500 per page -> 50 pages = up to 125,000 events
    const isIncremental = !!syncToken;

    do {
      try {
        const params = new URLSearchParams();
        params.set('maxResults', '2500'); // Maximum allowed by Google Calendar API

        if (syncToken) {
          // 差分同期: syncToken を指定（timeMin, timeMax, orderBy, singleEvents は API 仕様上併用不可）
          params.set('syncToken', syncToken);
        } else {
          // 初回フル同期 / 期間指定
          params.set('singleEvents', 'true');
          params.set('orderBy', 'startTime');
          if (timeMin) params.set('timeMin', timeMin);
          if (timeMax) params.set('timeMax', timeMax);
        }

        if (query) params.set('q', query);
        if (pageToken) params.set('pageToken', pageToken);

        const data = await this.request<any>(
          `/calendars/${encodedCalId}/events?${params.toString()}`,
          token
        );

        const items = data.items || [];
        allItems = allItems.concat(items);
        pageToken = data.nextPageToken;
        if (data.nextSyncToken) {
          nextSyncToken = data.nextSyncToken;
        }
        pageCount++;

        // Brief pause between paginated calls to respect Google burst limits
        if (pageToken) {
          await new Promise((r) => setTimeout(r, 60));
        }
      } catch (err: any) {
        // 410 Gone: syncToken 失効時はフル同期に自動フォールバック
        if (err?.status === 410 && syncToken) {
          console.warn(`[CalendarApiService] syncToken expired for ${calendarId}, falling back to full sync.`);
          return this.listEvents(token, calendarId, timeMin, timeMax, query, calendarColor, undefined);
        }

        console.warn(`[CalendarApiService] Failed fetching page ${pageCount + 1} for ${calendarId}:`, err);
        if (allItems.length === 0) {
          throw err;
        }
        break;
      }
    } while (pageToken && pageCount < MAX_PAGES);

    const deletedEventIds: string[] = [];
    const validEvents: CalendarEvent[] = [];

    for (const item of allItems) {
      if (item.status === 'cancelled') {
        deletedEventIds.push(item.id);
        continue;
      }

      if (!item.start) continue;

      const colorId = item.colorId;
      const palette = colorId ? GOOGLE_EVENT_COLORS[colorId] : undefined;
      const bg = palette?.background || calendarColor || undefined;
      const isAllDayItem = !item.start?.dateTime && !!item.start?.date;
      const fg = palette?.foreground || (isAllDayItem ? '#ffffff' : undefined);

      validEvents.push({
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
        isAllDay: isAllDayItem,
        status: item.status,
        recurringEventId: item.recurringEventId,
      });
    }

    return {
      events: validEvents,
      deletedEventIds,
      nextSyncToken,
      isIncremental,
    };
  }

  // 3. Create event（双方向同期：ユーザー指定によりアプリの色はGoogleに反映しないため colorId は含めない）
  public static async insertEvent(
    token: string,
    calendarId: string,
    event: Omit<CalendarEvent, 'id'>
  ): Promise<CalendarEvent> {
    const encodedCalId = encodeURIComponent(calendarId);

    let start = event.start;
    let end = event.end;

    // 終日イベントの場合、end.date は排他的（翌日）である必要がある
    if (event.isAllDay || start.date) {
      const sDate = start.date || '';
      let eDate = end?.date || sDate;
      if (!eDate || eDate <= sDate) {
        eDate = addDaysToDateStr(sDate, 1);
      }
      start = { date: sDate };
      end = { date: eDate };
    }

    const body: any = {
      summary: event.summary || '(タイトルなし)',
      description: event.description || '',
      location: event.location || '',
      start,
      end,
    };

    // ※ユーザー要件: アプリ側の色はGoogleカレンダーへ反映しないため、body.colorId は設定しない

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

  // 4. Update event（双方向同期：ユーザー指定によりアプリの色はGoogleに反映しないため colorId は含めない）
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

    if (updates.start !== undefined || updates.end !== undefined) {
      let start = updates.start;
      let end = updates.end;

      if (updates.isAllDay || start?.date) {
        const sDate = start?.date || '';
        let eDate = end?.date || sDate;
        if (sDate && (!eDate || eDate <= sDate)) {
          eDate = addDaysToDateStr(sDate, 1);
        }
        if (start) start = { ...start, date: sDate };
        if (end) end = { ...end, date: eDate };
      }

      if (start !== undefined) body.start = start;
      if (end !== undefined) body.end = end;
    }

    // ※ユーザー要件: アプリ側の色はGoogleカレンダーへ反映しないため、body.colorId は設定しない

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
