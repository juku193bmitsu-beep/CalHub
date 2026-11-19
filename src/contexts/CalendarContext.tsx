import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleCalendar } from '../types/calendar';
import { ArrowDesignSettings, UserPreferences } from '../types/settings';
import { MOCK_CALENDARS } from '../services/mockData';
import { CalendarApiService } from '../services/calendarApi';

const DEFAULT_ARROW_SETTINGS: ArrowDesignSettings = {
  thickness: 'normal',
  pattern: 'solid',
  headStyle: 'standard',
};

interface CalendarContextType {
  calendars: GoogleCalendar[];
  visibleCalendarIds: Set<string>;
  toggleCalendarVisibility: (id: string) => void;
  setAllCalendarsVisible: (visible: boolean) => void;
  arrowSettings: ArrowDesignSettings;
  updateArrowSettings: (settings: Partial<ArrowDesignSettings>) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  isSyncing: boolean;
  refreshCalendars: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

const STORAGE_KEY_PREFS = 'calhub_preferences_v1';
const STORAGE_KEY_CALENDARS = 'calhub_cached_calendars_v1';
const STORAGE_KEY_AUTH_TOKEN = 'calhub_google_auth_token_v1';
const STORAGE_KEY_AUTH_EXPIRES = 'calhub_google_auth_expires_v1';

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authToken, setAuthTokenState] = useState<string | null>(() => {
    try {
      const savedToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      const savedExpires = localStorage.getItem(STORAGE_KEY_AUTH_EXPIRES);
      if (savedToken && savedExpires && Number(savedExpires) > Date.now()) {
        return savedToken;
      }
    } catch {
      // fallback
    }
    return null;
  });

  const setAuthToken = useCallback((token: string | null) => {
    setAuthTokenState(token);
    try {
      if (!token) {
        localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEY_AUTH_EXPIRES);
      }
    } catch {
      // ignore
    }
  }, []);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Cached or mock calendars
  const [calendars, setCalendars] = useState<GoogleCalendar[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CALENDARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return MOCK_CALENDARS;
  });

  // Load initial preferences
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.visibleCalendarIds && parsed.visibleCalendarIds.length > 0) {
          return new Set(parsed.visibleCalendarIds);
        }
      }
    } catch {
      // fallback
    }
    return new Set(MOCK_CALENDARS.map((c) => c.id));
  });

  const [arrowSettings, setArrowSettings] = useState<ArrowDesignSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.arrowSettings) return parsed.arrowSettings;
      }
    } catch {
      // fallback
    }
    return DEFAULT_ARROW_SETTINGS;
  });

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Fetch calendars when token becomes available
  const refreshCalendars = useCallback(async () => {
    if (!authToken) {
      setCalendars(MOCK_CALENDARS);
      return;
    }

    try {
      setIsSyncing(true);
      const googleCalendars = await CalendarApiService.listCalendars(authToken);
      if (googleCalendars.length > 0) {
        setCalendars(googleCalendars);
        localStorage.setItem(STORAGE_KEY_CALENDARS, JSON.stringify(googleCalendars));

        // Ensure newly loaded calendars are visible if none selected
        setVisibleCalendarIds((prev) => {
          if (prev.size === 0) {
            return new Set(googleCalendars.map((c) => c.id));
          }
          // Retain existing selections that match, add new ones if empty
          const next = new Set<string>();
          googleCalendars.forEach((c) => {
            if (prev.has(c.id) || prev.has('primary')) {
              next.add(c.id);
            }
          });
          return next.size > 0 ? next : new Set([googleCalendars[0].id]);
        });
      }
    } catch (err) {
      console.error('Failed to sync Google calendars:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      refreshCalendars();
    }
  }, [authToken, refreshCalendars]);

  // Sync preferences to localStorage
  useEffect(() => {
    try {
      const prefs: Partial<UserPreferences> = {
        visibleCalendarIds: Array.from(visibleCalendarIds),
        arrowSettings,
        theme,
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save preferences to localStorage', e);
    }
  }, [visibleCalendarIds, arrowSettings, theme]);

  const toggleCalendarVisibility = (id: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) {
          next.delete(id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setAllCalendarsVisible = (visible: boolean) => {
    if (visible) {
      setVisibleCalendarIds(new Set(calendars.map((c) => c.id)));
    } else {
      const firstId = calendars[0]?.id || 'primary';
      setVisibleCalendarIds(new Set([firstId]));
    }
  };

  const updateArrowSettings = (settings: Partial<ArrowDesignSettings>) => {
    setArrowSettings((prev) => ({ ...prev, ...settings }));
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  return (
    <CalendarContext.Provider
      value={{
        calendars,
        visibleCalendarIds,
        toggleCalendarVisibility,
        setAllCalendarsVisible,
        arrowSettings,
        updateArrowSettings,
        theme,
        toggleTheme,
        authToken,
        setAuthToken,
        isSyncing,
        refreshCalendars,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) throw new Error('useCalendar must be used within a CalendarProvider');
  return context;
};
