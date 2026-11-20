import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { useClipboard } from '../../contexts/ClipboardContext';
import { parseLinksInText } from '../../services/urlParser';
import { getJapaneseHoliday } from '../../constants/holidays';
import { DrumTimePicker } from '../pickers/DrumTimePicker';
import {
  formatLocalDate,
  isEventOnDate,
  getEventStartDateStr,
  getEventEndDateInclusiveStr,
} from '../../services/dateUtils';
import { triggerHaptic } from '../../services/gestureUtils';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  AlignLeft,
  Clock,
  ExternalLink,
  Edit3,
  Copy,
  Check,
  Calendar,
  Palette,
  Type,
} from 'lucide-react';
import {
  TEXT_COLOR_PRESETS,
  BG_COLOR_PRESETS,
  getAutoTextColor,
  hexToRgba,
} from '../../services/colorUtils';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate: Date | null;
  targetEvent?: CalendarEvent | null;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  targetEvent = null,
}) => {
  const { filteredEvents, addEvent, updateEvent, deleteEvent } = useEvents();
  const { calendars } = useCalendar();
  const { copiedEvent, copyEvent, clearClipboard } = useClipboard();

  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(targetEvent);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Track visualViewport height dynamically for mobile software keyboard adjustments
  const [viewportHeight, setViewportHeight] = useState<number | null>(() => {
    return typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : null;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Form states
  const [formSummary, setFormSummary] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCalendarId, setFormCalendarId] = useState('primary');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formStartDate, setFormStartDate] = useState(() => formatLocalDate(initialDate || new Date()));
  const [formEndDate, setFormEndDate] = useState(() => formatLocalDate(initialDate || new Date()));
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(11);
  const [endMinute, setEndMinute] = useState(0);
  const [formForegroundColor, setFormForegroundColor] = useState<string>('auto');
  const [formBackgroundColor, setFormBackgroundColor] = useState<string>('');
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (initialDate) setCurrentDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreatingNew(false);
        setEditingEvent(null);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (targetEvent) {
      setEditingEvent(targetEvent);
      setIsCreatingNew(false);
      populateForm(targetEvent);
    } else {
      setEditingEvent(null);
      setIsCreatingNew(false);
    }
  }, [targetEvent]);

  const populateForm = (ev: CalendarEvent) => {
    setFormSummary(ev.summary);
    setFormLocation(ev.location || '');
    setFormDescription(ev.description || '');
    setFormCalendarId(ev.calendarId);
    setFormIsAllDay(!!ev.isAllDay || !!ev.start.date);
    setFormForegroundColor(
      ev.customTextColor || (ev.foregroundColor && ev.foregroundColor !== '#ffffff' ? ev.foregroundColor : 'auto')
    );
    setFormBackgroundColor(ev.backgroundColor || '');

    const sDateStr = getEventStartDateStr(ev) || formatLocalDate(currentDate);
    const eDateStr = getEventEndDateInclusiveStr(ev) || sDateStr;
    setFormStartDate(sDateStr);
    setFormEndDate(eDateStr);

    if (ev.start.dateTime) {
      const s = new Date(ev.start.dateTime);
      setStartHour(s.getHours());
      setStartMinute(s.getMinutes());
    } else {
      setStartHour(10);
      setStartMinute(0);
    }

    if (ev.end.dateTime) {
      const e = new Date(ev.end.dateTime);
      setEndHour(e.getHours());
      setEndMinute(e.getMinutes());
    } else {
      setEndHour(11);
      setEndMinute(0);
    }
  };

  const handleStartNewForm = () => {
    setEditingEvent(null);
    setIsCreatingNew(true);
    setFormSummary('');
    setFormLocation('');
    setFormDescription('');
    setFormCalendarId(calendars[0]?.id || 'primary');
    setFormIsAllDay(false);
    const curDateStr = formatLocalDate(currentDate);
    setFormStartDate(curDateStr);
    setFormEndDate(curDateStr);
    setStartHour(10);
    setStartMinute(0);
    setEndHour(11);
    setEndMinute(0);
    setFormForegroundColor('auto');
    setFormBackgroundColor('');
  };

  const handleStartDateChange = (newDateStr: string) => {
    setFormStartDate(newDateStr);
    if (newDateStr > formEndDate) {
      setFormEndDate(newDateStr);
    }
  };

  const handleEndDateChange = (newDateStr: string) => {
    setFormEndDate(newDateStr);
    if (newDateStr < formStartDate) {
      setFormStartDate(newDateStr);
    }
  };

  // Rule: changing start time auto-shifts end time to keep duration if on same day
  const handleStartTimeChange = (newH: number, newM: number) => {
    setStartHour(newH);
    setStartMinute(newM);

    if (formStartDate === formEndDate) {
      const oldDurationMin = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      const validDuration = oldDurationMin > 0 ? oldDurationMin : 60;
      const newEndTotal = newH * 60 + newM + validDuration;
      if (newEndTotal >= 24 * 60) {
        setEndHour(23);
        setEndMinute(55);
      } else {
        setEndHour(Math.floor(newEndTotal / 60));
        setEndMinute(newEndTotal % 60);
      }
    }
  };

  const handleEndTimeChange = (newH: number, newM: number) => {
    if (formStartDate === formEndDate) {
      const startTotal = startHour * 60 + startMinute;
      const endTotal = newH * 60 + newM;

      if (endTotal <= startTotal) {
        // Must be at least 15 min after start
        const adjusted = Math.min(23 * 60 + 55, startTotal + 15);
        setEndHour(Math.floor(adjusted / 60));
        setEndMinute(adjusted % 60);
      } else {
        setEndHour(newH);
        setEndMinute(newM);
      }
    } else {
      setEndHour(newH);
      setEndMinute(newM);
    }
  };

  const getDurationText = () => {
    const [sy, sm, sd] = formStartDate.split('-').map(Number);
    const [ey, em, ed] = formEndDate.split('-').map(Number);
    const s = new Date(sy, sm - 1, sd, startHour, startMinute).getTime();
    const e = new Date(ey, em - 1, ed, endHour, endMinute).getTime();
    const diffMin = Math.round((e - s) / (1000 * 60));
    if (diffMin <= 0) return '0分';
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    if (h === 0) return `${m}分間`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
  };

  const applyQuickDuration = (addMinutes: number) => {
    const [sy, sm, sd] = formStartDate.split('-').map(Number);
    const sDate = new Date(sy, sm - 1, sd, startHour, startMinute);
    const newEndDate = new Date(sDate.getTime() + addMinutes * 60 * 1000);

    setFormEndDate(formatLocalDate(newEndDate));
    setEndHour(newEndDate.getHours());
    setEndMinute(newEndDate.getMinutes());
  };

  if (!isOpen) return null;

  const dateStr = formatLocalDate(currentDate);

  // Events of current day using unified inclusive logic
  const dayEvents = filteredEvents.filter((ev) => isEventOnDate(ev, dateStr));

  const holiday = getJapaneseHoliday(currentDate);
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = currentDate.getDay();

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSummary.trim()) return;

    const selectedCal = calendars.find((c) => c.id === formCalendarId);
    const bgCol = selectedCal?.backgroundColor || '#039be5';

    let startObj, endObj;
    if (formIsAllDay) {
      // For all-day event in Google Calendar API format
      // end.date is exclusive (day after the last day)
      const [ey, em, ed] = formEndDate.split('-').map(Number);
      const nextDay = new Date(ey, em - 1, ed + 1);
      const nextDayStr = formatLocalDate(nextDay);

      startObj = { date: formStartDate };
      endObj = { date: nextDayStr }; // Exclusive end date for API compatibility
    } else {
      const [sy, sm, sd] = formStartDate.split('-').map(Number);
      const sDate = new Date(sy, sm - 1, sd, startHour, startMinute, 0, 0);

      const [ey, em, ed] = formEndDate.split('-').map(Number);
      const eDate = new Date(ey, em - 1, ed, endHour, endMinute, 0, 0);

      // Guard: if end datetime is before or equal to start datetime, adjust to at least 15 mins after
      if (eDate.getTime() <= sDate.getTime()) {
        eDate.setTime(sDate.getTime() + 15 * 60 * 1000);
      }

      startObj = { dateTime: sDate.toISOString() };
      endObj = { dateTime: eDate.toISOString() };
    }

    const customFg =
      formForegroundColor && formForegroundColor !== 'auto' ? formForegroundColor : undefined;
    const finalBgCol = formBackgroundColor || bgCol;

    if (isCreatingNew) {
      addEvent({
        calendarId: formCalendarId,
        summary: formSummary.trim(),
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        isAllDay: formIsAllDay,
        start: startObj,
        end: endObj,
        backgroundColor: finalBgCol,
        foregroundColor: customFg,
        customTextColor: customFg,
      });
    } else if (editingEvent) {
      updateEvent(editingEvent.id, {
        calendarId: formCalendarId,
        summary: formSummary.trim(),
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        isAllDay: formIsAllDay,
        start: startObj,
        end: endObj,
        backgroundColor: finalBgCol,
        foregroundColor: customFg,
        customTextColor: customFg,
      });
    }

    setIsCreatingNew(false);
    setEditingEvent(null);
  };

  const handleDeleteCurrent = () => {
    if (editingEvent) {
      const ok = window.confirm(`「${editingEvent.summary || 'この予定'}」を削除してもよろしいですか？`);
      if (!ok) return;
      deleteEvent(editingEvent.id);
      setEditingEvent(null);
      setIsCreatingNew(false);
    }
  };

  // One-tap paste to current date
  const handlePasteToCurrentDay = () => {
    if (!copiedEvent) return;
    const targetDateStr = formatLocalDate(currentDate);

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
      newStart.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const newEnd = new Date(newStart.getTime() + durationMs);

      addEvent({
        ...copiedEvent,
        start: { dateTime: newStart.toISOString() },
        end: { dateTime: newEnd.toISOString() },
      });
    }
    triggerHaptic('medium');
  };

  const handleCopyFromModal = (ev: CalendarEvent) => {
    copyEvent(ev);
  };

  return (
    <div
      style={
        viewportHeight
          ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
          : undefined
      }
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        style={
          viewportHeight
            ? { maxHeight: `${viewportHeight}px`, height: isCreatingNew || editingEvent ? `${Math.min(viewportHeight, 620)}px` : undefined }
            : undefined
        }
        className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Top Header / Day Navigation */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-90 transition"
              title="前日"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-baseline gap-1.5 px-1">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {currentDate.getMonth() + 1}月{currentDate.getDate()}日
              </span>
              <span
                className={`text-xs font-semibold ${
                  dayOfWeek === 0 || holiday
                    ? 'text-rose-500'
                    : dayOfWeek === 6
                    ? 'text-blue-500'
                    : 'text-slate-500'
                }`}
              >
                ({weekdayNames[dayOfWeek]})
              </span>
              {holiday && (
                <span className="text-xs text-rose-500 font-medium">
                  {holiday}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-90 transition"
              title="翌日"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {!isCreatingNew && !editingEvent && (
              <button
                type="button"
                onClick={handleStartNewForm}
                className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition active:scale-95 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新規作成</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsCreatingNew(false);
                setEditingEvent(null);
                onClose();
              }}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: List View OR Create/Edit Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isCreatingNew || editingEvent ? (
            /* Create / Edit Form */
            <form id="event-detail-form" onSubmit={handleSaveForm} className="space-y-3.5 pb-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="予定のタイトルを入力"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Calendar Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  カレンダー
                </label>
                <select
                  value={formCalendarId}
                  onChange={(e) => setFormCalendarId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unified Compact & Stylish DateTime Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2.5">
                {/* Header: Label, Duration & All-day Switch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      日時設定
                    </span>
                    {!formIsAllDay && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 truncate">
                        {getDurationText()}
                      </span>
                    )}
                  </div>

                  {/* All-day switch */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">終日</span>
                    <input
                      type="checkbox"
                      checked={formIsAllDay}
                      onChange={(e) => {
                        setFormIsAllDay(e.target.checked);
                        if (e.target.checked) setActiveTimePicker(null);
                      }}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Start & End Dual Rows */}
                <div className="space-y-1.5">
                  {/* Start Row */}
                  <div
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      activeTimePicker === 'start'
                        ? 'bg-white dark:bg-slate-800 shadow-xs ring-1 ring-blue-500'
                        : 'bg-white/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12 shrink-0 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      開始
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <input
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                      {!formIsAllDay && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTimePicker(activeTimePicker === 'start' ? null : 'start')
                          }
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition active:scale-95 flex items-center gap-1 ${
                            activeTimePicker === 'start'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {`${startHour.toString().padStart(2, '0')}:${startMinute
                            .toString()
                            .padStart(2, '0')}`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* End Row */}
                  <div
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      activeTimePicker === 'end'
                        ? 'bg-white dark:bg-slate-800 shadow-xs ring-1 ring-blue-500'
                        : 'bg-white/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12 shrink-0 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      終了
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <input
                        type="date"
                        required
                        value={formEndDate}
                        min={formStartDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                      {!formIsAllDay && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTimePicker(activeTimePicker === 'end' ? null : 'end')
                          }
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition active:scale-95 flex items-center gap-1 ${
                            activeTimePicker === 'end'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {`${endHour.toString().padStart(2, '0')}:${endMinute
                            .toString()
                            .padStart(2, '0')}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Duration Shortcuts (Only when timed) */}
                {!formIsAllDay && (
                  <div className="flex items-center gap-1.5 pt-0.5 px-0.5">
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      ワンタップ時間設定:
                    </span>
                    <div className="flex flex-wrap items-center gap-1 flex-1">
                      {[15, 30, 60, 120].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => applyQuickDuration(mins)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition active:scale-95 shadow-2xs"
                        >
                          {mins >= 60 ? `+${mins / 60}時間` : `+${mins}分`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collapsible Smart Drum Picker */}
                {!formIsAllDay && activeTimePicker && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          {activeTimePicker === 'start' ? '開始時刻' : '終了時刻'}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg text-[10px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setActiveTimePicker('start')}
                            className={`px-1.5 py-0.5 rounded ${
                              activeTimePicker === 'start'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-2xs'
                                : 'text-slate-500'
                            }`}
                          >
                            開始
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTimePicker('end')}
                            className={`px-1.5 py-0.5 rounded ${
                              activeTimePicker === 'end'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-2xs'
                                : 'text-slate-500'
                            }`}
                          >
                            終了
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTimePicker(null)}
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                      >
                        閉じる
                      </button>
                    </div>

                    <DrumTimePicker
                      hour={activeTimePicker === 'start' ? startHour : endHour}
                      minute={activeTimePicker === 'start' ? startMinute : endMinute}
                      onChange={
                        activeTimePicker === 'start'
                          ? handleStartTimeChange
                          : handleEndTimeChange
                      }
                    />
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  場所（URL有効）
                </label>
                <input
                  type="text"
                  placeholder="会議室、住所、またはZoom URL等"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1">
                  <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                  メモ・備考（リンクは自動でワンタップ起動可能）
                </label>
                <textarea
                  rows={2}
                  placeholder="詳細メモ、参考URL（https://...）など"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                />
              </div>

              {/* Color Customization Section (Text Color & Background Color) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-500" />
                    色のカスタマイズ
                  </span>

                  {/* Real-time Chip Preview */}
                  {(() => {
                    const selCal = calendars.find((c) => c.id === formCalendarId);
                    const effectiveBg = formBackgroundColor || selCal?.backgroundColor || '#039be5';
                    const effectiveFg =
                      formForegroundColor && formForegroundColor !== 'auto'
                        ? formForegroundColor
                        : formIsAllDay
                        ? getAutoTextColor(effectiveBg)
                        : selCal?.foregroundColor || '#0f172a';
                    const previewTitle = formSummary.trim() || '予定のプレビュー';

                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">表示見本:</span>
                        <div
                          style={{
                            backgroundColor: formIsAllDay ? effectiveBg : hexToRgba(effectiveBg, 0.2),
                            borderColor: hexToRgba(effectiveBg, 0.5),
                            color: effectiveFg,
                          }}
                          className={`max-w-[130px] px-2 py-0.5 rounded-lg text-xs font-semibold truncate border shadow-2xs`}
                        >
                          {previewTitle}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 1. Text Color (文字の色) */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 flex items-center gap-1">
                    <Type className="w-3 h-3 text-slate-500" />
                    文字の色（テキストカラー）
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {TEXT_COLOR_PRESETS.map((preset) => {
                      const isSelected = formForegroundColor === preset.value;
                      if (preset.value === 'auto') {
                        return (
                          <button
                            key="auto"
                            type="button"
                            onClick={() => setFormForegroundColor('auto')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition active:scale-95 ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-400'
                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            自動
                          </button>
                        );
                      }

                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormForegroundColor(preset.value)}
                          title={preset.label}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition active:scale-95 shadow-2xs ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 border-white'
                              : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.bgHex }}
                        >
                          {isSelected && (
                            <Check
                              className={`w-3.5 h-3.5 stroke-[3] ${
                                preset.value === '#ffffff' ? 'text-slate-900' : 'text-white'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* Custom HTML Color Picker for Text */}
                    <label
                      title="カスタム文字色"
                      className="relative w-6 h-6 rounded-full border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center cursor-pointer hover:border-blue-500 transition overflow-hidden text-[9px] font-bold text-slate-500 hover:text-blue-500"
                    >
                      +
                      <input
                        type="color"
                        value={
                          formForegroundColor && formForegroundColor !== 'auto'
                            ? formForegroundColor
                            : '#000000'
                        }
                        onChange={(e) => setFormForegroundColor(e.target.value)}
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Background / Category Accent Color (予定の背景色) */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-slate-500" />
                    予定の色（アクセント・背景色）
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormBackgroundColor('')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition active:scale-95 ${
                        !formBackgroundColor
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-400'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      カレンダー標準
                    </button>

                    {BG_COLOR_PRESETS.map((preset) => {
                      const isSelected = formBackgroundColor === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormBackgroundColor(preset.value)}
                          title={preset.label}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition active:scale-95 shadow-2xs ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 border-white'
                              : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.bgHex }}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                        </button>
                      );
                    })}

                    {/* Custom HTML Color Picker for Background */}
                    <label
                      title="カスタム背景色"
                      className="relative w-6 h-6 rounded-full border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center cursor-pointer hover:border-blue-500 transition overflow-hidden text-[9px] font-bold text-slate-500 hover:text-blue-500"
                    >
                      +
                      <input
                        type="color"
                        value={formBackgroundColor || '#039be5'}
                        onChange={(e) => setFormBackgroundColor(e.target.value)}
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* Day Event List (View Mode) */
            <div className="space-y-3">
              {/* Highlighted Paste Banner when clipboard holds an event */}
              {copiedEvent && (
                <div className="p-3 rounded-2xl bg-blue-50/95 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-100 truncate">
                        コピー中:「{copiedEvent.summary}」
                      </p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        この日（{currentDate.getMonth() + 1}/{currentDate.getDate()}）に貼り付け
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePasteToCurrentDay}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>貼り付け</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearClipboard}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                      title="コピー解除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {dayEvents.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">
                    この日の予定はありません。
                  </p>
                  <button
                    type="button"
                    onClick={handleStartNewForm}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>予定を追加する</span>
                  </button>
                </div>
              ) : (
                dayEvents.map((ev) => {
                  const locationSegments = ev.location ? parseLinksInText(ev.location) : [];
                  const descSegments = ev.description ? parseLinksInText(ev.description) : [];

                  return (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col gap-2 relative group"
                    >
                      {/* Event Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: ev.backgroundColor || '#039be5' }}
                          />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {ev.summary}
                          </h4>
                        </div>
                        {/* Action Buttons: Copy & Edit */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyFromModal(ev)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 active:scale-90 transition cursor-pointer"
                            title="予定をコピー"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(ev);
                              populateForm(ev);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition cursor-pointer"
                            title="予定を編集"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Time / Date Range */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {(() => {
                            const sStr = getEventStartDateStr(ev);
                            const eStr = getEventEndDateInclusiveStr(ev);
                            const isMulti = sStr && eStr && sStr !== eStr;
                            const isAllDay = !!ev.isAllDay || !ev.start.dateTime;

                            const formatMD = (str: string) => {
                              const [, m, d] = str.split('-').map(Number);
                              return `${m}/${d}`;
                            };

                            if (isAllDay) {
                              return isMulti
                                ? `${formatMD(sStr)} 〜 ${formatMD(eStr)}（終日）`
                                : '終日';
                            }

                            const sDate = new Date(ev.start.dateTime!);
                            const eDate = new Date(ev.end.dateTime || ev.start.dateTime!);
                            const sTimeStr = sDate.toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            });
                            const eTimeStr = eDate.toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            });

                            return isMulti
                              ? `${formatMD(sStr)} ${sTimeStr} 〜 ${formatMD(eStr)} ${eTimeStr}`
                              : `${sTimeStr} - ${eTimeStr}`;
                          })()}
                        </span>
                      </div>

                      {/* Location with One-Tap Safe URL */}
                      {ev.location && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="break-all">
                            {locationSegments.map((seg, sIdx) =>
                              seg.type === 'link' ? (
                                <a
                                  key={sIdx}
                                  href={seg.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 dark:text-blue-400 underline font-medium inline-flex items-center gap-0.5 hover:text-blue-800"
                                >
                                  <span>{seg.content}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                <span key={sIdx}>{seg.content}</span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Description with One-Tap Safe URL */}
                      {ev.description && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl whitespace-pre-wrap">
                          <AlignLeft className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="break-all leading-relaxed">
                            {descSegments.map((seg, sIdx) =>
                              seg.type === 'link' ? (
                                <a
                                  key={sIdx}
                                  href={seg.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 dark:text-blue-400 underline font-medium inline-flex items-center gap-0.5 hover:text-blue-800"
                                >
                                  <span>{seg.content}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                <span key={sIdx}>{seg.content}</span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer for Create / Edit Form: Always accessible above mobile keyboard! */}
        {(isCreatingNew || editingEvent) && (
          <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {editingEvent && (
                <>
                  <button
                    type="button"
                    onClick={() => handleCopyFromModal(editingEvent)}
                    className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                    title="この予定をコピー"
                  >
                    <Copy className="w-4 h-4 text-blue-500" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition active:scale-95"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingEvent(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                form="event-detail-form"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-blue-500/20"
              >
                保存する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
