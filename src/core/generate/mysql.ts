import { primaryKey, uniqueColumns } from '../constraints';
import type { Column, Index, Table } from '../model';
import type { Relation } from '../relations';
import type { GenerateOptions, SqlGenerator } from './options';
import { foreignKeyName, joinBlocks, note, scriptBlocks, type Statements } from './script';

// Model → MySQL DDL: how each statement of a script reads (see generate/script for their order).
//
// MySQL writes a comment where the thing it is about is defined, so the comments of a table are
// part of its CREATE TABLE. A key has a name of its own only as an index: every primary key is
// called PRIMARY, and a unique column gets a key named after the table and the column, so that a
// migration can find it again.

/** MySQL has no schemas inside a database: the model's default one stands for the database in use. */
const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';
/** The kinds of index that are written before INDEX instead of after the columns. */
const INDEX_KINDS: Record<string, string> = { fulltext: 'FULLTEXT', spatial: 'SPATIAL' };
const INDEX_METHODS = new Set([DEFAULT_INDEX_METHOD, 'hash', ...Object.keys(INDEX_KINDS)]);

/** A name as it is written in SQL: always in backticks, as MySQL's own tools write it, so no word is ever taken for a keyword. */
export function quoteName(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

/** A text as a string. A backslash starts an escape in MySQL, so it is doubled like the quote. */
export function quoteText(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

export function tableName(table: Table): string {
  return table.schema && table.schema !== DEFAULT_SCHEMA ? `${quoteName(table.schema)}.${quoteName(table.name)}` : quoteName(table.name);
}

export function columnList(names: readonly string[]): string {
  return `(${names.map(quoteName).join(', ')})`;
}

/** The name of the key that makes a column unique when no index of the model does. */
export function uniqueKeyName(table: string, column: string): string {
  return `${table}_${column}_key`;
}

/** The method of an index as MySQL has it; one it has not got is a btree. */
function indexMethod(index: Index): string {
  const method = (index.using || DEFAULT_INDEX_METHOD).toLowerCase();
  return INDEX_METHODS.has(method) ? method : DEFAULT_INDEX_METHOD;
}

/**
 * Whether a foreign key on the column can use this index, so that MySQL makes none of its own for
 * it: the index starts with the column and is not one of the special kinds.
 */
export function backsForeignKey(index: Index, column: string): boolean {
  return index.columns[0] === column && (index.type === 'UNIQUE' || !(indexMethod(index) in INDEX_KINDS));
}

/**
 * What follows the name of a column: its type and everything that is said about it. `key` makes it
 * the primary key there and then; a key of more columns is written on its own.
 */
export function columnDefinition(column: Column, { key = false, comments = true }: { key?: boolean; comments?: boolean } = {}): string {
  const parts = [column.type];
  if (key) parts.push('PRIMARY KEY');
  else if (!column.nullable) parts.push('NOT NULL');
  if (column.default?.trim()) parts.push(`DEFAULT ${column.default.trim()}`);
  if (comments && column.comment?.trim()) parts.push(`COMMENT ${quoteText(column.comment)}`);
  return parts.join(' ');
}

/** A CREATE TABLE with the comments of the table and its columns. `indexes` are the ones written after it. */
export function createTable(table: Table, indexes: readonly Index[], options: GenerateOptions): string[] {
  if (!table.columns.length) return [note(`Table ${table.name} was left out: MySQL cannot create a table without columns.`)];
  const key = primaryKey(table);
  const inlineKey = key?.columns.length === 1;
  // A unique column gets a key of its own unless a CREATE UNIQUE INDEX already makes it unique.
  const unique = uniqueColumns(table, options.indexes ? indexes : []);
  const width = Math.max(0, ...table.columns.map((c) => quoteName(c.name).length)) + 2;

  const definitions = table.columns.map(
    (c) => `  ${quoteName(c.name).padEnd(width)}${columnDefinition(c, { key: inlineKey && c.pk, comments: options.comments })}`,
  );
  if (key && !inlineKey) definitions.push(`  PRIMARY KEY ${columnList(key.columns)}`);
  for (const column of unique) definitions.push(`  UNIQUE KEY ${quoteName(uniqueKeyName(table.name, column))} ${columnList([column])}`);

  const name = tableName(table);
  const comment = options.comments && table.comment?.trim() ? ` COMMENT = ${quoteText(table.comment)}` : '';
  const lines: string[] = [];
  if (options.dropIfExists) lines.push(`DROP TABLE IF EXISTS ${name};`);
  // Every line but the last definition ends with a comma.
  lines.push(`CREATE TABLE ${name} (`, ...definitions.map((d, i) => (i < definitions.length - 1 ? `${d},` : d)), `)${comment};`);
  return lines;
}

export function createIndex(table: Table, index: Index): string[] {
  const method = indexMethod(index);
  const kind = index.type === 'UNIQUE' ? 'UNIQUE ' : method in INDEX_KINDS ? `${INDEX_KINDS[method]} ` : '';
  const using = method === 'hash' ? ' USING HASH' : '';
  return [`CREATE ${kind}INDEX ${quoteName(index.name)}`, `  ON ${tableName(table)} ${columnList(index.columns)}${using};`];
}

function indexNote(index: Index): string | null {
  const method = (index.using || DEFAULT_INDEX_METHOD).toLowerCase();
  if (INDEX_METHODS.has(method)) return null;
  return `Index ${index.name} uses ${method}, which MySQL does not have: it was written as a ${DEFAULT_INDEX_METHOD} index.`;
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

/**
 * MySQL has no DROP TABLE … CASCADE: a table that others still reference is only dropped while
 * foreign keys are not checked, which is how mysqldump writes its scripts too.
 */
function around(options: GenerateOptions) {
  return options.dropIfExists ? { open: ['SET FOREIGN_KEY_CHECKS = 0;'], close: ['SET FOREIGN_KEY_CHECKS = 1;'] } : null;
}

const STATEMENTS: Statements = { createTable, createIndex, addForeignKey, indexNote, around };

const blocks = (tables: readonly Table[], options?: Partial<GenerateOptions>) => scriptBlocks(STATEMENTS, tables, options);

function generate(tables: readonly Table[], options?: Partial<GenerateOptions>): string {
  return joinBlocks(blocks(tables, options));
}

export const mysqlGenerator: SqlGenerator = { engine: 'MySQL', generate, blocks };
