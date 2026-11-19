import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e?: React.MouseEvent) => void;
  delay?: number;
  threshold?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 450,
  threshold = 10,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Ignore right clicks or non-primary buttons for long press start
      if ('button' in e && e.button !== 0) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startPosRef.current = { x: clientX, y: clientY };
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick: boolean = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Ignore right clicks or non-primary mouse buttons completely
      if ('button' in e && e.button !== 0) {
        startPosRef.current = null;
        return;
      }

      if (shouldTriggerClick && !isLongPressRef.current) {
        if ('button' in e) {
          onClick?.(e as React.MouseEvent);
        } else {
          onClick?.();
        }
      }
      startPosRef.current = null;
    },
    [onClick]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startPosRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dist = Math.hypot(
        clientX - startPosRef.current.x,
        clientY - startPosRef.current.y
      );

      // Cancel long press timer if moved more than threshold
      if (dist > threshold) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    },
    [threshold]
  );

  return {
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchMove: move,
    onMouseDown: start,
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseMove: move,
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
  };
}
