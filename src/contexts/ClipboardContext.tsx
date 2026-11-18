import React, { createContext, useContext, useState } from 'react';
import { CalendarEvent } from '../types/calendar';

interface ClipboardContextType {
  copiedEvent: CalendarEvent | null;
  copyEvent: (event: CalendarEvent) => void;
  clearClipboard: () => void;
}

const ClipboardContext = createContext<ClipboardContextType | null>(null);

export const ClipboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [copiedEvent, setCopiedEvent] = useState<CalendarEvent | null>(null);

  const copyEvent = (event: CalendarEvent) => {
    setCopiedEvent(event);
  };

  const clearClipboard = () => {
    setCopiedEvent(null);
  };

  return (
    <ClipboardContext.Provider value={{ copiedEvent, copyEvent, clearClipboard }}>
      {children}
    </ClipboardContext.Provider>
  );
};

export const useClipboard = () => {
  const context = useContext(ClipboardContext);
  if (!context) throw new Error('useClipboard must be used within a ClipboardProvider');
  return context;
};
