import { writtenIndexes } from '../constraints';
import type { Index, Table } from '../model';
import { DEFAULT_ON_DELETE, type Relation } from '../relations';
import {
  DEFAULT_GENERATE_OPTIONS,
  foreignKeyBlock,
  foreignKeyNotesBlock,
  indexBlock,
  indexNotesBlock,
  tableBlock,
  type DdlBlock,
  type GenerateOptions,
  type SqlGenerator,
} from './options';

// What the scripts of every engine share: the order of their blocks, laid out as in the design.
// One CREATE TABLE per table with its comments, then its indexes, and the foreign keys last so
// that the order of the tables never matters. The engines only differ in how a statement reads.

/** How one engine writes the statements a script is put together from. */
export interface Statements {
  /** A CREATE TABLE with the comments of the table and its columns. `indexes` are the ones written after it. */
  createTable: (table: Table, indexes: readonly Index[], options: GenerateOptions) => string[];
  createIndex: (table: Table, index: Index) => string[];
  /** A foreign key as an ALTER TABLE statement. `from` and `to` are the tables of its two ends. */
  addForeignKey: (relation: Relation, from: Table, to: Table) => string[];
  /** What is written differently from what the index says, for an index the engine cannot write as it is. */
  indexNote?: (index: Index) => string | null;
  /** The statements the script starts and ends with, around everything but the header. */
  around?: (options: GenerateOptions) => { open: string[]; close: string[] } | null;
}

export const note = (text: string) => `-- ${text}`;

/** The name a foreign key is written with, which is the one PostgreSQL gives the foreign key of a column. */
export function foreignKeyName(table: string, column: string): string {
  return `${table}_${column}_fkey`;
}

/** The foreign keys of a table as ALTER TABLE statements, and the reason for each one that cannot be written. */
function foreignKeys(statements: Statements, table: Table, tables: ReadonlyMap<string, Table>): { blocks: DdlBlock[]; left: string[] } {
  const blocks: DdlBlock[] = [];
  const left: string[] = [];
  for (const c of table.columns) {
    // An inferred foreign key is not in the database the script describes.
    if (!c.fk || c.fk.inferred) continue;
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
    blocks.push({ key: foreignKeyBlock(table.name, c.name), lines: statements.addForeignKey(relation, table, target) });
  }
  return { blocks, left };
}

/** The script of a schema, block by block. */
export function scriptBlocks(statements: Statements, tables: readonly Table[], given: Partial<GenerateOptions> = {}): DdlBlock[] {
  const options = { ...DEFAULT_GENERATE_OPTIONS, ...given };
  const byName = new Map(tables.map((t) => [t.name, t]));
  const around = tables.length ? statements.around?.(options) : null;
  const blocks: DdlBlock[] = [];
  if (options.header?.length) blocks.push({ key: 'header', lines: options.header.map(note) });
  if (around) blocks.push({ key: 'open', lines: around.open });

  for (const table of tables) {
    const { indexes, left } = writtenIndexes(table);
    blocks.push({ key: tableBlock(table.name), lines: statements.createTable(table, indexes, options) });
    if (options.indexes) {
      const notes = [...left];
      for (const index of indexes) {
        blocks.push({ key: indexBlock(table.name, index.name), lines: statements.createIndex(table, index) });
        const said = statements.indexNote?.(index);
        if (said) notes.push(said);
      }
      if (notes.length) blocks.push({ key: indexNotesBlock(table.name), lines: notes.map(note) });
    }
  }
  if (options.foreignKeys) {
    for (const table of tables) {
      const keys = foreignKeys(statements, table, byName);
      blocks.push(...keys.blocks);
      if (keys.left.length) blocks.push({ key: foreignKeyNotesBlock(table.name), lines: keys.left.map(note) });
    }
  }
  if (around) blocks.push({ key: 'close', lines: around.close });
  return blocks;
}

/** Blocks as one script: a blank line goes between two of them. */
export function joinBlocks(blocks: readonly DdlBlock[]): string {
  return blocks.length ? `${blocks.map((block) => block.lines.join('\n')).join('\n\n')}\n` : '';
}

/**
 * What makes the table called `name` in the script of `tables`, as "Copy CREATE TABLE" hands it
 * out: its CREATE TABLE with its comments, then its indexes and its foreign keys, which may
 * reference the other tables. Empty for a table the schema does not have.
 */
export function tableScript(generator: SqlGenerator, tables: readonly Table[], name: string): string {
  const keys = new Set([tableBlock(name), indexNotesBlock(name), foreignKeyNotesBlock(name)]);
  const table = tables.find((t) => t.name === name);
  for (const index of table?.indexes ?? []) keys.add(indexBlock(name, index.name));
  for (const column of table?.columns ?? []) keys.add(foreignKeyBlock(name, column.name));
  return joinBlocks(generator.blocks(tables).filter((block) => keys.has(block.key)));
}
