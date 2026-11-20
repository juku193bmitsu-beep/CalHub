import { CalendarEvent, GoogleCalendar } from '../types/calendar';

/**
 * Common color utility for CalHub.
 * Provides luminance calculation, contrast text detection, and palette presets.
 */

// Preset text color options for event chips
export interface ColorOption {
  value: string;
  label: string;
  bgHex?: string; // Preview sample color
}

export const TEXT_COLOR_PRESETS: ColorOption[] = [
  { value: 'auto', label: '自動（背景に合せる）' },
  { value: '#ffffff', label: '白', bgHex: '#ffffff' },
  { value: '#0f172a', label: '黒', bgHex: '#0f172a' },
  { value: '#dc2626', label: '赤', bgHex: '#dc2626' },
  { value: '#2563eb', label: '青', bgHex: '#2563eb' },
  { value: '#16a34a', label: '緑', bgHex: '#16a34a' },
  { value: '#d97706', label: '黄 / アンバー', bgHex: '#d97706' },
  { value: '#ea580c', label: '橙 / オレンジ', bgHex: '#ea580c' },
  { value: '#9333ea', label: '紫 / パープル', bgHex: '#9333ea' },
  { value: '#db2777', label: 'ピンク', bgHex: '#db2777' },
  { value: '#059669', label: 'エメラルド', bgHex: '#059669' },
  { value: '#475569', label: 'グレー', bgHex: '#475569' },
];

export const BG_COLOR_PRESETS: ColorOption[] = [
  { value: '#039be5', label: 'ピーコック（青）', bgHex: '#039be5' },
  { value: '#0b8043', label: 'バジル（緑）', bgHex: '#0b8043' },
  { value: '#d50000', label: 'トマト（赤）', bgHex: '#d50000' },
  { value: '#f6bf26', label: 'バナナ（黄）', bgHex: '#f6bf26' },
  { value: '#8e24aa', label: 'グレープ（紫）', bgHex: '#8e24aa' },
  { value: '#f4511e', label: 'タンジェリン（橙）', bgHex: '#f4511e' },
  { value: '#3f51b5', label: 'ブルーベリー（紺）', bgHex: '#3f51b5' },
  { value: '#616161', label: 'グラファイト（灰）', bgHex: '#616161' },
  { value: '#7986cb', label: 'ラベンダー', bgHex: '#7986cb' },
  { value: '#33b679', label: 'セージ', bgHex: '#33b679' },
  { value: '#e67c73', label: 'フラミンゴ', bgHex: '#e67c73' },
];

/**
 * Converts a hex color string to rgba with specified alpha opacity
 */
export function hexToRgba(hex: string, alpha: number): string {
  let c = (hex || '#039be5').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(3, 155, 229, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns perceived luminance (0 to 1) of a hex color
 */
export function getLuminance(hex: string): number {
  let c = (hex || '#039be5').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return 0.5;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates high-contrast text color (black or white) for a given background hex
 */
export function getAutoTextColor(bgHex: string): string {
  const lum = getLuminance(bgHex);
  return lum > 0.45 ? '#0f172a' : '#ffffff';
}

/**
 * Resolves the final text color for an event:
 * - Base Rule 1: All-day events default to WHITE (#ffffff).
 * - Base Rule 2: Timed events default to BLACK / dark slate (returns empty string so text-slate-800 applies).
 * - Exception: If the user explicitly customized the text color (e.g. red, yellow, blue), apply that color!
 * - Note: Ignore default '#ffffff' from Google API metadata on timed events so they never become white-on-white.
 */
export function resolveEventTextColor(
  event: CalendarEvent,
  calendar?: GoogleCalendar,
  isAllDay: boolean = false,
  _rawBgColor?: string
): string {
  // 1. Explicit custom text color chosen by user for this event
  if (event.customTextColor && event.customTextColor !== 'auto') {
    return event.customTextColor;
  }
  // Check custom foregroundColor if not default Google metadata '#ffffff'
  if (
    event.foregroundColor &&
    event.foregroundColor !== 'auto' &&
    event.foregroundColor !== '#ffffff'
  ) {
    return event.foregroundColor;
  }

  // 2. Explicit custom category text color chosen by user
  if (calendar?.customTextColor && calendar.customTextColor !== 'auto') {
    return calendar.customTextColor;
  }

  // 3. Base defaults:
  // - All-day events: ALWAYS WHITE (#ffffff)
  if (isAllDay) {
    return '#ffffff';
  }

  // - Timed events: ALWAYS BLACK (empty string to use text-slate-800 dark:text-slate-100)
  return '';
}
