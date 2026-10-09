import { t } from './i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = [
  'time.month.1',
  'time.month.2',
  'time.month.3',
  'time.month.4',
  'time.month.5',
  'time.month.6',
  'time.month.7',
  'time.month.8',
  'time.month.9',
  'time.month.10',
  'time.month.11',
  'time.month.12',
] as const;

const month = (date: Date) => t(MONTHS[date.getMonth()]);

/**
 * How long before `now` the timestamp `then` was, as the lists show it: `just now`, `2 hours ago`,
 * `Yesterday`, `3 days ago`, `1 week ago`, and from four weeks on the date (`Aug 28`, with the year
 * when it is not this one). Both are milliseconds since the epoch. `short` is for a narrow column:
 * `now`, `2h`, `1d`, `3d`, `1w`, and the date as it is.
 */
export function relativeTime(then: number, now: number, short = false): string {
  const elapsed = now - then;
  if (elapsed < MINUTE) return short ? t('time.short.now') : t('time.justNow');
  if (elapsed < HOUR) {
    const count = Math.floor(elapsed / MINUTE);
    return short ? t('time.short.minutes', { count }) : t('time.minutesAgo', { count });
  }
  if (elapsed < DAY) {
    const count = Math.floor(elapsed / HOUR);
    return short ? t('time.short.hours', { count }) : t('time.hoursAgo', { count });
  }
  if (elapsed < 2 * DAY) return short ? t('time.short.days', { count: 1 }) : t('time.yesterday');
  if (elapsed < WEEK) {
    const count = Math.floor(elapsed / DAY);
    return short ? t('time.short.days', { count }) : t('time.daysAgo', { count });
  }
  if (elapsed < 4 * WEEK) {
    const count = Math.floor(elapsed / WEEK);
    return short ? t('time.short.weeks', { count }) : t('time.weeksAgo', { count });
  }
  const date = new Date(then);
  const day = { month: month(date), day: date.getDate() };
  return date.getFullYear() === new Date(now).getFullYear() ? t('time.date', day) : t('time.dateYear', { ...day, year: date.getFullYear() });
}

const two = (n: number) => String(n).padStart(2, '0');

/** A moment as an exported file stamps it, in local time: `2026-10-06 10:27`. */
export function timestamp(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** A moment as the version history shows it, in local time: `Oct 6, 2026 · 08:14`. */
export function dateTime(time: number): string {
  const date = new Date(time);
  return t('time.dateTime', {
    month: month(date),
    day: date.getDate(),
    year: date.getFullYear(),
    time: `${two(date.getHours())}:${two(date.getMinutes())}`,
  });
}
