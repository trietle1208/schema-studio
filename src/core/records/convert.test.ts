import { afterEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { DEFAULT_LOCALE, setLocale } from '../i18n';
import type { Column } from '../model';
import { convertValue, detectDateOrder, normalizeNumber, parseMoment } from './convert';
import { fieldMeta } from './fields';

afterEach(() => setLocale(DEFAULT_LOCALE));

const col = (type: string, rest: Partial<Column> = {}): Column => ({ name: 'c', type, nullable: false, ...rest });
const convert = (c: Column, raw: Parameters<typeof convertValue>[2], emptyNull = true) =>
  convertValue(c, fieldMeta(c, []), raw, { emptyNull });

describe('parseMoment', () => {
  it('reads the ways a file writes a day, each as a timestamp at midnight', () => {
    for (const text of ['2026-03-14', '2026/03/14', '14/03/2026', '14-03-2026', '14.03.2026', '14 Mar 2026', '14 March 2026', 'Mar 14, 2026', 'March 14th, 2026', '2026-3-14']) {
      expect(parseMoment('timestamp', text), text).toBe('2026-03-14 00:00:00');
    }
  });

  it('reads a time after the day, in 24 or 12 hours', () => {
    expect(parseMoment('timestamp', '2026-03-14 09:05')).toBe('2026-03-14 09:05:00');
    expect(parseMoment('timestamp', '2026-03-14T09:05:30')).toBe('2026-03-14 09:05:30');
    expect(parseMoment('timestamp', '2026-03-14 09:05:30.250')).toBe('2026-03-14 09:05:30');
    expect(parseMoment('timestamp', '14/03/2026 9:05 PM')).toBe('2026-03-14 21:05:00');
    expect(parseMoment('timestamp', '14/03/2026 12:30 am')).toBe('2026-03-14 00:30:00');
    expect(parseMoment('timestamp', '14/03/2026 12:30 pm')).toBe('2026-03-14 12:30:00');
  });

  it('moves a timestamp that names a time zone to UTC, and keeps a date as it is written', () => {
    expect(parseMoment('timestamp', '2026-03-14T09:05:00Z')).toBe('2026-03-14 09:05:00');
    expect(parseMoment('timestamp', '2026-03-14T09:05:00+07:00')).toBe('2026-03-14 02:05:00');
    expect(parseMoment('timestamp', '2026-03-14T01:00:00+0700')).toBe('2026-03-13 18:00:00');
    expect(parseMoment('date', '2026-03-14T23:00:00-05:00')).toBe('2026-03-14');
  });

  it('reads a date and a time by the kind of the column', () => {
    expect(parseMoment('date', '14/03/2026 10:00')).toBe('2026-03-14');
    expect(parseMoment('time', '9:05')).toBe('09:05:00');
    expect(parseMoment('time', '9:05:07 pm')).toBe('21:05:07');
    expect(parseMoment('time', '2026-03-14')).toBeNull();
  });

  it('reads 03/04/2026 by the order it is told', () => {
    expect(parseMoment('date', '03/04/2026')).toBe('2026-04-03');
    expect(parseMoment('date', '03/04/2026', 'dmy')).toBe('2026-04-03');
    expect(parseMoment('date', '03/04/2026', 'mdy')).toBe('2026-03-04');
    expect(parseMoment('date', '14/03/2026', 'mdy')).toBeNull();
  });

  it('gives null for a day that does not exist and for text that is no date', () => {
    for (const text of ['2026-02-30', '31/04/2026', '2026-13-01', '25:00', 'tomorrow', '', '14/03/26', '2026-03-14 25:00', '14/03/2026 13:00 pm']) {
      expect(parseMoment('timestamp', text), text).toBeNull();
    }
    expect(parseMoment('timestamp', '29/02/2024')).toBe('2024-02-29 00:00:00');
    expect(parseMoment('timestamp', '29/02/2026')).toBeNull();
  });
});

describe('detectDateOrder', () => {
  it('is month first only when a cell has a month where the day goes', () => {
    expect(detectDateOrder(['03/04/2026', '04/13/2026'])).toBe('mdy');
    expect(detectDateOrder(['03/04/2026', '14/03/2026'])).toBe('dmy');
  });

  it('is day first when no cell tells, and for dates written another way', () => {
    expect(detectDateOrder(['03/04/2026'])).toBe('dmy');
    expect(detectDateOrder(['2026-03-04', null, 5])).toBe('dmy');
    expect(detectDateOrder([])).toBe('dmy');
  });
});

describe('normalizeNumber', () => {
  it('reads the ways a file writes a number', () => {
    expect(normalizeNumber('42')).toBe('42');
    expect(normalizeNumber(' -3.5 ')).toBe('-3.5');
    expect(normalizeNumber('.5')).toBe('.5');
    expect(normalizeNumber('1e3')).toBe('1e3');
    expect(normalizeNumber('1,234.50')).toBe('1234.50');
    expect(normalizeNumber('1,234,567')).toBe('1234567');
    expect(normalizeNumber('1.234,50')).toBe('1234.50');
    expect(normalizeNumber('1.234.567,5')).toBe('1234567.5');
    expect(normalizeNumber('12,5')).toBe('12.5');
    expect(normalizeNumber('-1,234')).toBe('-1234');
  });

  it('takes a lone 1,234 for a thousand and a lone 1.234 for a decimal', () => {
    expect(normalizeNumber('1,234')).toBe('1234');
    expect(normalizeNumber('1.234')).toBe('1.234');
  });

  it('gives null for text that is no number', () => {
    for (const text of ['', 'abc', '12abc', '1,23,4', '1.2.3', '$5', '--1', '1,234.5,6']) expect(normalizeNumber(text), text).toBeNull();
  });
});

describe('convertValue', () => {
  it('turns text into a number by the column, and keeps what a number cannot be', () => {
    expect(convert(col('INTEGER'), '42').value).toBe(42);
    expect(convert(col('INTEGER'), 42).value).toBe(42);
    expect(convert(col('DECIMAL(12,2)'), '1,234.50').value).toBe(1234.5);
    expect(convert(col('DECIMAL(12,2)'), '12.500').value).toBe(12.5);
    expect(convert(col('INTEGER'), 'abc')).toEqual({ value: 'abc', problem: { kind: 'type', message: 'Value must be a number.' } });
    expect(convert(col('INTEGER'), '1.5').problem?.message).toBe('Value must be a whole number.');
    expect(convert(col('DECIMAL(12,2)'), '1.255').problem?.message).toBe('Value has more than 2 decimal places.');
  });

  it('reads yes and no in a boolean column', () => {
    for (const w of ['true', 'TRUE', 'Yes', 'y', '1', 't', 'on']) expect(convert(col('BOOLEAN'), w).value, w).toBe(true);
    for (const w of ['false', 'No', 'n', '0', 'off']) expect(convert(col('BOOLEAN'), w).value, w).toBe(false);
    expect(convert(col('BOOLEAN'), true).value).toBe(true);
    expect(convert(col('BOOLEAN'), 'maybe').problem?.message).toBe('Value must be true or false.');
  });

  it('turns dates into the timestamp, date or time of the column', () => {
    expect(convert(col('TIMESTAMP'), '14/03/2026').value).toBe('2026-03-14 00:00:00');
    expect(convert(col('TIMESTAMP'), '2026-03-14T10:20:30Z').value).toBe('2026-03-14 10:20:30');
    expect(convert(col('DATE'), '14 Mar 2026').value).toBe('2026-03-14');
    expect(convert(col('TIME'), '9:05 pm').value).toBe('21:05:00');
    expect(convert(col('TIMESTAMP'), '2026-02-30')).toEqual({ value: '2026-02-30', problem: { kind: 'date', message: 'Invalid timestamp format.' } });
    expect(convert(col('DATE'), 'soon').problem?.message).toBe('Invalid date format.');
    expect(convertValue(col('DATE'), fieldMeta(col('DATE'), []), '03/04/2026', { emptyNull: true, dateOrder: 'mdy' }).value).toBe('2026-03-04');
  });

  it('checks the length of text and the values of an enum, and that JSON is JSON', () => {
    expect(convert(col('VARCHAR(5)'), 'abcde').value).toBe('abcde');
    expect(convert(col('VARCHAR(5)'), 'abcdef')).toMatchObject({ problem: { kind: 'type', message: 'Value is longer than 5 characters.' } });
    expect(convert(col("ENUM('a','b')"), 'b').value).toBe('b');
    expect(convert(col("ENUM('a','b')"), 'c').problem?.message).toBe('Value must be one of a, b.');
    expect(convert(col('JSONB'), '{"a":1}').value).toBe('{"a":1}');
    expect(convert(col('JSONB'), '{"a":').problem?.message).toBe('Invalid JSON near line 1.');
  });

  it('keeps the spaces of text', () => {
    expect(convert(col('VARCHAR(50)'), '  An Nguyen ').value).toBe('  An Nguyen ');
  });

  it('turns an empty cell into NULL, the default, or a problem, by the column', () => {
    expect(convert(col('VARCHAR(5)', { nullable: true }), '').value).toBeNull();
    expect(convert(col('INTEGER', { nullable: true }), ' ').value).toBeNull();
    expect(convert(col('INTEGER', { nullable: true }), null).value).toBeNull();
    // The default fills in: the value is not set.
    expect(convert(col('TIMESTAMP', { default: 'now()' }), '')).toEqual({ value: undefined });
    expect(convert(col('VARCHAR(255)'), '')).toEqual({ value: null, problem: { kind: 'required', message: 'Column "c" cannot be NULL.' } });
    // A primary key is never empty.
    expect(convert(col('VARCHAR(5)', { nullable: true, pk: true }), '').problem?.kind).toBe('required');
  });

  it('keeps an empty text in a text column when empty cells are not NULL', () => {
    expect(convert(col('VARCHAR(5)', { nullable: true }), '', false).value).toBe('');
    // A number cannot be empty text: it is still NULL.
    expect(convert(col('INTEGER', { nullable: true }), '', false).value).toBeNull();
  });

  it('says its problems in the language of the app', () => {
    setLocale('vi');
    expect(convert(col('VARCHAR(255)'), '').problem?.message).toBe('Cột "c" không được để NULL.');
  });

  it('converts every cell of the sample users that a file would give', () => {
    const users = ecommerceTables.find((x) => x.name === 'users')!;
    const meta = (name: string) => fieldMeta(users.columns.find((c) => c.name === name)!, []);
    const of = (name: string, raw: string) => convertValue(users.columns.find((c) => c.name === name)!, meta(name), raw, { emptyNull: true });
    expect(of('email', 'an@example.com').value).toBe('an@example.com');
    expect(of('created_at', '14/03/2026 08:30').value).toBe('2026-03-14 08:30:00');
    expect(of('avatar_url', '').value).toBeNull();
  });
});
