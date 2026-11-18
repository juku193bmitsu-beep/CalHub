import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleCalendar } from '../types/calendar';
import { ArrowDesignSettings, UserPreferences } from '../types/settings';
import { MOCK_CALENDARS } from '../services/mockData';

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
}

const CalendarContext = createContext<CalendarContextType | null>(null);

const STORAGE_KEY_PREFS = 'calhub_preferences_v1';

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [calendars] = useState<GoogleCalendar[]>(MOCK_CALENDARS);
  
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

  // Sync to localStorage
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
      // keep at least primary
      setVisibleCalendarIds(new Set(['primary']));
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
