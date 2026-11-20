import React, { useState } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { useLongPress } from '../../hooks/useLongPress';
import { useClipboard } from '../../contexts/ClipboardContext';
import { useEvents } from '../../contexts/EventContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { isClickSuppressed, triggerHaptic } from '../../services/gestureUtils';
import { Copy, Edit2, Trash2 } from 'lucide-react';

interface EventChipProps {
  event: CalendarEvent;
  onOpenDetail: (event: CalendarEvent) => void;
  isCompact?: boolean;
  isMultiDayChild?: boolean;
  isDraggable?: boolean;
  showTime?: boolean;
  isMultiDayStart?: boolean;
  className?: string;
}

import { resolveEventTextColor } from '../../services/colorUtils';

export const EventChip: React.FC<EventChipProps> = ({
  event,
  onOpenDetail,
  isCompact = false,
  isMultiDayChild = false,
  isDraggable = true,
  showTime = false,
  isMultiDayStart: _isMultiDayStart = false,
  className,
}) => {
  const { copyEvent } = useClipboard();
  const { deleteEvent } = useEvents();
  const {
    calendars,
    allDayEventStyle = 'filled',
    timedEventStyle = 'underbar',
    verticalFontSize,
    verticalFontWeight,
  } = useCalendar();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // If this is a child day of multi-day in vertical view, the arrow renderer covers it
  if (isMultiDayChild) return null;

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setMenuPos({ x: clientX, y: clientY });
    setShowMenu(true);
  };

  const handleClick = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isClickSuppressed()) {
      return;
    }
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    triggerHaptic('light');
    onOpenDetail(event);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    delay: 450,
    threshold: 12,
  });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', event.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyEvent(event);
    triggerHaptic('medium');
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

  // Determine if it's an all-day event
  const isAllDay = !!event.isAllDay || (!event.start.dateTime && !!event.start.date);

  // Format time if explicitly enabled and not all-day
  const timeText =
    showTime && !isAllDay && event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '';

  const calendar = calendars.find((c) => c.id === event.calendarId);
  const rawColor = event.backgroundColor || calendar?.backgroundColor || '#039be5';
  const customTextColor = resolveEventTextColor(event, calendar, isAllDay, rawColor);

  // Typography mapping for title & time based on 7 fine-grained settings
  const titleSizeClass = isCompact
    ? verticalFontSize === 'huge'
      ? 'text-[13.5px]'
      : verticalFontSize === 'xlarge'
      ? 'text-[12.5px]'
      : verticalFontSize === 'large'
      ? 'text-[11.5px]'
      : verticalFontSize === 'medium'
      ? 'text-[11px]'
      : verticalFontSize === 'normal'
      ? 'text-[10px]'
      : verticalFontSize === 'small'
      ? 'text-[9.5px]'
      : 'text-[9px]'
    : verticalFontSize === 'huge'
    ? 'text-[14px] sm:text-[15px]'
    : verticalFontSize === 'xlarge'
    ? 'text-[13px] sm:text-sm'
    : verticalFontSize === 'large'
    ? 'text-[12.5px] sm:text-[13.5px]'
    : verticalFontSize === 'medium'
    ? 'text-[12px] sm:text-[13px]'
    : verticalFontSize === 'normal'
    ? 'text-[11px] sm:text-xs'
    : verticalFontSize === 'small'
    ? 'text-[10px] sm:text-[11px]'
    : 'text-[9.5px] sm:text-[10px]';

  const titleWeightClass =
    verticalFontWeight === 'extrabold'
      ? 'font-extrabold'
      : verticalFontWeight === 'bold'
      ? 'font-bold'
      : 'font-medium';

  const timeSizeClass =
    verticalFontSize === 'huge'
      ? 'text-[11.5px] sm:text-[12.5px]'
      : verticalFontSize === 'xlarge'
      ? 'text-[11px] sm:text-[12px]'
      : verticalFontSize === 'large'
      ? 'text-[10.5px] sm:text-[11.5px]'
      : verticalFontSize === 'medium'
      ? 'text-[10px] sm:text-[11px]'
      : verticalFontSize === 'normal'
      ? 'text-[9.5px] sm:text-[10px]'
      : verticalFontSize === 'small'
      ? 'text-[9px] sm:text-[9.5px]'
      : 'text-[8.5px] sm:text-[9px]';

  // 終日・連日は allDayEventStyle、時間指定は timedEventStyle を適用
  const styleType = isAllDay ? allDayEventStyle : timedEventStyle;

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={(e) => e.stopPropagation()}
      className={`relative inline-flex min-w-0 ${
        className || 'w-[84px] xs:w-[88px] sm:w-[130px] md:w-[150px] shrink-0'
      }`}
    >
      <div
        {...longPressProps}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={
          styleType === 'underbar'
            ? {
                backgroundColor: 'transparent',
                borderBottom: `2.5px solid ${rawColor}`,
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderRadius: '0px',
                ...(customTextColor ? { color: customTextColor } : {}),
              }
            : styleType === 'none'
            ? {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                border: 'none',
                ...(customTextColor ? { color: customTextColor } : {}),
              }
            : {
                // 'filled' (濃い背景に白文字)
                backgroundColor: rawColor,
                borderColor: 'transparent',
                ...(customTextColor ? { color: customTextColor } : { color: '#ffffff' }),
              }
        }
        className={`w-full no-select cursor-grab active:cursor-grabbing transition-all select-none flex items-center gap-1 overflow-hidden ${
          styleType === 'underbar'
            ? 'px-1 pt-0 pb-[1.5px] text-slate-800 dark:text-slate-100 shadow-none leading-none border-b-[2.5px]'
            : styleType === 'none'
            ? 'px-1 py-[1.5px] text-slate-800 dark:text-slate-100 shadow-none border-0 leading-none hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded'
            : 'rounded-md px-1.5 py-[2px] text-white shadow-2xs border border-transparent leading-none'
        } ${
          isDragging ? 'opacity-40 scale-95 border-dashed border-blue-400' : ''
        }`}
      >
        {/* For "none" style (何もなし), show a neat color dot indicator */}
        {styleType === 'none' && (
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: rawColor }}
          />
        )}

        {timeText && (
          <span
            style={customTextColor ? { color: customTextColor } : undefined}
            className={`${timeSizeClass} ${
              styleType === 'filled' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
            } font-normal tabular-nums shrink-0 leading-none`}
          >
            {timeText}
          </span>
        )}

        <span
          style={customTextColor ? { color: customTextColor } : undefined}
          className={`truncate leading-none tracking-tight flex-1 ${titleSizeClass} ${titleWeightClass} ${
            styleType === 'filled' ? 'text-white' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {event.summary || '(タイトルなし)'}
        </span>
      </div>

      {/* Context Menu on Right Click or Long Press */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-50 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(false);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            style={
              menuPos
                ? {
                    position: 'fixed',
                    left: `${Math.min(window.innerWidth - 230, Math.max(10, menuPos.x - 20))}px`,
                    top: `${Math.max(10, Math.min(window.innerHeight - 50, menuPos.y - 42))}px`,
                  }
                : undefined
            }
            className={`${
              menuPos ? '' : 'absolute left-0 bottom-full mb-1'
            } z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-1 flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95 duration-150`}
          >
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap active:bg-slate-700 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>コピー</span>
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-slate-200 font-medium whitespace-nowrap active:bg-slate-700 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>編集</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1.5 text-rose-400 font-medium whitespace-nowrap active:bg-slate-700 cursor-pointer"
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
