import { GoogleCalendar, CalendarEvent } from '../types/calendar';

export const MOCK_CALENDARS: GoogleCalendar[] = [
  {
    id: 'primary',
    summary: 'メイン（個人）',
    backgroundColor: '#039be5',
    foregroundColor: '#ffffff',
    primary: true,
    selected: true,
  },
  {
    id: 'work',
    summary: '仕事・経営',
    backgroundColor: '#3f51b5',
    foregroundColor: '#ffffff',
    selected: true,
  },
  {
    id: 'family',
    summary: '家族・プライベート',
    backgroundColor: '#0b8043',
    foregroundColor: '#ffffff',
    selected: true,
  },
  {
    id: 'project_hub',
    summary: 'HubMake プロジェクト',
    backgroundColor: '#8e24aa',
    foregroundColor: '#ffffff',
    selected: true,
  },
];

// Helper to format date string
const toIso = (year: number, month: number, day: number, hour: number, minute: number = 0) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
};

const toDateString = (year: number, month: number, day: number) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
};

export function generateInitialMockEvents(): CalendarEvent[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return [
    // 複数日またぎ予定 (出張)
    {
      id: 'event-multi-1',
      calendarId: 'work',
      summary: '東京・大阪 経営戦略出張',
      description: 'クライアント訪問 & HubMake事業計画カンファレンス\n資料URL: https://notion.so/hubmake/strategy\n宿泊先: 帝国ホテル',
      location: '東京駅 / 新大阪駅',
      start: { date: toDateString(year, month, Math.max(1, day - 1)) },
      end: { date: toDateString(year, month, Math.min(28, day + 3)) },
      isAllDay: true,
      backgroundColor: '#3f51b5',
    },
    // 単日 複数日またぎ (週末旅行)
    {
      id: 'event-multi-2',
      calendarId: 'family',
      summary: '家族 温泉旅行（箱根）',
      description: '予約詳細: https://travel.rakuten.co.jp/booking/1234567\n宿直通電話: 0460-xx-xxxx',
      location: '箱根 芦ノ湖',
      start: { date: toDateString(year, month, Math.min(25, day + 5)) },
      end: { date: toDateString(year, month, Math.min(27, day + 7)) },
      isAllDay: true,
      backgroundColor: '#0b8043',
    },
    // 今日の予定 1
    {
      id: 'event-today-1',
      calendarId: 'primary',
      summary: '朝のモーニングルーティン & 読書',
      description: '日課の確認',
      start: { dateTime: toIso(year, month, day, 7, 0) },
      end: { dateTime: toIso(year, month, day, 8, 0) },
      backgroundColor: '#039be5',
    },
    // 今日の予定 2 (URL付き)
    {
      id: 'event-today-2',
      calendarId: 'project_hub',
      summary: 'CalHub 設計レビュー定例MTG',
      description: 'Google Meet会議URL: https://meet.google.com/abc-defg-hij\n議題:\n1. 4画面ビュー設計\n2. 誤爆防止タッチジェスチャーの確認\n3. Cloudflare Pages デプロイ方針',
      location: 'オンライン (Google Meet)',
      start: { dateTime: toIso(year, month, day, 10, 30) },
      end: { dateTime: toIso(year, month, day, 12, 0) },
      backgroundColor: '#8e24aa',
    },
    // 今日の予定 3
    {
      id: 'event-today-3',
      calendarId: 'work',
      summary: 'パートナー企業 提携打ち合わせ',
      description: 'アジェンダ共有: https://drive.google.com/drive/folders/sample-id',
      location: '大手町カンファレンスセンター 3F',
      start: { dateTime: toIso(year, month, day, 14, 0) },
      end: { dateTime: toIso(year, month, day, 15, 30) },
      backgroundColor: '#3f51b5',
    },
    // 今日の予定 4 (夜)
    {
      id: 'event-today-4',
      calendarId: 'family',
      summary: '家族ディナー（予約済）',
      description: '店舗予約: https://tabelog.com/tokyo/A1301/A130101/123456/',
      location: '銀座 レストラン',
      start: { dateTime: toIso(year, month, day, 19, 0) },
      end: { dateTime: toIso(year, month, day, 21, 0) },
      backgroundColor: '#0b8043',
    },
    // 翌日の予定
    {
      id: 'event-tomorrow-1',
      calendarId: 'work',
      summary: '週次プロダクト進捗レビュー',
      description: '全チーム進捗報告会',
      start: { dateTime: toIso(year, month, Math.min(28, day + 1), 9, 0) },
      end: { dateTime: toIso(year, month, Math.min(28, day + 1), 10, 0) },
      backgroundColor: '#3f51b5',
    },
    // 月末の予定
    {
      id: 'event-monthend',
      calendarId: 'project_hub',
      summary: '月次決算 & 請求書チェック',
      description: '会計freee確認',
      start: { dateTime: toIso(year, month, Math.min(28, day + 2), 16, 0) },
      end: { dateTime: toIso(year, month, Math.min(28, day + 2), 17, 30) },
      backgroundColor: '#8e24aa',
    },
  ];
}
