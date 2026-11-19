import { useRef, useCallback } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;  // next month / week
  onSwipeRight?: () => void; // prev month / week
  minDistance?: number;
  maxTimeMs?: number;
  disabled?: boolean;
}

/**
 * Robust swipe navigation hook with direction locking and misoperation safeguards.
 * - Direction locking: If vertical movement is detected in the first 10px, horizontal swipe is locked out.
 * - Time threshold: Only natural flicks/swipes (< 600ms) are accepted to prevent drag conflict.
 * - Angle constraint: Horizontal displacement must be at least double vertical displacement (<= 26 degrees).
 * - Multi-touch cancellation: Instantly cancels if 2+ fingers touch (pinch zoom protection).
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minDistance = 60,
  maxTimeMs = 600,
  disabled = false,
}: UseSwipeNavigationOptions) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMultiTouchRef = useRef<boolean>(false);
  const isScrollingVerticallyRef = useRef<boolean>(false);
  const isHorizontalSwipeLockedRef = useRef<boolean>(false);

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
      isScrollingVerticallyRef.current = false;
      isHorizontalSwipeLockedRef.current = false;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      startTimeRef.current = Date.now();
    },
    [disabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isMultiTouchRef.current || startXRef.current === null || startYRef.current === null) {
        return;
      }
      if (isScrollingVerticallyRef.current) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = Math.abs(currentX - startXRef.current);
      const dy = Math.abs(currentY - startYRef.current);

      // Early direction locking after 10px movement
      if (!isHorizontalSwipeLockedRef.current && (dx > 10 || dy > 10)) {
        if (dy > dx * 1.2) {
          // Vertical movement dominates -> Lock out horizontal swipe for the rest of this gesture
          isScrollingVerticallyRef.current = true;
        } else if (dx > dy * 1.5 && dx > 15) {
          // Horizontal movement dominates -> Lock in horizontal swipe
          isHorizontalSwipeLockedRef.current = true;
        }
      }
    },
    [disabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isMultiTouchRef.current || isScrollingVerticallyRef.current) {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
      if (startXRef.current === null || startYRef.current === null) return;

      const duration = Date.now() - startTimeRef.current;
      // Reject if gesture took too long (slow drag, long-press, etc.)
      if (duration > maxTimeMs) {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const deltaX = endX - startXRef.current;
      const deltaY = endY - startYRef.current;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Strict condition: distance >= minDistance AND strictly horizontal (dx >= dy * 2)
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
    [disabled, minDistance, maxTimeMs, onSwipeLeft, onSwipeRight]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
