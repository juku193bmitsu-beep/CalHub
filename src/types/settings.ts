export type ArrowThickness = 'thin' | 'normal' | 'thick';
export type ArrowPattern = 'solid' | 'dashed';
export type ArrowHeadStyle = 'standard' | 'minimal' | 'circle' | 'none';

// 予定の表示スタイル: 濃い（濃い背景に白文字） | アンダーライン（黒文字で下線） | 何もなし（テキストのみ）
export type EventDisplayStyle = 'filled' | 'underbar' | 'none';
export type TimedEventStyle = EventDisplayStyle | 'badge'; // 後方互換性のため維持

export type VerticalFontSize =
  | 'xsmall'  // 1: 極小
  | 'small'   // 2: 小
  | 'normal'  // 3: 標準
  | 'medium'  // 4: 中
  | 'large'   // 5: 大
  | 'xlarge'  // 6: 特大
  | 'huge';   // 7: 極大
export type VerticalFontWeight = 'normal' | 'bold' | 'extrabold';

export type MonthlyFontSize = 'small' | 'normal' | 'large' | 'xlarge';
export type MonthlyFontWeight = 'normal' | 'bold' | 'extrabold';

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
  allDayEventStyle?: EventDisplayStyle; // 終日・連日予定スタイル（デフォルト: 'filled'）
  timedEventStyle?: EventDisplayStyle;  // 時間指定予定スタイル（デフォルト: 'underbar'）
  verticalFontSize?: VerticalFontSize;
  verticalFontWeight?: VerticalFontWeight;
  monthlyFontSize?: MonthlyFontSize;
  monthlyFontWeight?: MonthlyFontWeight;
}
