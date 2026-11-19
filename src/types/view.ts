export type CalendarViewType = 'vertical' | 'month' | 'week' | 'compare';

export interface ViewState {
  currentDate: Date;
  viewType: CalendarViewType;
  verticalZoom: number;
  selectedDate: Date | null;
}
