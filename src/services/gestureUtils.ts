/**
 * Gesture & Touch utilities for safeguarding against misoperations.
 * - Suppresses accidental clicks following swipe navigation, scrolling, drag-and-drop, and long presses.
 * - Provides subtle haptic feedback for mobile responsiveness.
 */

let clickSuppressedUntil = 0;

/**
 * Temporarily suppress all click events in the document during the specified duration (ms).
 * Registered on the window capture phase so it intercepts and stops synthetic click events before any element receives them.
 */
export function suppressNextClicks(durationMs: number = 400): void {
  const targetTime = Date.now() + durationMs;
  if (targetTime > clickSuppressedUntil) {
    clickSuppressedUntil = targetTime;
  }
}

/**
 * Check whether clicks are currently suppressed.
 */
export function isClickSuppressed(): boolean {
  return Date.now() < clickSuppressedUntil;
}

// Global click capture safeguard to extinguish stray clicks after gestures
if (typeof window !== 'undefined') {
  const clickHandler = (e: MouseEvent) => {
    if (isClickSuppressed()) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };

  // Intercept click and auxclick in capture phase
  window.addEventListener('click', clickHandler, true);
  window.addEventListener('auxclick', clickHandler, true);
}

/**
 * Trigger subtle haptic vibration on devices that support it.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') {
        navigator.vibrate(20);
      } else if (type === 'medium') {
        navigator.vibrate(35);
      } else if (type === 'heavy') {
        navigator.vibrate([30, 50, 40]);
      }
    } catch {
      // Ignore vibration errors (e.g. user gesture requirement)
    }
  }
}
