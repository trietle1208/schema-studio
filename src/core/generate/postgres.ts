import { primaryKey, uniqueColumns } from '../constraints';
import type { Column, Index, Table } from '../model';
import type { Relation } from '../relations';
import type { GenerateOptions, SqlGenerator } from './options';
import { foreignKeyName, joinBlocks, scriptBlocks, type Statements } from './script';

// Model → PostgreSQL DDL: how each statement of a script reads (see generate/script for their order).
//
// The flags of a column say what its constraints are; `indexes` gives them their names (see
// core/constraints). So a primary-key or unique index that no longer matches the columns' flags is
// not written.

const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';
const PLAIN_NAME = /^[a-z_][a-z0-9_]*$/;
/** The index methods of other engines that PostgreSQL has none of; an index that asks for one is written as a btree. */
const FOREIGN_METHODS = new Set(['fulltext', 'spatial']);

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

const usesForeignMethod = (index: Index) => FOREIGN_METHODS.has(index.using?.toLowerCase());

export function createIndex(table: Table, index: Index): string[] {
  const using = index.using && index.using !== DEFAULT_INDEX_METHOD && !usesForeignMethod(index) ? ` USING ${index.using}` : '';
  return [
    `CREATE ${index.type === 'UNIQUE' ? 'UNIQUE ' : ''}INDEX ${quoteName(index.name)}`,
    `  ON ${tableName(table)}${using} ${columnList(index.columns)};`,
  ];
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

function indexNote(index: Index): string | null {
  if (!usesForeignMethod(index)) return null;
  return `Index ${index.name} uses ${index.using.toLowerCase()}, which PostgreSQL does not have: it was written as a ${DEFAULT_INDEX_METHOD} index.`;
}

const STATEMENTS: Statements = { createTable, createIndex, addForeignKey, indexNote };

const blocks = (tables: readonly Table[], options?: Partial<GenerateOptions>) => scriptBlocks(STATEMENTS, tables, options);

function generate(tables: readonly Table[], options?: Partial<GenerateOptions>): string {
  return joinBlocks(blocks(tables, options));
}

export const postgresGenerator: SqlGenerator = { engine: 'PostgreSQL', generate, blocks };
