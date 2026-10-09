import { quoteName, quoteText } from '../generate/postgres';
import { t } from '../i18n';
import type { Catalog, Connection, MysqlCatalog, PostgresCatalog } from './catalog';

// A live database → DDL. The catalog the bridge read is written out as the script the engine's own
// dump tool would write, and that script is imported like any other: the parser that reads
// pg_dump and mysqldump output reads this too, with the same warnings for what the model has no
// place for.

/** The engines a live database of which can be read, each with the port it listens on unless told otherwise. */
export const DEFAULT_PORTS: Readonly<Record<string, number>> = { PostgreSQL: 5432, MySQL: 3306 };

export const INTROSPECT_ENGINES: readonly string[] = Object.keys(DEFAULT_PORTS);

/** The schema of PostgreSQL that is read when none is named. */
export const DEFAULT_POSTGRES_SCHEMA = 'public';

/** The script pg_dump would write for the tables: every name with its schema, the keys after the tables, the foreign keys last. */
function postgresDdl(catalog: PostgresCatalog): string {
  const qualified = (table: string) => `${quoteName(catalog.schema)}.${quoteName(table)}`;
  const statements: string[] = [];

  for (const table of catalog.tables) {
    const name = qualified(table.name);
    const columns = catalog.columns.filter((c) => c.table === table.name);
    const definitions = columns.map((c) => {
      const parts = [quoteName(c.name), c.type];
      if (c.generated) parts.push(`GENERATED ALWAYS AS (${c.default ?? ''}) STORED`);
      else if (c.identity) parts.push(`GENERATED ${c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`);
      else if (c.default !== null) parts.push(`DEFAULT ${c.default}`);
      if (c.notNull) parts.push('NOT NULL');
      return `    ${parts.join(' ')}`;
    });
    // pg_dump writes the CHECK constraints of a table inside it, and its keys after every table.
    for (const check of catalog.constraints) {
      if (check.table === table.name && check.kind === 'c') definitions.push(`    CONSTRAINT ${quoteName(check.name)} ${check.definition}`);
    }
    statements.push(definitions.length ? `CREATE TABLE ${name} (\n${definitions.join(',\n')}\n);` : `CREATE TABLE ${name} ();`);
    if (table.comment) statements.push(`COMMENT ON TABLE ${name} IS ${quoteText(table.comment)};`);
    for (const c of columns) {
      if (c.comment) statements.push(`COMMENT ON COLUMN ${name}.${quoteName(c.name)} IS ${quoteText(c.comment)};`);
    }
  }

  const addConstraints = (kinds: string) => {
    for (const constraint of catalog.constraints) {
      if (!kinds.includes(constraint.kind)) continue;
      statements.push(`ALTER TABLE ONLY ${qualified(constraint.table)}\n    ADD CONSTRAINT ${quoteName(constraint.name)} ${constraint.definition};`);
    }
  };
  addConstraints('pu');
  for (const index of catalog.indexes) statements.push(`${index.definition};`);
  // Foreign keys come last, so every table and key they name is there.
  addConstraints('f');
  return statements.length ? `${statements.join('\n\n')}\n` : '';
}

function mysqlDdl(catalog: MysqlCatalog): string {
  return catalog.tables.map((table) => `${table.ddl};\n`).join('\n');
}

/** The DDL of the tables the bridge read, in the dialect of their engine. It is empty for a database without tables. */
export function catalogDdl(catalog: Catalog): string {
  return catalog.engine === 'PostgreSQL' ? postgresDdl(catalog) : mysqlDdl(catalog);
}

/** How many tables the bridge read. */
export function countTables(catalog: Catalog): number {
  return catalog.tables.length;
}

/** A database as the app names it where it says what was read: `shop @ localhost:5432`, with the schema when it is not the default one. */
export function connectionLabel(connection: Connection): string {
  const schema = connection.engine === 'PostgreSQL' && connection.schema && connection.schema !== DEFAULT_POSTGRES_SCHEMA ? `.${connection.schema}` : '';
  return `${connection.database}${schema} @ ${connection.host}:${connection.port}`;
}

/** The fields of the connection form, as they are typed. */
export interface ConnectionForm {
  host: string;
  /** Blank for the port the engine listens on by default. */
  port: string;
  database: string;
  user: string;
  password: string;
  /** PostgreSQL only; blank for `public`. */
  schema: string;
  ssl: boolean;
}

export const EMPTY_CONNECTION_FORM: ConnectionForm = { host: 'localhost', port: '', database: '', user: '', password: '', schema: '', ssl: false };

export type ConnectionField = 'host' | 'port' | 'database' | 'user';

/** The first problem of each field that has one, in the wording of the design system. A password may be blank. */
export function validateConnection(form: ConnectionForm): Partial<Record<ConnectionField, string>> {
  const problems: Partial<Record<ConnectionField, string>> = {};
  if (!form.host.trim()) problems.host = t('connection.hostEmpty');
  const port = form.port.trim();
  if (port && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) problems.port = t('connection.portInvalid');
  if (!form.database.trim()) problems.database = t('connection.databaseEmpty');
  if (!form.user.trim()) problems.user = t('connection.userEmpty');
  return problems;
}

/** The connection a valid form stands for. */
export function toConnection(form: ConnectionForm, engine: string): Connection {
  return {
    engine,
    host: form.host.trim(),
    port: form.port.trim() ? Number(form.port.trim()) : DEFAULT_PORTS[engine],
    database: form.database.trim(),
    user: form.user.trim(),
    password: form.password,
    ...(engine === 'PostgreSQL' ? { schema: form.schema.trim() || DEFAULT_POSTGRES_SCHEMA } : {}),
    ...(form.ssl ? { ssl: true } : {}),
  };
}
