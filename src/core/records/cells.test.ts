import { afterEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { DEFAULT_LOCALE, setLocale } from '../i18n';
import { cellKind, cellText, rowsText } from './cells';
import { seedRecords } from '.';

const column = (table: string, name: string) => ecommerceTables.find((t) => t.name === table)!.columns.find((c) => c.name === name)!;

describe('cellKind', () => {
  it('reads the kind of the columns of the ecommerce sample', () => {
    expect(cellKind(column('users', 'id').type)).toBe('number');
    expect(cellKind(column('users', 'email').type)).toBe('text');
    expect(cellKind(column('users', 'created_at').type)).toBe('time');
    expect(cellKind(column('orders', 'total').type)).toBe('number');
  });

  it.each([
    ['BIGSERIAL', 'number'],
    ['int4', 'number'],
    ['SMALLINT', 'number'],
    ['DECIMAL(12,2)', 'number'],
    ['DOUBLE PRECISION', 'number'],
    ['BOOLEAN', 'boolean'],
    ['TIMESTAMPTZ', 'time'],
    ['datetime', 'time'],
    ['DATE', 'time'],
    ['UUID', 'text'],
    ['JSONB', 'text'],
    ['VARCHAR(255)', 'text'],
    ['INTERVAL', 'text'],
    ['', 'text'],
  ])('%s is %s', (type, kind) => {
    expect(cellKind(type)).toBe(kind);
  });
});

describe('cellText', () => {
  it('is null for NULL', () => {
    expect(cellText(null, 'TEXT')).toBeNull();
  });

  it('gives a DECIMAL its scale', () => {
    expect(cellText(12, 'DECIMAL(12,2)')).toBe('12.00');
    expect(cellText(19.5, 'NUMERIC(10, 3)')).toBe('19.500');
    expect(cellText(7, 'INTEGER')).toBe('7');
  });

  it('writes booleans as true and false', () => {
    expect(cellText(true, 'BOOLEAN')).toBe('true');
    expect(cellText(false, 'BOOLEAN')).toBe('false');
    expect(cellText(1, 'BOOLEAN')).toBe('true');
    expect(cellText('t', 'BOOLEAN')).toBe('true');
    expect(cellText(0, 'BOOLEAN')).toBe('false');
  });

  it('cuts a moment to the second', () => {
    expect(cellText('2026-03-02T09:14:07.123Z', 'TIMESTAMPTZ')).toBe('2026-03-02 09:14:07');
    expect(cellText('2026-03-02 09:14:07', 'TIMESTAMP')).toBe('2026-03-02 09:14:07');
    expect(cellText('2026-03-02', 'DATE')).toBe('2026-03-02');
  });

  it('shows every value of the seeded ecommerce rows as text, NULL aside', () => {
    const records = seedRecords(ecommerceTables, 1);
    for (const table of ecommerceTables) {
      for (const row of records[table.name]) {
        for (const c of table.columns) {
          const text = cellText(row[c.name], c.type);
          expect(row[c.name] === null ? text === null : typeof text === 'string').toBe(true);
          if (cellKind(c.type) === 'time' && text) expect(text).toMatch(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/);
        }
      }
    }
  });
});

describe('rowsText', () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it('counts rows with a thousands separator', () => {
    expect(rowsText(0)).toBe('0 rows');
    expect(rowsText(1)).toBe('1 row');
    expect(rowsText(1248)).toBe('1,248 rows');
  });

  it('follows the language of the app', () => {
    setLocale('vi');
    expect(rowsText(1)).toBe('1 dòng');
    expect(rowsText(1248)).toBe('1.248 dòng');
  });
});
