const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ago(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * How long before `now` the timestamp `then` was, as the lists show it: `just now`, `2 hours ago`,
 * `Yesterday`, `3 days ago`, `1 week ago`, and from four weeks on the date (`Aug 28`, with the year
 * when it is not this one). Both are milliseconds since the epoch.
 */
export function relativeTime(then: number, now: number): string {
  const elapsed = now - then;
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return ago(Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return ago(Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 2 * DAY) return 'Yesterday';
  if (elapsed < WEEK) return ago(Math.floor(elapsed / DAY), 'day');
  if (elapsed < 4 * WEEK) return ago(Math.floor(elapsed / WEEK), 'week');
  const date = new Date(then);
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear() ? day : `${day}, ${date.getFullYear()}`;
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
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} · ${two(date.getHours())}:${two(date.getMinutes())}`;
}
