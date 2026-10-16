import { formatMoment } from '../generate/seedValues';
import type { Column, Table } from '../model';
import { cellKind } from './cells';
import type { RecordValue, Row } from '.';

// What a column holds, and what the record editor makes of it: how a column is set (a switch, a
// picker, a read-only counter), and which text stands for which value.

/** The rows of every table of the schema, by table name: what foreign keys are chosen from and checked against. */
export type RecordData = Record<string, readonly Row[]>;

/** The values of a record being edited. A column that is not there has not been given a value. */
export type RecordValues = Record<string, RecordValue | undefined>;

export type Moment = 'timestamp' | 'date' | 'time';

export const MOMENTS: Record<Moment, { text: string; re: RegExp }> = {
  timestamp: { text: 'YYYY-MM-DD HH:mm:ss', re: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/ },
  date: { text: 'YYYY-MM-DD', re: /^(\d{4})-(\d{2})-(\d{2})$/ },
  time: { text: 'HH:mm:ss', re: /^(\d{2}):(\d{2}):(\d{2})$/ },
};

export function momentKind(type: string): Moment {
  const upper = type.toUpperCase();
  return /^DATE\b/.test(upper) ? 'date' : /^TIME(?!STAMP)/.test(upper) ? 'time' : 'timestamp';
}

/** Whether `text` is a moment of the kind that exists: no 31 February, no 25:00. */
export function validMoment(kind: Moment, text: string): boolean {
  const m = MOMENTS[kind].re.exec(text);
  if (!m) return false;
  const n = m.slice(1).map(Number);
  if (kind === 'time') return n[0] < 24 && n[1] < 60 && n[2] < 60;
  const d = new Date(Date.UTC(n[0], n[1] - 1, n[2], n[3] || 0, n[4] || 0, n[5] || 0));
  return (
    d.getUTCFullYear() === n[0] &&
    d.getUTCMonth() === n[1] - 1 &&
    d.getUTCDate() === n[2] &&
    (kind === 'date' || (n[3] < 24 && n[4] < 60 && n[5] < 60))
  );
}

/** The counter of the database fills these in: a serial type or an identity. */
export function isGenerated(c: Column): boolean {
  return /SERIAL|AUTO_INCREMENT|IDENTITY/i.test(c.type) || /^nextval\(|AUTO_INCREMENT|GENERATED/i.test(c.default ?? '');
}

export function isIntegerType(type: string): boolean {
  return /^(BIG|SMALL|MEDIUM|TINY)?(INT|INTEGER|SERIAL)\d?\b/i.test(type);
}

/** The `n` of `VARCHAR(n)` and `CHAR(n)`; null for a type without one. */
export function typeLength(type: string): number | null {
  const m = /^(?:N?VAR)?CHAR(?:ACTER)?(?:\s+VARYING)?\s*\(\s*(\d+)\s*\)/i.exec(type);
  return m ? Number(m[1]) : null;
}

/** The `s` of `DECIMAL(p,s)`. */
export function typeScale(type: string): number | null {
  const m = /\(\s*\d+\s*,\s*(\d+)\s*\)/.exec(type);
  return m ? Number(m[1]) : null;
}

/** The value of a default that is a literal (`'pending'`, `1`, `true`); undefined for `now()` and other expressions. */
export function literalDefault(c: Column): RecordValue | undefined {
  const d = (c.default ?? '').trim().replace(/::[\w\s]+(?:\([^)]*\))?$/, '');
  if (!d) return undefined;
  if (/^'(?:[^']|'')*'$/.test(d)) return d.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(?:\.\d+)?$/.test(d)) return Number(d);
  if (/^(true|false)$/i.test(d)) return d.toLowerCase() === 'true';
  if (/^NULL$/i.test(d)) return null;
  return undefined;
}

/** A default that the database works out when the row is made: `now()`, `CURRENT_TIMESTAMP`. */
export function isClockDefault(c: Column): boolean {
  return /^(now\(\)|current_timestamp|localtimestamp|current_date|current_time)/i.test(c.default ?? '');
}

const ENUM_NAME = /status|(^|_)state$|stage/;
/** The most values a text column called status offers before it is taken for free text. */
const MAX_OFFERED = 12;

