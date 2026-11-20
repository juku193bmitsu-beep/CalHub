export type ArrowThickness = 'thin' | 'normal' | 'thick';
export type ArrowPattern = 'solid' | 'dashed';
export type ArrowHeadStyle = 'standard' | 'minimal' | 'circle' | 'none';
export type TimedEventStyle = 'badge' | 'underbar';
export type VerticalFontSize =
  | 'xsmall'  // 1: 極小
  | 'small'   // 2: 小
  | 'normal'  // 3: 標準
  | 'medium'  // 4: 中
  | 'large'   // 5: 大
  | 'xlarge'  // 6: 特大
  | 'huge';   // 7: 極大
export type VerticalFontWeight = 'normal' | 'bold' | 'extrabold';

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
  verticalFontSize?: VerticalFontSize;
  verticalFontWeight?: VerticalFontWeight;
}
