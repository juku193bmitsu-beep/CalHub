import React, { useState } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { useLongPress } from '../../hooks/useLongPress';
import { useClipboard } from '../../contexts/ClipboardContext';
import { useEvents } from '../../contexts/EventContext';
import { Copy, Edit2, Trash2 } from 'lucide-react';

interface EventChipProps {
  event: CalendarEvent;
  onOpenDetail: (event: CalendarEvent) => void;
  isCompact?: boolean;
  isMultiDayChild?: boolean; // If part of multi-day span (non-first day in vertical view)
}

export const EventChip: React.FC<EventChipProps> = ({
  event,
  onOpenDetail,
  isCompact = false,
  isMultiDayChild = false,
}) => {
  const { copyEvent } = useClipboard();
  const { deleteEvent } = useEvents();
  const [showMenu, setShowMenu] = useState(false);

  // If this is a child day of multi-day in vertical view, the arrow renderer covers it
  if (isMultiDayChild) return null;

  const handleLongPress = () => {
    setShowMenu(true);
  };

  const handleClick = () => {
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    onOpenDetail(event);
  };

  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    delay: 450,
  });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyEvent(event);
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEvent(event.id);
    setShowMenu(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onOpenDetail(event);
  };

  // Format time if not all-day
  const timeText = event.isAllDay || !event.start.dateTime
    ? ''
    : new Date(event.start.dateTime).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

  const bgCol = event.backgroundColor || '#039be5';

  return (
    <div className="relative inline-block max-w-full">
      <div
        {...longPressProps}
        style={{
          borderLeftColor: bgCol,
        }}
        className={`no-select cursor-pointer transition-all active:scale-98 select-none rounded-md px-1.5 py-0.5 text-xs font-medium flex items-center gap-1.5 truncate shadow-xs border-l-[3px] bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-t border-r border-b border-slate-200/50 dark:border-slate-700/50 ${
          isCompact ? 'py-0 text-[10px]' : ''
        }`}
      >
        {timeText && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal tabular-nums shrink-0">
            {timeText}
          </span>
        )}
        <span className="truncate">{event.summary || '(タイトルなし)'}</span>
      </div>

      {/* Context Menu on Long Press */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div className="absolute left-0 bottom-full mb-1 z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-1 flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={handleCopy}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap active:bg-slate-700"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>コピー</span>
            </button>
            <button
              onClick={handleEdit}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap active:bg-slate-700"
            >
              <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>詳細・編集</span>
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-rose-400 font-medium whitespace-nowrap active:bg-slate-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>削除</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
