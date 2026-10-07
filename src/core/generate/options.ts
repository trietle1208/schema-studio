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

/** Writes the model as the DDL of one database engine. */
export interface SqlGenerator {
  /** The engine as schemas name it: `PostgreSQL`. */
  engine: string;
  generate: (tables: readonly Table[], options?: Partial<GenerateOptions>) => string;
}
