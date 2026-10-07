export type OnDelete = 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';

export interface ForeignKey {
  table: string;
  column: string;
  onDelete?: OnDelete;
}

export interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  pk?: boolean;
  unique?: boolean;
  default?: string;
  comment?: string;
  fk?: ForeignKey | null;
  draft?: boolean;
}

export type IndexType = 'PRIMARY KEY' | 'UNIQUE' | 'INDEX';

export interface Index {
  name: string;
  type: IndexType;
  using: string;
  columns: string[];
}

export interface Table {
  name: string;
  schema?: string;
  comment?: string;
  columns: Column[];
  indexes?: Index[];
}

export interface Position {
  x: number;
  y: number;
}

export type Positions = Record<string, Position>;

/** The editable content of a schema: what undo/redo tracks and what a saved version stores. */
export interface SchemaSnapshot {
  tables: Table[];
  positions: Positions;
}

export interface SchemaSummary {
  name: string;
  engine: string;
  tables: number;
  relationships?: number;
  version: string;
  updated: string;
  favorite?: boolean;
}

export interface Version {
  version: string;
  current?: boolean;
  time: string;
  timestamp?: string;
  /** Left out where versions have no author, as in a local workspace. */
  author?: string;
  initials?: string;
  message: string;
  tables?: number;
  relationships?: number;
  indexes?: number;
  added?: number;
  modified?: number;
  removed?: number;
}

export type DiffOp = 'add' | 'mod' | 'del';

export interface DiffItem {
  op: DiffOp;
  path: string;
  detail?: string;
  /** Where the change shows in the DDL: the key of its block (see `DdlBlock`). */
  anchor?: string;
}

export interface DiffGroup {
  group: string;
  items: DiffItem[];
}
