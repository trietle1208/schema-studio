import type { Table } from '../model';

/** What goes into the DDL of a schema. */
export interface GenerateOptions {
  /** CREATE INDEX statements. Primary keys and unique columns are constraints and are always written. */
  indexes: boolean;
  foreignKeys: boolean;
  /** COMMENT ON statements for the tables and columns that have a comment. */
  comments: boolean;
  /** A DROP TABLE IF EXISTS before every CREATE TABLE. */
  dropIfExists: boolean;
  /** Lines for the top of the script, each written as a comment. */
  header?: readonly string[];
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  indexes: true,
  foreignKeys: true,
  comments: true,
  dropIfExists: false,
};

/**
 * A run of lines of a script that belong together: a CREATE TABLE with its comments, one index, one
 * foreign key. The key names what the block is about, so two scripts of a schema can be lined up.
 */
export interface DdlBlock {
  key: string;
  lines: string[];
}

/** The keys of the blocks every engine writes: a table, one of its indexes, the foreign key of one of its columns. */
export const tableBlock = (table: string) => `table:${table}`;
export const indexBlock = (table: string, index: string) => `index:${table}.${index}`;
export const foreignKeyBlock = (table: string, column: string) => `fk:${table}.${column}`;

/** The keys of the blocks of comments on what was left out of, or written differently in, the indexes and the foreign keys of a table. */
export const indexNotesBlock = (table: string) => `index-notes:${table}`;
export const foreignKeyNotesBlock = (table: string) => `fk-notes:${table}`;

/** The table a block is about, or null for a block that is about none, such as the header. */
export function blockTable(key: string): string | null {
  const match = /^(?:table|index|fk):([^.]+)/.exec(key);
  return match ? match[1] : null;
}

/** Writes the model as the DDL of one database engine. */
export interface SqlGenerator {
  /** The engine as schemas name it: `PostgreSQL`. */
  engine: string;
  generate: (tables: readonly Table[], options?: Partial<GenerateOptions>) => string;
  /** The script `generate` writes, block by block. */
  blocks: (tables: readonly Table[], options?: Partial<GenerateOptions>) => DdlBlock[];
}

export interface MigrateOptions {
  /** Lines for the top of the script, each written as a comment. */
  header?: readonly string[];
}

/** A change of a migration that deletes data, or may. */
export interface DestructiveChange {
  /** What it is about, as the diff lists it: `legacy_orders`, `orders.total`. */
  path: string;
  /** What happens: "Dropping legacy_orders deletes its data." */
  message: string;
}

export interface Migration {
  sql: string;
  /** How many statements the migration runs; 0 when the two versions come to the same database. */
  statements: number;
  destructive: DestructiveChange[];
  /** Whether the script is one transaction, so that all of it is applied or none of it. */
  atomic: boolean;
}

/** Writes what takes a database from one version of a schema to another. */
export interface SqlMigrator {
  engine: string;
  migrate: (before: readonly Table[], after: readonly Table[], options?: MigrateOptions) => Migration;
}
