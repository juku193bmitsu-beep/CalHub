export type CalendarViewType = 'vertical' | 'month' | 'week' | 'compare';

export interface ViewState {
  currentDate: Date;
  viewType: CalendarViewType;
  verticalZoom: number; // 1.0 (1画面フィット) ~ 3.0 (拡大縦スクロール)
  selectedDate: Date | null;
}
