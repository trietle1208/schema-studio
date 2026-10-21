// What the connection bridge is asked and what it answers. The bridge is a small local process
// (see bridge/server.ts): a browser cannot open a connection to a database itself. It reads the
// catalog of the database in a read-only transaction and hands it over as it is; the app turns
// the answer into DDL (see ./index) and imports that like any other script.

/** A server to reach the database through: the bridge logs in to it and the database is then reached from there. */
export interface SshTunnel {
  host: string;
  port: number;
  user: string;
  /** How the user logs in: with a password, with a private key file on the machine of the bridge, or with the key an ssh-agent holds. */
  auth: 'password' | 'key' | 'agent';
  /** `password`: the password of the user. */
  password?: string;
  /** `key`: where the private key is, on the machine of the bridge: `~/.ssh/id_ed25519`. The key itself never goes through the app. */
  keyPath?: string;
  /** `key`: the passphrase of an encrypted key. */
  passphrase?: string;
  /** The fingerprint of the key the server is known by, as ssh-keygen writes it: `SHA256:…`. Without one the bridge does not log in, and says what the server's is. */
  hostKey?: string;
}

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
  /** Reach the database through this server. `host` and `port` are then as that server sees them. */
  ssh?: SshTunnel;
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
  /** Which failure of the bridge it is, by which the app says it in its own language: the database was not reached, or not read. */
  code?: 'connect' | 'read' | 'ssh' | 'hostKey';
  /** What the database or the network said about it. */
  detail?: string;
  /** `hostKey`: the fingerprint the server was found to have, and whether the app knew another one for it. */
  hostKey?: { fingerprint: string; changed: boolean };
}

export type BridgeAnswer = { ok: true; catalog: Catalog } | { ok: false; error: BridgeError };

/** A cell of a live row: the bridge has already turned dates and binary into text. */
export type LiveValue = string | number | boolean | null;

/** One row of a table, keyed by the column names the app asked for. */
export type LiveRow = Record<string, LiveValue>;

/** One page of a table, with how many rows the table has. */
export type RowsAnswer = { ok: true; rows: LiveRow[]; total: number } | { ok: false; error: BridgeError };

/** The rows a live SELECT returned. `plan` is MySQL's EXPLAIN, one line per step. `capped` means 1,000 rows cut it. */
export type QueryAnswer =
  | { ok: true; columns: string[]; rows: LiveRow[]; capped: boolean; plan: string[] }
  | { ok: false; error: BridgeError };

/** What the bridge says of itself at `/`, by which the app knows it is running. */
export interface BridgeInfo {
  name: string;
  engines: string[];
}

export const BRIDGE_NAME = 'schema-studio-bridge';
/** Where the bridge listens unless it is started with another port. */
export const BRIDGE_PORT = 4577;
