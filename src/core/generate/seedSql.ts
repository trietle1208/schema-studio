import type { Table } from '../model';
import { generateSeed, type SeedData, type SeedOptions, type SeedValue } from './seed';
import type { DdlBlock } from './options';
import * as mysql from './mysql';
import * as postgres from './postgres';
import { joinBlocks, note } from './script';

// Sample data as INSERT statements: one multi-row INSERT per table (a hundred rows at most to a
// statement), parents first, so that a script runs as it is. PostgreSQL's counters are moved past
// the numbers the rows were given.

/** How many rows an INSERT holds before the next one starts. */
const ROWS_PER_STATEMENT = 100;

/** How one engine writes a value and the statements around the rows. */
interface Dialect {
  quoteName: (name: string) => string;
  quoteText: (text: string) => string;
  tableName: (table: Table) => string;
  binary: (hex: string) => string;
  /** The script runs as one transaction. */
  transaction: boolean;
  /** The statement that moves the counter of a column past the numbers it was given, when the engine does not do that by itself. */
  counter?: (table: Table, column: string) => string;
}

const POSTGRES: Dialect = {
  quoteName: postgres.quoteName,
  quoteText: postgres.quoteText,
  tableName: postgres.tableName,
  binary: (hex) => postgres.quoteText(`\\x${hex}`),
  transaction: true,
  counter: (table, column) =>
    `SELECT setval(pg_get_serial_sequence(${postgres.quoteText(postgres.tableName(table))}, ${postgres.quoteText(column)}), (SELECT MAX(${postgres.quoteName(column)}) FROM ${postgres.tableName(table)}));`,
};

// MySQL moves an AUTO_INCREMENT counter past a number it was given by itself.
const MYSQL: Dialect = {
  quoteName: mysql.quoteName,
  quoteText: mysql.quoteText,
  tableName: mysql.tableName,
  binary: (hex) => `X'${hex}'`,
  transaction: false,
};

const DIALECTS: Record<string, Dialect> = { PostgreSQL: POSTGRES, MySQL: MYSQL };

/** The engines whose sample data can be written. */
export const SEED_ENGINES: readonly string[] = Object.keys(DIALECTS);

function literal(value: SeedValue, dialect: Dialect): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return dialect.quoteText(value);
  return value.kind === 'default' ? 'DEFAULT' : dialect.binary(value.hex);
}

function insertBlock({ table, columns, rows }: SeedData['tables'][number], dialect: Dialect): DdlBlock {
  const lines: string[] = [];
  for (let from = 0; from < rows.length; from += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(from, from + ROWS_PER_STATEMENT);
    lines.push(`INSERT INTO ${dialect.tableName(table)} (${columns.map((c) => dialect.quoteName(c.name)).join(', ')}) VALUES`);
    chunk.forEach((row, i) => lines.push(`  (${row.map((v) => literal(v, dialect)).join(', ')})${i < chunk.length - 1 ? ',' : ';'}`));
  }
  return { key: `seed:${table.name}`, lines };
}

/** The script that fills `data` with its rows, block by block. Empty when nothing was made. */
export function seedBlocksOf(data: SeedData, engine: string, header: readonly string[] = []): DdlBlock[] {
  const dialect = DIALECTS[engine];
  if (!dialect) return [];
  const blocks: DdlBlock[] = [];
  if (header.length) blocks.push({ key: 'header', lines: header.map(note) });
  if (dialect.transaction && data.tables.length) blocks.push({ key: 'open', lines: ['BEGIN;'] });
  for (const table of data.tables) blocks.push(insertBlock(table, dialect));
  const counter = dialect.counter;
  if (counter) {
    const lines = data.tables.flatMap(({ table, counters }) => counters.map((column) => counter(table, column)));
    if (lines.length) blocks.push({ key: 'seed-counters', lines });
  }
  if (data.notes.length) blocks.push({ key: 'seed-notes', lines: data.notes.map(note) });
  if (dialect.transaction && data.tables.length) blocks.push({ key: 'close', lines: ['COMMIT;'] });
  return blocks;
}

export interface SeedScriptOptions extends Partial<SeedOptions> {
  /** Lines for the top of the script, each written as a comment. */
  header?: readonly string[];
}

/** The script of sample rows and how many notes it ends with, which say where it fell short. */
export interface SeedScript {
  sql: string;
  notes: number;
}

/** INSERT statements with sample rows for `tables`, written for `engine`; empty for an engine they cannot be written for. */
export function generateSeedScript(engine: string, tables: readonly Table[], options: SeedScriptOptions = {}): SeedScript {
  const { header, ...seed } = options;
  if (!DIALECTS[engine]) return { sql: '', notes: 0 };
  const data = generateSeed(tables, seed);
  return { sql: joinBlocks(seedBlocksOf(data, engine, header)), notes: data.notes.length };
}

/** The INSERT statements of `generateSeedScript`. */
export function generateSeedSql(engine: string, tables: readonly Table[], options: SeedScriptOptions = {}): string {
  return generateSeedScript(engine, tables, options).sql;
}
