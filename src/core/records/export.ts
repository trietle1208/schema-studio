import type { Table } from '../model';
import * as mysql from '../generate/mysql';
import * as postgres from '../generate/postgres';
import { columnKind } from '../generate/seedValues';
import type { RecordValue, Row } from '.';
import { resultCsv, resultJson } from './query/export';

// One table's rows as a file. CSV and JSON are the same text a query result uses. INSERT is a
// script for the table's engine: one statement holds at most a hundred rows, and a value is
// written the way that engine reads it. What is written into a file stays in English.

/** How a table's rows can be saved from Data mode. */
export type RecordExportFormat = 'csv' | 'json' | 'sql';

/** How many rows an INSERT holds before the next one starts. */
const ROWS_PER_STATEMENT = 100;

const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUMERIC = new Set(['serial', 'int', 'decimal', 'float', 'year']);

/** How one engine writes a name and a value. */
interface Dialect {
  quoteName: (name: string) => string;
  quoteText: (text: string) => string;
  tableName: (table: Table) => string;
  binary: (hex: string) => string;
}

const POSTGRES: Dialect = {
  quoteName: postgres.quoteName,
  quoteText: postgres.quoteText,
  tableName: postgres.tableName,
  binary: (hex) => postgres.quoteText(`\\x${hex}`),
};

const MYSQL: Dialect = {
  quoteName: mysql.quoteName,
  quoteText: mysql.quoteText,
  tableName: mysql.tableName,
  binary: (hex) => `X'${hex}'`,
};

function dialectFor(engine: string): Dialect {
  return /mysql/i.test(engine) ? MYSQL : POSTGRES;
}

function sqlBoolean(value: RecordValue): 'TRUE' | 'FALSE' | null {
  if (value === true || value === 1 || value === '1' || value === 't' || value === 'true' || value === 'TRUE') return 'TRUE';
  if (value === false || value === 0 || value === '0' || value === 'f' || value === 'false' || value === 'FALSE') return 'FALSE';
  return null;
}

/** A stored value as a SQL literal. NULL is NULL; a bytea kept as `\x…` is the engine's binary form. */
function literal(value: RecordValue | undefined, type: string, dialect: Dialect): string {
  if (value === null || value === undefined) return 'NULL';
  const kind = columnKind(type).type;
  if (kind === 'bool') {
    const bool = sqlBoolean(value);
    if (bool) return bool;
  }
  if (kind === 'binary' && typeof value === 'string') {
    const hex = /^\\x([0-9a-fA-F]*)$/.exec(value);
    if (hex && hex[1].length % 2 === 0) return dialect.binary(hex[1].toLowerCase());
  }
  if (NUMERIC.has(kind)) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && NUMBER.test(value)) return value;
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return dialect.quoteText(String(value));
}

/**
 * INSERT statements for the rows of one table, in its column order. Empty when there are no rows.
 * PostgreSQL quoting is used for an engine that is not MySQL.
 */
export function rowsInsert(engine: string, table: Table, rows: readonly Row[]): string {
  if (!rows.length) return '';
  const dialect = dialectFor(engine);
  const columns = table.columns;
  const lines: string[] = [];
  for (let from = 0; from < rows.length; from += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(from, from + ROWS_PER_STATEMENT);
    lines.push(`INSERT INTO ${dialect.tableName(table)} (${columns.map((c) => dialect.quoteName(c.name)).join(', ')}) VALUES`);
    chunk.forEach((row, i) => {
      const values = columns.map((c) => literal(row[c.name], c.type, dialect));
      lines.push(`  (${values.join(', ')})${i < chunk.length - 1 ? ',' : ';'}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

/** The file text for `format`: CSV with a header, a JSON list, or INSERT statements. */
export function recordFile(format: RecordExportFormat, engine: string, table: Table, rows: readonly Row[]): string {
  if (format === 'csv') return resultCsv(table.columns, rows);
  if (format === 'json') return resultJson(table.columns, rows);
  return rowsInsert(engine, table, rows);
}
