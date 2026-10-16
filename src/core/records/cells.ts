import { formatNumber, t } from '../i18n';
import type { RecordValue } from '.';

// How a grid sets a value: what a column holds decides its alignment and its text.

/** Numbers are right-aligned mono, moments are `YYYY-MM-DD HH:mm:ss`, everything else is text. */
export type CellKind = 'number' | 'boolean' | 'time' | 'text';

export function cellKind(type: string): CellKind {
  const upper = type.trim().toUpperCase();
  if (/^(BIG|SMALL|MEDIUM|TINY)?(INT|INTEGER|SERIAL)\d?\b|^(DECIMAL|NUMERIC|REAL|DOUBLE|FLOAT|MONEY)/.test(upper)) return 'number';
  if (/^BOOL/.test(upper)) return 'boolean';
  if (/^(TIMESTAMP|DATETIME|DATE|TIME)(TZ)?\b/.test(upper)) return 'time';
  return 'text';
}

/** The text of a value in a cell of a column of `type`; null for NULL, which the grid shows as a token of its own. */
export function cellText(value: RecordValue, type: string, kind: CellKind = cellKind(type)): string | null {
  if (value === null) return null;
  if (kind === 'number') {
    // A DECIMAL(12,2) always shows its two decimals.
    const scale = /\(\s*\d+\s*,\s*(\d+)\s*\)/.exec(type);
    return scale && typeof value === 'number' ? value.toFixed(Number(scale[1])) : String(value);
  }
  if (kind === 'boolean') return value === true || value === 1 || value === 't' || value === 'true' ? 'true' : 'false';
  if (kind === 'time') return String(value).replace(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}).*$/, '$1 $2');
  return String(value);
}

/** `1,248 rows`: a number of rows in the language of the app. */
export function rowsText(count: number): string {
  return t('count.rows', { count, rows: formatNumber(count) });
}
