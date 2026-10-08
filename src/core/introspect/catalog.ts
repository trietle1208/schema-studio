// What the connection bridge is asked and what it answers. The bridge is a small local process
// (see bridge/server.ts): a browser cannot open a connection to a database itself. It reads the
// catalog of the database in a read-only transaction and hands it over as it is; the app turns
// the answer into DDL (see ./index) and imports that like any other script.

/** A database to read the tables of. */
export interface Connection {
  /** The engine as schemas name it: `PostgreSQL`. */
  engine: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** PostgreSQL: the schema whose tables are read. Without one it is `public`. */
  schema?: string;
  /** Encrypts the connection. The certificate of the server is not checked. */
  ssl?: boolean;
}

/** A table of PostgreSQL: `pg_class` with its comment. */
export interface PostgresTableRow {
  name: string;
  comment: string | null;
}

/** A column: `pg_attribute` with its default from `pg_attrdef`. */
export interface PostgresColumnRow {
  table: string;
  name: string;
  /** As `format_type` writes it: `character varying(255)`. */
  type: string;
  notNull: boolean;
  /** The default as `pg_get_expr` writes it; for a generated column, the expression it is computed from. */
  default: string | null;
  /** `a` or `d` for an identity column (ALWAYS, BY DEFAULT), else empty. */
  identity: string;
  /** `s` for a column that is computed and stored, else empty. */
  generated: string;
  comment: string | null;
}

/** A constraint as `pg_get_constraintdef` writes it: `FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE`. */
export interface PostgresConstraintRow {
  table: string;
  name: string;
  /** `p` primary key, `u` unique, `f` foreign key, `c` check. */
  kind: string;
  definition: string;
}

/** An index that backs no constraint, as `pg_get_indexdef` writes it: a whole CREATE INDEX statement. */
export interface PostgresIndexRow {
  table: string;
  definition: string;
}

export interface PostgresCatalog {
  engine: 'PostgreSQL';
  schema: string;
  tables: PostgresTableRow[];
  columns: PostgresColumnRow[];
  constraints: PostgresConstraintRow[];
  indexes: PostgresIndexRow[];
}

export interface MysqlCatalog {
  engine: 'MySQL';
  database: string;
  /** Every base table with what SHOW CREATE TABLE says of it. */
  tables: { name: string; ddl: string }[];
}

export type Catalog = PostgresCatalog | MysqlCatalog;

/** Why the bridge could not answer. */
export interface BridgeError {
  /** What happened, in the wording of the design system: "Could not connect to the database." */
  message: string;
  /** What the database or the network said about it. */
  detail?: string;
}

export type BridgeAnswer = { ok: true; catalog: Catalog } | { ok: false; error: BridgeError };

/** What the bridge says of itself at `/`, by which the app knows it is running. */
export interface BridgeInfo {
  name: string;
  engines: string[];
}

export const BRIDGE_NAME = 'schema-studio-bridge';
/** Where the bridge listens unless it is started with another port. */
export const BRIDGE_PORT = 4577;
