import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { parseLinksInText } from '../../services/urlParser';
import { getJapaneseHoliday } from '../../constants/holidays';
import { DrumTimePicker } from '../pickers/DrumTimePicker';
import { formatLocalDate, isEventOnDate } from '../../services/dateUtils';
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
} from 'lucide-react';

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

  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(targetEvent);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form states
  const [formSummary, setFormSummary] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCalendarId, setFormCalendarId] = useState('primary');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(11);
  const [endMinute, setEndMinute] = useState(0);

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
    setStartHour(10);
    setStartMinute(0);
    setEndHour(11);
    setEndMinute(0);
  };

  // Rule: changing start time auto-shifts end time to keep duration
  const handleStartTimeChange = (newH: number, newM: number) => {
    const oldDurationMin = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    const validDuration = oldDurationMin > 0 ? oldDurationMin : 60;

    setStartHour(newH);
    setStartMinute(newM);

    const newEndTotal = newH * 60 + newM + validDuration;
    if (newEndTotal >= 24 * 60) {
      // Cap at 23:55
      setEndHour(23);
      setEndMinute(55);
    } else {
      setEndHour(Math.floor(newEndTotal / 60));
      setEndMinute(newEndTotal % 60);
    }
  };

  const handleEndTimeChange = (newH: number, newM: number) => {
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
      const [y, m, d] = dateStr.split('-').map(Number);
      const nextDay = new Date(y, m - 1, d + 1);
      const nextDayStr = formatLocalDate(nextDay);

      startObj = { date: dateStr };
      endObj = { date: nextDayStr }; // Exclusive end date for API compatibility
    } else {
      const sDate = new Date(currentDate);
      sDate.setHours(startHour, startMinute, 0, 0);
      const eDate = new Date(currentDate);
      eDate.setHours(endHour, endMinute, 0, 0);

      startObj = { dateTime: sDate.toISOString() };
      endObj = { dateTime: eDate.toISOString() };
    }

    if (isCreatingNew) {
      addEvent({
        calendarId: formCalendarId,
        summary: formSummary.trim(),
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        isAllDay: formIsAllDay,
        start: startObj,
        end: endObj,
        backgroundColor: bgCol,
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
        backgroundColor: bgCol,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Top Header / Day Navigation */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDay}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
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
              onClick={handleNextDay}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {!isCreatingNew && !editingEvent && (
              <button
                onClick={handleStartNewForm}
                className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新規作成</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsCreatingNew(false);
                setEditingEvent(null);
                onClose();
              }}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: List View OR Create/Edit Form */}
        <div className="flex-1 overflow-y-auto p-4">
          {isCreatingNew || editingEvent ? (
            /* Create / Edit Form */
            <form onSubmit={handleSaveForm} className="space-y-4">
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

              {/* All-day switch */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  終日予定
                </span>
                <input
                  type="checkbox"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                />
              </div>

              {/* 24h Drum Time Pickers (if not all day) */}
              {!formIsAllDay && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      開始時刻
                    </label>
                    <DrumTimePicker
                      hour={startHour}
                      minute={startMinute}
                      onChange={handleStartTimeChange}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      終了時刻
                    </label>
                    <DrumTimePicker
                      hour={endHour}
                      minute={endMinute}
                      onChange={handleEndTimeChange}
                    />
                  </div>
                </div>
              )}

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
                  rows={3}
                  placeholder="詳細メモ、参考URL（https://...）など"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition active:scale-98"
                >
                  保存する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  キャンセル
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* Day Event List (View Mode) */
            <div className="space-y-3">
              {dayEvents.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <p className="text-slate-400 dark:text-slate-500 text-xs">
                    この日の予定はありません。
                  </p>
                  <button
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
                        <button
                          onClick={() => {
                            setEditingEvent(ev);
                            populateForm(ev);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="予定を編集"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Time */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {ev.isAllDay || !ev.start.dateTime
                            ? '終日'
                            : `${new Date(ev.start.dateTime).toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })} - ${new Date(ev.end.dateTime || '').toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}`}
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
      </div>
    </div>
  );
};
