import pg from 'pg';
import type { Connection, PostgresCatalog } from '../src/core/introspect/catalog.ts';
import { reading } from './errors.ts';

// Reads the catalog of one schema of a PostgreSQL database. Nothing but the queries below is ever
// sent, and they run in a read-only transaction.

const DEFAULT_SCHEMA = 'public';
const CONNECT_TIMEOUT_MS = 8000;
const STATEMENT_TIMEOUT_MS = 15000;

/** The tables of a schema: ordinary and partitioned ones, without the partitions themselves. */
const FROM_TABLES = `
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition`;

const TABLES = `
  SELECT c.relname AS name, pg_catalog.obj_description(c.oid, 'pg_class') AS comment
  ${FROM_TABLES}
  ORDER BY c.oid`;

const COLUMNS = `
  SELECT c.relname AS "table", a.attname AS name,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
         a.attnotnull AS "notNull",
         pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "default",
         a.attidentity::text AS identity, a.attgenerated::text AS generated,
         pg_catalog.col_description(c.oid, a.attnum) AS comment
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition AND a.attnum > 0 AND NOT a.attisdropped
  ORDER BY c.oid, a.attnum`;

const CONSTRAINTS = `
  SELECT c.relname AS "table", k.conname AS name, k.contype::text AS kind,
         pg_catalog.pg_get_constraintdef(k.oid) AS definition
  FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition AND k.contype IN ('p', 'u', 'f', 'c')
  ORDER BY c.oid, k.conname`;

/** The indexes that are not there because of a constraint. */
const INDEXES = `
  SELECT c.relname AS "table", pg_catalog.pg_get_indexdef(i.indexrelid) AS definition
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class x ON x.oid = i.indexrelid
  JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conindid = i.indexrelid)
  ORDER BY c.oid, x.relname`;

export async function readPostgres(connection: Connection): Promise<PostgresCatalog> {
  const schema = connection.schema || DEFAULT_SCHEMA;
  const client = new pg.Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    application_name: 'schema-studio',
  });
  await client.connect();
  try {
    return await reading(async () => {
      await client.query('BEGIN TRANSACTION READ ONLY');
      // With no search path every name comes back with its schema, as pg_dump writes it.
      await client.query("SELECT pg_catalog.set_config('search_path', '', true)");
      const rows = async <Row>(sql: string) => (await client.query(sql, [schema])).rows as Row[];
      const catalog: PostgresCatalog = {
        engine: 'PostgreSQL',
        schema,
        tables: await rows(TABLES),
        columns: await rows(COLUMNS),
        constraints: await rows(CONSTRAINTS),
        indexes: await rows(INDEXES),
      };
      await client.query('ROLLBACK');
      return catalog;
    });
  } finally {
    await client.end().catch(() => {});
  }
}
