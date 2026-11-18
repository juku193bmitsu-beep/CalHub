import { PaletteColor } from '../types/calendar';

// Google Calendar official 11 event colors
export const GOOGLE_EVENT_COLORS: Record<string, PaletteColor> = {
  '1': { background: '#7986cb', foreground: '#1d1d1d' }, // Lavender
  '2': { background: '#33b679', foreground: '#1d1d1d' }, // Sage
  '3': { background: '#8e24aa', foreground: '#ffffff' }, // Grape
  '4': { background: '#e67c73', foreground: '#1d1d1d' }, // Flamingo
  '5': { background: '#f6bf26', foreground: '#1d1d1d' }, // Banana
  '6': { background: '#f4511e', foreground: '#ffffff' }, // Tangerine
  '7': { background: '#039be5', foreground: '#ffffff' }, // Peacock
  '8': { background: '#616161', foreground: '#ffffff' }, // Graphite
  '9': { background: '#3f51b5', foreground: '#ffffff' }, // Blueberry
  '10': { background: '#0b8043', foreground: '#ffffff' }, // Basil
  '11': { background: '#d50000', foreground: '#ffffff' }, // Tomato
};

export const DEFAULT_CALENDAR_COLORS = [
  '#039be5', // Blue
  '#0b8043', // Green
  '#d50000', // Red
  '#f6bf26', // Yellow
  '#8e24aa', // Purple
  '#f4511e', // Orange
  '#3f51b5', // Indigo
  '#616161', // Gray
];
