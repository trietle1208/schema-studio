import { generateSeed, type SeedValue } from '../generate/seed';
import { columnKind } from '../generate/seedValues';
import type { Column, Table } from '../model';

// The rows of a schema's tables, as the Data mode shows them. They are sample data: `seedRecords`
// makes them from the schema with `generateSeed`, and everything else here reads them, never
// changes them. Pure TS, so that it runs without React or the database.

/** A value of a record: `null` is NULL, timestamps are `YYYY-MM-DD HH:mm:ss`, binary is `\x…`. */
export type RecordValue = string | number | boolean | null;

/** One record, keyed by column name. */
export type Row = Record<string, RecordValue>;

/** The rows of every table of a schema, by table name. A table that has no rows is there with `[]`. */
export type RecordsByTable = Record<string, Row[]>;

export interface RecordSort {
  column: string;
  dir: 'asc' | 'desc';
}

/** One page of rows, with where it sits among all of them. */
export interface RowsPage {
  rows: Row[];
  /** Counts from 1. */
  page: number;
  size: number;
  /** The number of pages, 1 at least: a table without rows has an empty first page. */
  pages: number;
  /** The rows there are, all pages together. */
  total: number;
  /** The position of the first and last row of the page among all rows, from 1; both 0 for an empty page. */
  from: number;
  to: number;
}

/** How many rows a table gets the first time its data is opened. */
export const DEFAULT_RECORD_ROWS = 20;
/** The page sizes the toolbar offers. */
export const PAGE_SIZES: readonly number[] = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

// ------------------------------------------------------------------------------------- seeding

function recordValue(value: SeedValue): RecordValue {
  if (value === null || typeof value !== 'object') return value;
  // Bytes are written the way PostgreSQL shows a `bytea`. A column's own default is not known
  // here, so it is NULL.
  return value.kind === 'binary' ? `\\x${value.hex}` : null;
}

/**
 * Sample rows for every table of `tables`, up to `rows` each. The same tables and seed always give
 * the same rows, and foreign keys point at rows that exist. A table that could not be filled (it
 * references an empty table) has `[]`.
 */
export function seedRecords(tables: readonly Table[], seed: number, rows = DEFAULT_RECORD_ROWS): RecordsByTable {
  const data = generateSeed(tables, { rows, seed });
  const records: RecordsByTable = Object.fromEntries(tables.map((t) => [t.name, []]));
  for (const { table, columns, rows: values } of data.tables) {
    records[table.name] = values.map((row) => Object.fromEntries(columns.map((c, k) => [c.name, recordValue(row[k])])));
  }
  return records;
}

// ------------------------------------------------------------------------------------- paging

/** `page` counts from 1; one beyond the last page (or before the first) is the nearest page. */
export function pageOf(rows: readonly Row[], { page, size }: { page: number; size: number }): RowsPage {
  const sized = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : DEFAULT_PAGE_SIZE;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / sized));
  const at = Number.isFinite(page) ? Math.min(pages, Math.max(1, Math.floor(page))) : 1;
  const start = (at - 1) * sized;
  const shown = rows.slice(start, start + sized);
  return { rows: shown, page: at, size: sized, pages, total, from: shown.length ? start + 1 : 0, to: start + shown.length };
}

// ------------------------------------------------------------------------------------- sorting

const NUMERIC = new Set(['serial', 'int', 'decimal', 'float', 'year']);

/** A negative number, zero or a positive one: where `a` goes against `b`. Neither is NULL. */
function compare(a: RecordValue, b: RecordValue, numeric: boolean): number {
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (numeric && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) return Number(a) - Number(b);
  // Code unit order, not the browser's locale: the same rows sort the same everywhere.
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * A copy of `rows` ordered by a column, ties in the order they had. NULL comes last whichever way
 * it sorts. `null`, or a column the table does not have, keeps the order.
 */
export function sortRows(rows: readonly Row[], sort: RecordSort | null, table: Pick<Table, 'columns'>): Row[] {
  const column = sort && table.columns.find((c) => c.name === sort.column);
  if (!sort || !column) return rows.slice();
  const numeric = NUMERIC.has(columnKind(column.type).type);
  const sign = sort.dir === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: row[sort.column] ?? null }))
    .sort((x, y) => {
      if (x.value === null || y.value === null) return x.value === y.value ? x.index - y.index : x.value === null ? 1 : -1;
      return sign * compare(x.value, y.value, numeric) || x.index - y.index;
    })
    .map((x) => x.row);
}

// ------------------------------------------------------------------------------------- search

const TEXT_KINDS = new Set(['text', 'uuid', 'enum']);

/** The columns that search looks in: the ones that hold text. */
export function textColumns(table: Pick<Table, 'columns'>): Column[] {
  return table.columns.filter((c) => TEXT_KINDS.has(columnKind(c.type).type));
}

/** Lower case without accents, so that "nguyen" finds "Nguyễn". */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

/**
 * The rows with `query` in any text column, whatever the case or accents. A blank query keeps every
 * row. NULL and numbers are not text, so `NULL` or `12` find nothing by themselves.
 */
export function searchRows(rows: readonly Row[], query: string, table: Pick<Table, 'columns'>): Row[] {
  const needle = fold(query.trim());
  if (!needle) return rows.slice();
  const names = textColumns(table).map((c) => c.name);
  return rows.filter((row) =>
    names.some((name) => {
      const value = row[name];
      return typeof value === 'string' && fold(value).includes(needle);
    }),
  );
}
