import React, { useState } from 'react';
import { useEvents } from '../../contexts/EventContext';
import { CalendarEvent } from '../../types/calendar';
import { Search, X, Calendar as CalendarIcon, MapPin } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectEvent,
}) => {
  const { searchEvents } = useEvents();
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const results = searchEvents(query);

  const handleSelect = (ev: CalendarEvent) => {
    onSelectEvent(ev);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80dvh]">
        {/* Search input header */}
        <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-950/40">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            autoFocus
            placeholder="予定・場所・メモを全期間検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-lg"
          >
            閉じる
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {!query.trim() ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              キーワードを入力して予定を検索
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              「{query}」に一致する予定は見つかりませんでした
            </div>
          ) : (
            results.map((ev) => {
              const dateStr = ev.start.date || ev.start.dateTime?.slice(0, 10);
              return (
                <div
                  key={ev.id}
                  onClick={() => handleSelect(ev)}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer flex items-center justify-between gap-2 shadow-xs active:scale-99"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ev.backgroundColor || '#039be5' }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {ev.summary}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-0.5 tabular-nums">
                          <CalendarIcon className="w-3 h-3" />
                          {dateStr}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
