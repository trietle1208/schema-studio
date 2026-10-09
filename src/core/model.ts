export type OnDelete = 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'NO ACTION';

export interface ForeignKey {
  table: string;
  column: string;
  onDelete?: OnDelete;
  /**
   * Guessed from the names of the columns instead of declared (see core/infer). It is drawn on the
   * canvas, but it is not in the database: DDL, migrations and the diff leave it out.
   */
  inferred?: boolean;
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

/**
 * Where a table is on the canvas, how wide it is when it was given another width than tables have
 * by themselves (see `nodeWidth` in core/layout), and which of its columns it shows.
 */
export interface Placement extends Position {
  w?: number;
  /**
   * How much of its columns the table shows when it is not all of them (see `shownColumns` in
   * core/layout): the key columns only, or none. Left out for a table that shows every column.
   */
  cols?: ColumnsShown;
}

/** What a table on the canvas shows of its columns, short of all of them. */
export type ColumnsShown = 'keys' | 'none';

export type Positions = Record<string, Placement>;

/** The colours a group of tables can have: the `--group-*` tokens of the styles. */
export type GroupColor = 'violet' | 'pink' | 'orange' | 'lime' | 'cyan' | 'brown' | 'gray';

/**
 * The tables of one module, which the canvas marks with a colour and names in its legend (see
 * core/groups). A table is in one group at most. Like the positions it is of the diagram and not
 * of the database: DDL, migrations and the diff leave it out.
 */
export interface TableGroup {
  /** The label, which tells the group from the others. */
  name: string;
  color: GroupColor;
  tables: string[];
}

/** The editable content of a schema: what undo/redo tracks and what a saved version stores. */
export interface SchemaSnapshot {
  tables: Table[];
  positions: Positions;
  /** Left out by a schema that has none, as by every version saved before there were groups. */
  groups?: readonly TableGroup[];
}

export interface SchemaSummary {
  name: string;
  engine: string;
  tables: number;
  relationships?: number;
  version: string;
  updated: string;
  /** `updated` for a narrow column: `2h`. */
  updatedShort?: string;
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
  /** A longer text about the version; left out when it has none. */
  note?: string;
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
