import React, { createContext, useContext, useState, useCallback } from 'react';
import { CalendarEvent } from '../types/calendar';
import { triggerHaptic } from '../services/gestureUtils';

interface ClipboardContextType {
  copiedEvent: CalendarEvent | null;
  copyToastMessage: string | null;
  copyEvent: (event: CalendarEvent) => void;
  clearClipboard: () => void;
}

const ClipboardContext = createContext<ClipboardContextType | null>(null);

export const ClipboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [copiedEvent, setCopiedEvent] = useState<CalendarEvent | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  const copyEvent = useCallback((event: CalendarEvent) => {
    setCopiedEvent(event);
    triggerHaptic('medium');
    setCopyToastMessage(`「${event.summary || '予定'}」をコピーしました`);
    setTimeout(() => {
      setCopyToastMessage(null);
    }, 2400);
  }, []);

  const clearClipboard = useCallback(() => {
    setCopiedEvent(null);
    setCopyToastMessage(null);
  }, []);

  return (
    <ClipboardContext.Provider value={{ copiedEvent, copyToastMessage, copyEvent, clearClipboard }}>
      {children}
    </ClipboardContext.Provider>
  );
};

export const useClipboard = () => {
  const context = useContext(ClipboardContext);
  if (!context) throw new Error('useClipboard must be used within a ClipboardProvider');
  return context;
};
