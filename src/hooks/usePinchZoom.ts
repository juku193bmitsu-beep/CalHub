import { useState, useRef, useEffect, useCallback } from 'react';

interface UsePinchZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function usePinchZoom({
  minZoom = 1.0,
  maxZoom = 3.0,
  initialZoom = 1.0,
  onZoomChange,
}: UsePinchZoomOptions = {}) {
  const [zoom, setZoom] = useState(initialZoom);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest zoom in a ref to prevent re-attaching listeners during gestures
  const zoomRef = useRef<number>(initialZoom);
  zoomRef.current = zoom;

  const initialDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(initialZoom);

  const getDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault(); // Stop native iOS zoom
      initialDistRef.current = getDistance(e.touches);
      initialZoomRef.current = zoomRef.current;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistRef.current !== null && initialDistRef.current > 0) {
        e.preventDefault(); // Critical: keep page intact, scale container
        const currentDist = getDistance(e.touches);
        const scale = currentDist / initialDistRef.current;
        const targetZoom = Math.min(maxZoom, Math.max(minZoom, initialZoomRef.current * scale));

        setZoom(targetZoom);
        onZoomChange?.(targetZoom);
      }
    },
    [maxZoom, minZoom, onZoomChange]
  );

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Attach non-passive listeners to cancel native iOS pinch
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const resetZoom = () => {
    setZoom(1.0);
    onZoomChange?.(1.0);
  };

  const zoomIn = () => {
    const next = Math.min(maxZoom, zoom + 0.3);
    setZoom(next);
    onZoomChange?.(next);
  };

  const zoomOut = () => {
    const next = Math.max(minZoom, zoom - 0.3);
    setZoom(next);
    onZoomChange?.(next);
  };

  // DnD only allowed when zoomed in adequately (>= 1.4x)
  const isDragAllowed = zoom >= 1.4;

  return {
    zoom,
    setZoom,
    containerRef,
    resetZoom,
    zoomIn,
    zoomOut,
    isDragAllowed,
  };
}
