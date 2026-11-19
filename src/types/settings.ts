export type ArrowThickness = 'thin' | 'normal' | 'thick';
export type ArrowPattern = 'solid' | 'dashed';
export type ArrowHeadStyle = 'standard' | 'minimal' | 'circle' | 'none';
export type TimedEventStyle = 'badge' | 'underbar';

export interface ArrowDesignSettings {
  thickness: ArrowThickness;
  pattern: ArrowPattern;
  headStyle: ArrowHeadStyle;
}

export interface UserPreferences {
  defaultView: 'vertical' | 'month' | 'week' | 'compare';
  arrowSettings: ArrowDesignSettings;
  visibleCalendarIds: string[];
  theme: 'light' | 'dark' | 'system';
  timedEventStyle?: TimedEventStyle;
}
