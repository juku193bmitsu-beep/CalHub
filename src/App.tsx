import React, { useState } from 'react';
import { CalendarProvider } from './contexts/CalendarContext';
import { EventProvider } from './contexts/EventContext';
import { ClipboardProvider } from './contexts/ClipboardContext';
import { Header } from './components/common/Header';
import { FilterBar } from './components/common/FilterBar';
import { AuthBar } from './components/common/AuthBar';
import { CopyStatusBar } from './components/common/CopyStatusBar';
import { VerticalView } from './components/views/VerticalView';
import { MonthlyView } from './components/views/MonthlyView';
import { WeeklyView } from './components/views/WeeklyView';
import { CompareView } from './components/views/CompareView';
import { EventDetailModal } from './components/events/EventDetailModal';
import { SearchModal } from './components/search/SearchModal';
import { ArrowStylePicker } from './components/pickers/ArrowStylePicker';
import { CalendarViewType } from './types/view';
import { CalendarEvent } from './types/calendar';

const STORAGE_KEY_VIEW = 'calhub_view_type_v1';

export const CalHubApp: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Persist view type preference in localStorage
  const [viewType, setViewType] = useState<CalendarViewType>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW);
      if (saved === 'vertical' || saved === 'month' || saved === 'week' || saved === 'compare') {
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

  // Navigations
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewType === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewType === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setTargetEvent(null);
    setIsDetailOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setTargetEvent(event);
    const dateStr = event.start.date || event.start.dateTime;
    if (dateStr) {
      setSelectedDate(new Date(dateStr));
    }
    setIsDetailOpen(true);
  };

  const handleSelectSearchedEvent = (event: CalendarEvent) => {
    setTargetEvent(event);
    const dateStr = event.start.date || event.start.dateTime;
    if (dateStr) {
      const d = new Date(dateStr);
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
      />

      {/* Auth Status & Reconnect Bar */}
      <AuthBar onTokenChange={() => {}} />

      {/* Calendar Filter Pills Bar */}
      <FilterBar />

      {/* Main View Area */}
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
          />
        )}
      </main>

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

      <ArrowStylePicker
        isOpen={isArrowSettingsOpen}
        onClose={() => setIsArrowSettingsOpen(false)}
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
