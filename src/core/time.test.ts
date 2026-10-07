import { describe, expect, it } from 'vitest';
import { dateTime, relativeTime, timestamp } from './time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Local time, like the dates the function prints.
const now = new Date(2026, 9, 6, 8, 14).getTime();
const before = (ms: number) => relativeTime(now - ms, now);

describe('relativeTime', () => {
  it('says "just now" for the first minute, and for a clock that ran backwards', () => {
    expect(before(0)).toBe('just now');
    expect(before(59_000)).toBe('just now');
    expect(before(-5 * MINUTE)).toBe('just now');
  });

  it('counts minutes, then hours', () => {
    expect(before(MINUTE)).toBe('1 minute ago');
    expect(before(59 * MINUTE)).toBe('59 minutes ago');
    expect(before(HOUR)).toBe('1 hour ago');
    expect(before(2 * HOUR + 12 * MINUTE)).toBe('2 hours ago');
    expect(before(DAY - 1)).toBe('23 hours ago');
  });

  it('counts days, with yesterday by name', () => {
    expect(before(DAY)).toBe('Yesterday');
    expect(before(2 * DAY - 1)).toBe('Yesterday');
    expect(before(2 * DAY)).toBe('2 days ago');
    expect(before(6 * DAY)).toBe('6 days ago');
  });

  it('counts weeks up to four', () => {
    expect(before(7 * DAY)).toBe('1 week ago');
    expect(before(14 * DAY)).toBe('2 weeks ago');
    expect(before(27 * DAY)).toBe('3 weeks ago');
  });

  it('gives the date from four weeks on, with the year when it differs', () => {
    expect(relativeTime(new Date(2026, 7, 28, 15, 51).getTime(), now)).toBe('Aug 28');
    expect(relativeTime(new Date(2026, 0, 2).getTime(), now)).toBe('Jan 2');
    expect(relativeTime(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('Dec 31, 2025');
  });
});

describe('timestamp', () => {
  it('writes the date and the time of day, in local time', () => {
    expect(timestamp(new Date(2026, 9, 6, 10, 27).getTime())).toBe('2026-10-06 10:27');
  });

  it('pads months, days, hours and minutes to two digits', () => {
    expect(timestamp(new Date(2026, 0, 2, 3, 4, 59).getTime())).toBe('2026-01-02 03:04');
  });
});

describe('dateTime', () => {
  it('writes the date and the time of day in local time', () => {
    expect(dateTime(now)).toBe('Oct 6, 2026 · 08:14');
    expect(dateTime(new Date(2025, 0, 31, 17, 5).getTime())).toBe('Jan 31, 2025 · 17:05');
  });
});
