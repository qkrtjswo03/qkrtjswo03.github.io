/** 화면에 보이는 날짜는 항상 Asia/Seoul 기준입니다. */
export const SITE_TZ = 'Asia/Seoul';

function partsInZone(date: Date, timeZone = SITE_TZ): { year: string; month: string; day: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const bag: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return {
    year: bag.year ?? '0000',
    month: bag.month ?? '01',
    day: bag.day ?? '01',
  };
}

/** 예: 2026.11.06 */
export function formatDate(date: Date, timeZone = SITE_TZ): string {
  const { year, month, day } = partsInZone(date, timeZone);
  return `${year}.${month}.${day}`;
}

/** 예: 2026-11-06 */
export function formatDateISO(date: Date, timeZone = SITE_TZ): string {
  const { year, month, day } = partsInZone(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function yearInZone(date: Date, timeZone = SITE_TZ): number {
  return Number(partsInZone(date, timeZone).year);
}