/**
 * `ENUM('a','b')` offers its values. A text column called status (or state, stage) offers what the
 * table already holds in it, and its default.
 */
export function enumOptions(c: Column, rows: readonly Row[]): { values: string[]; fixed: boolean } | null {
  const m = /^ENUM\s*\((.*)\)\s*$/i.exec(c.type);
  if (m) {
    const fixed = [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'"));
    return fixed.length ? { values: fixed, fixed: true } : null;
  }
  if (!ENUM_NAME.test(c.name.toLowerCase()) || c.fk || cellKind(c.type) !== 'text') return null;
  const seen: string[] = [];
  for (const row of rows) {
    const v = row[c.name];
    if (typeof v === 'string' && v !== '' && !seen.includes(v)) {
      seen.push(v);
      if (seen.length > MAX_OFFERED) return null;
    }
  }
  const d = literalDefault(c);
  if (typeof d === 'string' && !seen.includes(d)) seen.push(d);
  return seen.length ? { values: seen, fixed: false } : null;
}

/** How the editor sets a column. */
export type FieldMeta =
  | { kind: 'generated' }
  | { kind: 'json' }
  | { kind: 'boolean' }
  | { kind: 'time'; moment: Moment }
  | { kind: 'reference' }
  | { kind: 'enum'; options: string[]; fixed: boolean }
  | { kind: 'number' }
  | { kind: 'longtext' }
  | { kind: 'text' };

export function fieldMeta(c: Column, rows: readonly Row[], data?: RecordData): FieldMeta {
  const type = c.type.toUpperCase();
  if (isGenerated(c)) return { kind: 'generated' };
  if (/^JSONB?\b/.test(type)) return { kind: 'json' };
  const base = cellKind(c.type);
  if (base === 'boolean') return { kind: 'boolean' };
  if (base === 'time') return { kind: 'time', moment: momentKind(type) };
  if (c.fk && data && Array.isArray(data[c.fk.table])) return { kind: 'reference' };
  const en = enumOptions(c, rows);
  if (en) return { kind: 'enum', options: en.values, fixed: en.fixed };
  if (base === 'number') return { kind: 'number' };
  if (/TEXT$/.test(type)) return { kind: 'longtext' };
  return { kind: 'text' };
}

export function isTextField(meta: FieldMeta): boolean {
  return meta.kind === 'text' || meta.kind === 'longtext';
}

/** The value a draft stands for: empty is NULL except in a text column, and a number typed in a number column is a number. */
export function canon(c: Column, meta: FieldMeta, v: RecordValue | undefined): RecordValue | undefined {
  if (v === undefined || v === null) return v;
  if (typeof v === 'string' && !isTextField(meta) && v.trim() === '') return null;
  if (typeof v === 'string' && cellKind(c.type) === 'number' && meta.kind !== 'text' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return v;
}

/** Whether a column alone holds each row to a different value: unique, or the one column of the primary key. */
export function isUnique(table: Pick<Table, 'columns' | 'indexes'>, c: Column): boolean {
  const keys = table.columns.filter((x) => x.pk);
  return (
    !!c.unique ||
    (!!c.pk && keys.length === 1) ||
    (table.indexes ?? []).some((ix) => ix.type !== 'INDEX' && ix.columns.length === 1 && ix.columns[0] === c.name)
  );
}

/**
 * The keys that hold rows apart by several columns together: a primary key of more than one column
 * and the unique indexes of more than one column, each once, as the names of its columns in the
 * order the key lists them. A key of one column is `isUnique`.
 */
export function compositeKeys(table: Pick<Table, 'columns' | 'indexes'>): string[][] {
  const known = new Set(table.columns.map((c) => c.name));
  const keys: string[][] = [];
  const add = (names: readonly string[]) => {
    if (names.length < 2 || !names.every((n) => known.has(n))) return;
    const id = [...names].sort().join('\u0000');
    if (!keys.some((k) => [...k].sort().join('\u0000') === id)) keys.push([...names]);
  };
  add(table.columns.filter((c) => c.pk).map((c) => c.name));
  for (const ix of table.indexes ?? []) if (ix.type !== 'INDEX') add(ix.columns);
  return keys;
}

export { formatMoment };
