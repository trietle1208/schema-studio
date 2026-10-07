import type { Column, Index, Table } from '../model';
import { DEFAULT_ON_DELETE } from '../relations';
import { DEFAULT_GENERATE_OPTIONS, type GenerateOptions, type SqlGenerator } from './options';

// Model → PostgreSQL DDL, laid out as in the design: one CREATE TABLE per table with its comments,
// then its indexes, and the foreign keys last so that the order of the tables never matters.
//
// The flags of a column say what its constraints are; `indexes` gives them their names. So a
// primary-key or unique index that no longer matches the columns' flags is not written.

const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';
const PLAIN_NAME = /^[a-z_][a-z0-9_]*$/;

/** The words PostgreSQL keeps for itself, which only work as names in quotes. `precision` is one for the parser. */
const RESERVED = new Set(
  (
    'all analyse analyze and any array as asc asymmetric authorization binary both case cast check collate collation ' +
    'column concurrently constraint create cross current_catalog current_date current_role current_schema current_time ' +
    'current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign freeze ' +
    'from full grant group having ilike in initially inner intersect into is isnull join lateral leading left like limit ' +
    'localtime localtimestamp natural not notnull null offset on only or order outer overlaps placing precision primary ' +
    'references returning right select session_user similar some symmetric system_user table tablesample then to ' +
    'trailing true union unique user using variadic verbose when where window with'
  ).split(' '),
);

