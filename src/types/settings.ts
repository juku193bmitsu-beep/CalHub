export type ArrowThickness = 'thin' | 'normal' | 'thick';
export type ArrowPattern = 'solid' | 'dashed' | 'gradient';
export type ArrowHeadStyle = 'standard' | 'minimal' | 'circle' | 'none';

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
}
