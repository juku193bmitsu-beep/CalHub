// Simple Japanese Holiday resolver for modern years
export function getJapaneseHoliday(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0: Sun, 1: Mon, ...

  // Fixed holidays
  if (month === 1 && day === 1) return '元日';
  if (month === 2 && day === 11) return '建国記念の日';
  if (month === 2 && day === 23) return '天皇誕生日';
  if (month === 4 && day === 29) return '昭和の日';
  if (month === 5 && day === 3) return '憲法記念日';
  if (month === 5 && day === 4) return 'みどりの日';
  if (month === 5 && day === 5) return 'こどもの日';
  if (month === 8 && day === 11) return '山の日';
  if (month === 11 && day === 3) return '文化の日';
  if (month === 11 && day === 23) return '勤労感謝の日';

  // Happy Monday
  // 成人の日 (第2月曜)
  if (month === 1 && dayOfWeek === 1 && day >= 8 && day <= 14) return '成人の日';
  // 海の日 (第3月曜)
  if (month === 7 && dayOfWeek === 1 && day >= 15 && day <= 21) return '海の日';
  // 敬老の日 (第3月曜)
  if (month === 9 && dayOfWeek === 1 && day >= 15 && day <= 21) return '敬老の日';
  // スポーツの日 (第2月曜)
  if (month === 10 && dayOfWeek === 1 && day >= 8 && day <= 14) return 'スポーツの日';

  // 春分・秋分 (概算近似)
  if (month === 3) {
    const vernal = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    if (day === vernal) return '春分の日';
  }
  if (month === 9) {
    const autumnal = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    if (day === autumnal) return '秋分の日';
  }

  return null;
}