/** A name as it is written in SQL: in quotes when it has upper case or other characters, or is a reserved word. */
export function quoteName(name: string): string {
  return PLAIN_NAME.test(name) && !RESERVED.has(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function quoteText(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

function tableName(table: Table): string {
  return table.schema && table.schema !== DEFAULT_SCHEMA ? `${quoteName(table.schema)}.${quoteName(table.name)}` : quoteName(table.name);
}

function columnList(names: readonly string[]): string {
  return `(${names.map(quoteName).join(', ')})`;
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name) => b.includes(name));
}

/** The primary key the columns' flags describe, named and ordered by the table's primary-key index when that still fits. */
function primaryKey(table: Table): { columns: string[]; name: string; inline: boolean } | null {
  const flagged = table.columns.filter((c) => c.pk).map((c) => c.name);
  if (!flagged.length) return null;
  const index = table.indexes?.find((i) => i.type === 'PRIMARY KEY' && sameNames(i.columns, flagged));
  const fallback = `${table.name}_pkey`;
  const name = index?.name ?? fallback;
  // A key of one column with the name PostgreSQL would give it is written on the column.
  return { columns: index?.columns ?? flagged, name, inline: flagged.length === 1 && name === fallback };
}

/** The indexes to write for a table, and the reason for each one that cannot be. */
function splitIndexes(table: Table): { indexes: Index[]; left: string[] } {
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const indexes: Index[] = [];
  const left: string[] = [];
  for (const index of table.indexes ?? []) {
    if (index.type === 'PRIMARY KEY') continue;
    const missing = index.columns.find((name) => !columns.has(name));
    // A unique index on one column goes with that column's flag: without the flag it is not written.
    const dropped = index.type === 'UNIQUE' && index.columns.length === 1 && !columns.get(index.columns[0])?.unique;
    if (missing !== undefined) left.push(`Index ${index.name} was left out: column ${missing} does not exist in ${table.name}.`);
    else if (!index.columns.length) left.push(`Index ${index.name} was left out: it has no columns.`);
    else if (!dropped) indexes.push(index);
  }
  return { indexes, left };
}

function createTable(table: Table, indexes: readonly Index[], options: GenerateOptions): string[] {
  const key = primaryKey(table);
  // The unique columns whose constraint a CREATE UNIQUE INDEX already writes.
  const indexed = new Set(
    options.indexes ? indexes.filter((i) => i.type === 'UNIQUE' && i.columns.length === 1).map((i) => i.columns[0]) : [],
  );
  const width = Math.max(0, ...table.columns.map((c) => quoteName(c.name).length)) + 2;

  const definitions = table.columns.map((c: Column) => {
    const inlineKey = !!key?.inline && c.pk;
    const parts = [c.type];
    if (inlineKey) parts.push('PRIMARY KEY');
    else if (!c.nullable) parts.push('NOT NULL');
    if (c.default?.trim()) parts.push(`DEFAULT ${c.default.trim()}`);
    if (c.unique && !c.pk && !indexed.has(c.name)) parts.push('UNIQUE');
    return `  ${quoteName(c.name).padEnd(width)}${parts.join(' ')}`;
  });
  if (key && !key.inline) {
    const named = key.name === `${table.name}_pkey` ? '' : `CONSTRAINT ${quoteName(key.name)} `;
    definitions.push(`  ${named}PRIMARY KEY ${columnList(key.columns)}`);
  }

  const name = tableName(table);
  const lines: string[] = [];
  if (options.dropIfExists) lines.push(`DROP TABLE IF EXISTS ${name} CASCADE;`);
  if (definitions.length) lines.push(`CREATE TABLE ${name} (`, definitions.join(',\n'), ');');
  else lines.push(`CREATE TABLE ${name} ();`);
  if (options.comments) {
    if (table.comment?.trim()) lines.push(`COMMENT ON TABLE ${name} IS ${quoteText(table.comment)};`);
    for (const c of table.columns) {
      if (c.comment?.trim()) lines.push(`COMMENT ON COLUMN ${name}.${quoteName(c.name)} IS ${quoteText(c.comment)};`);
    }
  }
  return lines;
}

function createIndex(table: Table, index: Index): string[] {
  const using = index.using && index.using !== DEFAULT_INDEX_METHOD ? ` USING ${index.using}` : '';
  return [
    `CREATE ${index.type === 'UNIQUE' ? 'UNIQUE ' : ''}INDEX ${quoteName(index.name)}`,
    `  ON ${tableName(table)}${using} ${columnList(index.columns)};`,
  ];
}

/** The foreign keys of a table as ALTER TABLE statements, and the reason for each one that cannot be written. */
function foreignKeys(table: Table, tables: ReadonlyMap<string, Table>): { blocks: string[][]; left: string[] } {
  const blocks: string[][] = [];
  const left: string[] = [];
  for (const c of table.columns) {
    if (!c.fk) continue;
    const target = tables.get(c.fk.table);
    if (!target?.columns.some((other) => other.name === c.fk?.column)) {
      left.push(
        `Foreign key ${table.name}.${c.name} was left out: ${target ? `${c.fk.table}.${c.fk.column}` : c.fk.table} does not exist.`,
      );
      continue;
    }
    blocks.push([
      `ALTER TABLE ${tableName(table)}`,
      `  ADD CONSTRAINT ${quoteName(`${table.name}_${c.name}_fkey`)}`,
      `  FOREIGN KEY ${columnList([c.name])} REFERENCES ${tableName(target)} ${columnList([c.fk.column])}`,
      `  ON DELETE ${c.fk.onDelete ?? DEFAULT_ON_DELETE};`,
    ]);
  }
  return { blocks, left };
}

const note = (text: string) => `-- ${text}`;

function generate(tables: readonly Table[], given: Partial<GenerateOptions> = {}): string {
  const options = { ...DEFAULT_GENERATE_OPTIONS, ...given };
  const byName = new Map(tables.map((t) => [t.name, t]));
  /** Groups of lines; a blank line goes between two groups. */
  const blocks: string[][] = [];
  if (options.header?.length) blocks.push(options.header.map(note));

  for (const table of tables) {
    const { indexes, left } = splitIndexes(table);
    blocks.push(createTable(table, indexes, options));
    if (options.indexes) {
      for (const index of indexes) blocks.push(createIndex(table, index));
      if (left.length) blocks.push(left.map(note));
    }
  }
  if (options.foreignKeys) {
    for (const table of tables) {
      const keys = foreignKeys(table, byName);
      blocks.push(...keys.blocks);
      if (keys.left.length) blocks.push(keys.left.map(note));
    }
  }
  return blocks.length ? `${blocks.map((lines) => lines.join('\n')).join('\n\n')}\n` : '';
}

export const postgresGenerator: SqlGenerator = { engine: 'PostgreSQL', generate };
