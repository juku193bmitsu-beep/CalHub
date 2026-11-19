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
  isMultiDayChild?: boolean;
  isDraggable?: boolean;
  showTime?: boolean;
  isMultiDayStart?: boolean;
}

// Convert hex color to rgba with specific opacity
function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const EventChip: React.FC<EventChipProps> = ({
  event,
  onOpenDetail,
  isCompact = false,
  isMultiDayChild = false,
  isDraggable = true,
  showTime = false,
  isMultiDayStart = false,
}) => {
  const { copyEvent } = useClipboard();
  const { deleteEvent } = useEvents();
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
    }
    if (showMenu) {
      setShowMenu(false);
      return;
    }
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

  const rawColor = event.backgroundColor || '#039be5';
  const bgColorLight = hexToRgba(rawColor, 0.12);
  const borderColorLight = hexToRgba(rawColor, 0.28);

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={(e) => e.stopPropagation()}
      className="relative inline-block w-full max-w-full sm:max-w-[240px] shrink min-w-0"
    >
      <div
        {...longPressProps}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={
          isAllDay
            ? {
                backgroundColor: rawColor,
                borderColor: 'transparent',
                color: '#ffffff',
              }
            : {
                backgroundColor: bgColorLight,
                borderColor: borderColorLight,
              }
        }
        className={`no-select cursor-grab active:cursor-grabbing transition-all select-none text-xs flex items-center gap-1.5 shadow-2xs border hover:shadow-xs w-full overflow-hidden ${
          isMultiDayStart
            ? 'rounded-lg pl-1.5 pr-2.5 py-0.5'
            : 'rounded-lg px-2 py-0.5'
        } ${
          isAllDay
            ? 'font-medium text-white shadow-xs'
            : 'font-medium text-slate-800 dark:text-slate-100'
        } ${isCompact ? 'py-0 text-[10px] px-1.5' : ''} ${
          isDragging ? 'opacity-40 scale-95 border-dashed border-blue-400' : ''
        }`}
      >
        {/* Visual Differentiation & Anchor Pin for Multi-Day Arrow */}
        {isMultiDayStart ? (
          <span
            className="w-2 h-2 rounded-full bg-white ring-2 ring-white/40 shrink-0 shadow-xs"
            title="複数日予定の起点"
          />
        ) : isAllDay ? (
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
        ) : (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: rawColor }}
          />
        )}

        {timeText && (
          <span className="text-[10px] opacity-80 font-normal tabular-nums shrink-0">
            {timeText}
          </span>
        )}

        <span className="truncate leading-tight font-medium tracking-tight">
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
