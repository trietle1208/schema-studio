import { primaryKey, uniqueColumns, writtenIndexes } from '../constraints';
import type { Column, Index, Table } from '../model';
import { DEFAULT_ON_DELETE, type Relation } from '../relations';
import {
  DEFAULT_GENERATE_OPTIONS,
  foreignKeyBlock,
  indexBlock,
  tableBlock,
  type DdlBlock,
  type GenerateOptions,
  type SqlGenerator,
} from './options';

// Model → PostgreSQL DDL, laid out as in the design: one CREATE TABLE per table with its comments,
// then its indexes, and the foreign keys last so that the order of the tables never matters.
//
// The flags of a column say what its constraints are; `indexes` gives them their names (see
// core/constraints). So a primary-key or unique index that no longer matches the columns' flags is
// not written.

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

export function quoteText(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

export function tableName(table: Table): string {
  return table.schema && table.schema !== DEFAULT_SCHEMA ? `${quoteName(table.schema)}.${quoteName(table.name)}` : quoteName(table.name);
}

export function columnList(names: readonly string[]): string {
  return `(${names.map(quoteName).join(', ')})`;
}

/** A CREATE TABLE with the comments of the table and its columns. `indexes` are the ones written after it. */
export function createTable(table: Table, indexes: readonly Index[], options: GenerateOptions): string[] {
  const key = primaryKey(table);
  // A unique column is written as UNIQUE unless a CREATE UNIQUE INDEX already makes it so.
  const unique = new Set(uniqueColumns(table, options.indexes ? indexes : []));
  const width = Math.max(0, ...table.columns.map((c) => quoteName(c.name).length)) + 2;

  const definitions = table.columns.map((c: Column) => {
    const inlineKey = !!key?.inline && c.pk;
    const parts = [c.type];
    if (inlineKey) parts.push('PRIMARY KEY');
    else if (!c.nullable) parts.push('NOT NULL');
    if (c.default?.trim()) parts.push(`DEFAULT ${c.default.trim()}`);
    if (unique.has(c.name)) parts.push('UNIQUE');
    return `  ${quoteName(c.name).padEnd(width)}${parts.join(' ')}`;
  });
  if (key && !key.inline) {
    const named = key.name === `${table.name}_pkey` ? '' : `CONSTRAINT ${quoteName(key.name)} `;
    definitions.push(`  ${named}PRIMARY KEY ${columnList(key.columns)}`);
  }

  const name = tableName(table);
  const lines: string[] = [];
  if (options.dropIfExists) lines.push(`DROP TABLE IF EXISTS ${name} CASCADE;`);
  // Every line but the last definition ends with a comma.
  if (definitions.length) lines.push(`CREATE TABLE ${name} (`, ...definitions.map((d, i) => (i < definitions.length - 1 ? `${d},` : d)), ');');
  else lines.push(`CREATE TABLE ${name} ();`);
  if (options.comments) {
    if (table.comment?.trim()) lines.push(`COMMENT ON TABLE ${name} IS ${quoteText(table.comment)};`);
    for (const c of table.columns) {
      if (c.comment?.trim()) lines.push(`COMMENT ON COLUMN ${name}.${quoteName(c.name)} IS ${quoteText(c.comment)};`);
    }
  }
  return lines;
}

export function createIndex(table: Table, index: Index): string[] {
  const using = index.using && index.using !== DEFAULT_INDEX_METHOD ? ` USING ${index.using}` : '';
  return [
    `CREATE ${index.type === 'UNIQUE' ? 'UNIQUE ' : ''}INDEX ${quoteName(index.name)}`,
    `  ON ${tableName(table)}${using} ${columnList(index.columns)};`,
  ];
}

/** The name PostgreSQL gives the foreign key of a column, and the one it is written with. */
export function foreignKeyName(table: string, column: string): string {
  return `${table}_${column}_fkey`;
}

/** A foreign key as an ALTER TABLE statement. `from` and `to` are the tables of its two ends. */
export function addForeignKey(relation: Relation, from: Table, to: Table): string[] {
  return [
    `ALTER TABLE ${tableName(from)}`,
    `  ADD CONSTRAINT ${quoteName(foreignKeyName(from.name, relation.from.column))}`,
    `  FOREIGN KEY ${columnList([relation.from.column])} REFERENCES ${tableName(to)} ${columnList([relation.to.column])}`,
    `  ON DELETE ${relation.onDelete};`,
  ];
}

/** The foreign keys of a table as ALTER TABLE statements, and the reason for each one that cannot be written. */
function foreignKeys(table: Table, tables: ReadonlyMap<string, Table>): { blocks: DdlBlock[]; left: string[] } {
  const blocks: DdlBlock[] = [];
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
    const relation: Relation = {
      from: { table: table.name, column: c.name },
      to: { table: c.fk.table, column: c.fk.column },
      onDelete: c.fk.onDelete ?? DEFAULT_ON_DELETE,
    };
    blocks.push({ key: foreignKeyBlock(table.name, c.name), lines: addForeignKey(relation, table, target) });
  }
  return { blocks, left };
}

const note = (text: string) => `-- ${text}`;

function blocks(tables: readonly Table[], given: Partial<GenerateOptions> = {}): DdlBlock[] {
  const options = { ...DEFAULT_GENERATE_OPTIONS, ...given };
  const byName = new Map(tables.map((t) => [t.name, t]));
  const blocks: DdlBlock[] = [];
  if (options.header?.length) blocks.push({ key: 'header', lines: options.header.map(note) });

  for (const table of tables) {
    const { indexes, left } = writtenIndexes(table);
    blocks.push({ key: tableBlock(table.name), lines: createTable(table, indexes, options) });
    if (options.indexes) {
      for (const index of indexes) blocks.push({ key: indexBlock(table.name, index.name), lines: createIndex(table, index) });
      if (left.length) blocks.push({ key: `index-notes:${table.name}`, lines: left.map(note) });
    }
  }
  if (options.foreignKeys) {
    for (const table of tables) {
      const keys = foreignKeys(table, byName);
      blocks.push(...keys.blocks);
      if (keys.left.length) blocks.push({ key: `fk-notes:${table.name}`, lines: keys.left.map(note) });
    }
  }
  return blocks;
}

/** Blocks as one script: a blank line goes between two of them. */
export function joinBlocks(blocks: readonly DdlBlock[]): string {
  return blocks.length ? `${blocks.map((block) => block.lines.join('\n')).join('\n\n')}\n` : '';
}

function generate(tables: readonly Table[], options?: Partial<GenerateOptions>): string {
  return joinBlocks(blocks(tables, options));
}

export const postgresGenerator: SqlGenerator = { engine: 'PostgreSQL', generate, blocks };
