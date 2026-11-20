import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleCalendar } from '../types/calendar';
import {
  ArrowDesignSettings,
  UserPreferences,
  EventDisplayStyle,
  VerticalFontSize,
  VerticalFontWeight,
  MonthlyFontSize,
  MonthlyFontWeight,
} from '../types/settings';
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
  allDayEventStyle: EventDisplayStyle;
  setAllDayEventStyle: (style: EventDisplayStyle) => void;
  timedEventStyle: EventDisplayStyle;
  setTimedEventStyle: (style: EventDisplayStyle) => void;
  verticalFontSize: VerticalFontSize;
  setVerticalFontSize: (size: VerticalFontSize) => void;
  verticalFontWeight: VerticalFontWeight;
  setVerticalFontWeight: (weight: VerticalFontWeight) => void;
  monthlyFontSize: MonthlyFontSize;
  setMonthlyFontSize: (size: MonthlyFontSize) => void;
  monthlyFontWeight: MonthlyFontWeight;
  setMonthlyFontWeight: (weight: MonthlyFontWeight) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  isSyncing: boolean;
  refreshCalendars: () => Promise<void>;
  updateCalendarColor: (id: string, colors: { backgroundColor?: string; customTextColor?: string }) => void;
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

  // 終日・連日予定の表示スタイル（デフォルト: 'filled' = 濃い背景に白文字）
  const [allDayEventStyle, setAllDayEventStyle] = useState<EventDisplayStyle>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.allDayEventStyle === 'filled' || parsed.allDayEventStyle === 'underbar' || parsed.allDayEventStyle === 'none') {
          return parsed.allDayEventStyle;
        }
      }
    } catch {
      // fallback
    }
    return 'filled'; // デフォルト: 濃い背景に白文字
  });

  // 時間指定予定の表示スタイル（デフォルト: 'underbar' = 黒文字でアンダーライン）
  const [timedEventStyle, setTimedEventStyle] = useState<EventDisplayStyle>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.timedEventStyle === 'filled' || parsed.timedEventStyle === 'underbar' || parsed.timedEventStyle === 'none') {
          return parsed.timedEventStyle;
        }
        if ((parsed.timedEventStyle as any) === 'badge') {
          return 'filled';
        }
      }
    } catch {
      // fallback
    }
    return 'underbar'; // デフォルト: 黒文字でアンダーライン（月表示・スマホ版と統一）
  });

  const [monthlyFontSize, setMonthlyFontSize] = useState<MonthlyFontSize>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.monthlyFontSize) {
          return parsed.monthlyFontSize;
        }
      }
    } catch {
      // fallback
    }
    return 'large'; // Default to large for clear visibility
  });

  const [monthlyFontWeight, setMonthlyFontWeight] = useState<MonthlyFontWeight>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.monthlyFontWeight) {
          return parsed.monthlyFontWeight;
        }
      }
    } catch {
      // fallback
    }
    return 'bold'; // Default to bold for clear visibility
  });

  const [verticalFontSize, setVerticalFontSize] = useState<VerticalFontSize>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.verticalFontSize) {
          return parsed.verticalFontSize;
        }
      }
    } catch {
      // fallback
    }
    return 'large'; // Default to large for high readability
  });

  const [verticalFontWeight, setVerticalFontWeight] = useState<VerticalFontWeight>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.verticalFontWeight) {
          return parsed.verticalFontWeight;
        }
      }
    } catch {
      // fallback
    }
    return 'bold'; // Default to bold for high readability
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed: UserPreferences = JSON.parse(saved);
        if (parsed.theme === 'dark' || parsed.theme === 'light') {
          return parsed.theme;
        }
      }
    } catch {
      // fallback
    }
    return 'light';
  });

  // Sync dark mode class on root HTML element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
        setCalendars((prev) => {
          const prevMap = new Map(prev.map((c) => [c.id, c]));
          const merged = googleCalendars.map((gc) => {
            const existing = prevMap.get(gc.id);
            return {
              ...gc,
              ...(existing?.customTextColor ? { customTextColor: existing.customTextColor } : {}),
              ...(existing?.backgroundColor ? { backgroundColor: existing.backgroundColor } : {}),
            };
          });
          try {
            localStorage.setItem(STORAGE_KEY_CALENDARS, JSON.stringify(merged));
          } catch {}
          return merged;
        });

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
        allDayEventStyle,
        timedEventStyle,
        verticalFontSize,
        verticalFontWeight,
        monthlyFontSize,
        monthlyFontWeight,
        theme,
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save preferences to localStorage', e);
    }
  }, [visibleCalendarIds, arrowSettings, allDayEventStyle, timedEventStyle, verticalFontSize, verticalFontWeight, monthlyFontSize, monthlyFontWeight, theme]);

  const toggleCalendarVisibility = useCallback((id: string) => {
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
  }, []);

  const setAllCalendarsVisible = useCallback(
    (visible: boolean) => {
      if (visible) {
        setVisibleCalendarIds(new Set(calendars.map((c) => c.id)));
      } else {
        const firstId = calendars[0]?.id || 'primary';
        setVisibleCalendarIds(new Set([firstId]));
      }
    },
    [calendars]
  );

  const updateArrowSettings = useCallback((settings: Partial<ArrowDesignSettings>) => {
    setArrowSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const updateCalendarColor = useCallback(
    (id: string, colors: { backgroundColor?: string; customTextColor?: string }) => {
      setCalendars((prev) => {
        const next = prev.map((cal) => {
          if (cal.id === id) {
            return {
              ...cal,
              ...(colors.backgroundColor !== undefined ? { backgroundColor: colors.backgroundColor } : {}),
              ...(colors.customTextColor !== undefined ? { customTextColor: colors.customTextColor } : {}),
            };
          }
          return cal;
        });
        try {
          localStorage.setItem(STORAGE_KEY_CALENDARS, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  return (
    <CalendarContext.Provider
      value={{
        calendars,
        visibleCalendarIds,
        toggleCalendarVisibility,
        setAllCalendarsVisible,
        arrowSettings,
        updateArrowSettings,
        allDayEventStyle,
        setAllDayEventStyle,
        timedEventStyle,
        setTimedEventStyle,
        verticalFontSize,
        setVerticalFontSize,
        verticalFontWeight,
        setVerticalFontWeight,
        monthlyFontSize,
        setMonthlyFontSize,
        monthlyFontWeight,
        setMonthlyFontWeight,
        theme,
        toggleTheme,
        authToken,
        setAuthToken,
        isSyncing,
        refreshCalendars,
        updateCalendarColor,
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
