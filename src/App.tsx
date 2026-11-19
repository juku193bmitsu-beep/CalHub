import React, { useState } from 'react';
import { CalendarProvider, useCalendar } from './contexts/CalendarContext';
import { EventProvider, useEvents } from './contexts/EventContext';
import { ClipboardProvider, useClipboard } from './contexts/ClipboardContext';
import { Header } from './components/common/Header';
import { AuthBar } from './components/common/AuthBar';
import { CopyStatusBar } from './components/common/CopyStatusBar';
import { VerticalView } from './components/views/VerticalView';
import { MonthlyView } from './components/views/MonthlyView';
import { WeeklyView } from './components/views/WeeklyView';
import { WeeklyTimeGridView } from './components/views/WeeklyTimeGridView';
import { CompareView } from './components/views/CompareView';
import { EventDetailModal } from './components/events/EventDetailModal';
import { SearchModal } from './components/search/SearchModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { YearMonthPickerModal } from './components/pickers/YearMonthPickerModal';
import { CalendarViewType } from './types/view';
import { CalendarEvent } from './types/calendar';
import { formatLocalDate, parseLocalDate } from './services/dateUtils';
import { Check } from 'lucide-react';

const STORAGE_KEY_VIEW = 'calhub_view_type_v1';

export const CalHubApp: React.FC = () => {
  const { setAuthToken } = useCalendar();
  const { addEvent } = useEvents();
  const { copiedEvent } = useClipboard();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [pasteToast, setPasteToast] = useState<string | null>(null);

  // Persist view type preference in localStorage
  const [viewType, setViewType] = useState<CalendarViewType>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW);
      if (saved === 'vertical' || saved === 'month' || saved === 'timegrid' || saved === 'week' || saved === 'compare') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'vertical'; // Default to Vertical View as per spec
  });

  const handleViewChange = (newView: CalendarViewType) => {
    setViewType(newView);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, newView);
    } catch {
      // ignore
    }
  };

  // Modals
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [targetEvent, setTargetEvent] = useState<CalendarEvent | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isArrowSettingsOpen, setIsArrowSettingsOpen] = useState(false);
  const [isYearMonthPickerOpen, setIsYearMonthPickerOpen] = useState(false);

  // Navigations
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewType === 'week' || viewType === 'timegrid') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewType === 'week' || viewType === 'timegrid') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSelectYearMonth = (year: number, month: number) => {
    const d = new Date(currentDate);
    // Keep day within bounds of the target month
    const maxDays = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(d.getDate(), maxDays);
    d.setFullYear(year, month - 1, clampedDay);
    setCurrentDate(d);
  };

  // Universal Date Click Handler (handles both Paste and Open Detail)
  const handleDateClick = (date: Date) => {
    if (copiedEvent) {
      // Fast continuous paste to this date
      const targetDateStr = formatLocalDate(date);

      if (copiedEvent.isAllDay || copiedEvent.start.date) {
        addEvent({
          ...copiedEvent,
          start: { date: targetDateStr },
          end: { date: targetDateStr },
        });
      } else {
        const oldStart = new Date(copiedEvent.start.dateTime || '');
        const oldEnd = new Date(copiedEvent.end.dateTime || '');
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        const newStart = new Date(oldStart);
        newStart.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        const newEnd = new Date(newStart.getTime() + durationMs);

        addEvent({
          ...copiedEvent,
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        });
      }

      setPasteToast(`${date.getMonth() + 1}/${date.getDate()} に貼り付けました`);
      setTimeout(() => setPasteToast(null), 1800);
      return;
    }

    setSelectedDate(date);
    setTargetEvent(null);
    setIsDetailOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setTargetEvent(event);
    const dateStr = event.start.date || event.start.dateTime;
    if (dateStr) {
      setSelectedDate(parseLocalDate(dateStr));
    }
    setIsDetailOpen(true);
  };

  const handleSelectSearchedEvent = (event: CalendarEvent) => {
    setTargetEvent(event);
    const dateStr = event.start.date || event.start.dateTime;
    if (dateStr) {
      const d = parseLocalDate(dateStr);
      setCurrentDate(d);
      setSelectedDate(d);
    }
    setIsDetailOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto bg-white dark:bg-slate-900 overflow-hidden relative shadow-2xl">
      {/* Header */}
      <Header
        currentDate={currentDate}
        viewType={viewType}
        onViewChange={handleViewChange}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenArrowSettings={() => setIsArrowSettingsOpen(true)}
        onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
      />

      {/* Auth Status & Reconnect Bar */}
      <AuthBar onTokenChange={setAuthToken} />

      {/* Main View Area (Expanded vertical space without FilterBar) */}
      <main className="flex-1 flex overflow-hidden relative">
        {viewType === 'vertical' && (
          <VerticalView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onPrevMonth={handlePrev}
            onNextMonth={handleNext}
          />
        )}
        {viewType === 'month' && (
          <MonthlyView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onPrevMonth={handlePrev}
            onNextMonth={handleNext}
          />
        )}
        {viewType === 'timegrid' && (
          <WeeklyTimeGridView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onPrevWeek={handlePrev}
            onNextWeek={handleNext}
          />
        )}
        {viewType === 'week' && (
          <WeeklyView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onPrevWeek={handlePrev}
            onNextWeek={handleNext}
          />
        )}
        {viewType === 'compare' && (
          <CompareView
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onPrevMonth={handlePrev}
            onNextMonth={handleNext}
          />
        )}
      </main>

      {/* Paste Notification Toast */}
      {pasteToast && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="bg-slate-900/90 text-white dark:bg-slate-800/95 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md border border-slate-700/60">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{pasteToast}</span>
          </div>
        </div>
      )}

      {/* Modals & Sticky Overlays */}
      <EventDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        initialDate={selectedDate}
        targetEvent={targetEvent}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectEvent={handleSelectSearchedEvent}
      />

      <SettingsModal
        isOpen={isArrowSettingsOpen}
        onClose={() => setIsArrowSettingsOpen(false)}
      />

      <YearMonthPickerModal
        isOpen={isYearMonthPickerOpen}
        onClose={() => setIsYearMonthPickerOpen(false)}
        currentDate={currentDate}
        onSelectYearMonth={handleSelectYearMonth}
      />

      <CopyStatusBar />
    </div>
  );
};

export default function App() {
  return (
    <CalendarProvider>
      <EventProvider>
        <ClipboardProvider>
          <CalHubApp />
        </ClipboardProvider>
      </EventProvider>
    </CalendarProvider>
  );
}
