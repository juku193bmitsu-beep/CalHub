import { useRef, useCallback } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;  // e.g. next month / week
  onSwipeRight?: () => void; // e.g. prev month / week
  minDistance?: number;
  disabled?: boolean;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minDistance = 50,
  disabled = false,
}: UseSwipeNavigationOptions) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isMultiTouchRef = useRef<boolean>(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      if (e.touches.length > 1) {
        isMultiTouchRef.current = true;
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
      isMultiTouchRef.current = false;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
    },
    [disabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isMultiTouchRef.current) return;
      if (startXRef.current === null || startYRef.current === null) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const deltaX = endX - startXRef.current;
      const deltaY = endY - startYRef.current;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Rule: horizontal swipe only when dx >= 50px AND dx >= 2 * dy
      if (absDeltaX >= minDistance && absDeltaX >= absDeltaY * 2) {
        if (deltaX < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }

      startXRef.current = null;
      startYRef.current = null;
    },
    [disabled, minDistance, onSwipeLeft, onSwipeRight]
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
