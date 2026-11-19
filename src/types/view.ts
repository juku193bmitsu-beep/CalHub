export type CalendarViewType = 'vertical' | 'month' | 'timegrid' | 'week' | 'compare';

export interface ViewState {
  currentDate: Date;
  viewType: CalendarViewType;
  verticalZoom: number;
  selectedDate: Date | null;
}
