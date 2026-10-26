import mysql from 'mysql2/promise';
import type { Connection, LiveRow, LiveValue, MysqlCatalog } from '../src/core/introspect/catalog.ts';
import { reading } from './errors.ts';
import { QUERY_MAX_ROWS, boundedSelect, mysqlSelectSql, type QueryTable } from './query.ts';
import { mysqlRowsSql, type RowsQuery } from './rows.ts';
import type { Select } from '../src/core/records/query/ast.ts';

// Reads the tables of one MySQL database as SHOW CREATE TABLE writes them. Nothing but the
// statements below is ever sent, and they run in a read-only transaction.

const CONNECT_TIMEOUT_MS = 8000;

function open(connection: Connection) {
  return mysql.createConnection({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
    // Dates stay the text MySQL stores, which is how the grid shows a timestamp.
    dateStrings: true,
  });
}

/** A value mysql2 handed back, as a cell of the grid. */
function liveValue(value: unknown): LiveValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 19);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const TABLES = `
  SELECT TABLE_NAME AS name
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME`;

export async function readMysql(connection: Connection): Promise<MysqlCatalog> {
  const db = await open(connection);
  try {
    return await reading(async () => {
      await db.query('START TRANSACTION READ ONLY');
      const [names] = await db.query(TABLES);
      const tables: MysqlCatalog['tables'] = [];
      for (const { name } of names as { name: string }[]) {
        // `??` is filled in as a name in backticks.
        const [created] = await db.query('SHOW CREATE TABLE ??', [name]);
        tables.push({ name, ddl: (created as Record<string, string>[])[0]['Create Table'] });
      }
      await db.query('ROLLBACK');
      return { engine: 'MySQL', database: connection.database, tables };
    });
  } finally {
    await db.end().catch(() => {});
  }
}

/**
 * One page of `query.table`, and how many rows the table has. The statements come from
 * `mysqlRowsSql`; the limit and the offset are parameters. Both run in a read-only transaction.
 */
export async function readMysqlRows(connection: Connection, query: RowsQuery): Promise<{ rows: LiveRow[]; total: number }> {
  const sql = mysqlRowsSql(query);
  if (!sql) throw new Error('The request does not describe a table.');
  const db = await open(connection);
  try {
    return await reading(async () => {
      await db.query('START TRANSACTION READ ONLY');
      const [listed] = await db.query(sql.select, [query.limit, query.offset]);
      const [counted] = await db.query(sql.count);
      await db.query('ROLLBACK');
      const raw = (counted as { total: unknown }[])[0]?.total;
      const total = typeof raw === 'bigint' ? Number(raw) : Number(raw);
      if (!Number.isFinite(total)) throw new Error('Could not count the rows.');
      const rows = (listed as Record<string, unknown>[]).map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, liveValue(value)])));
      return { rows, total };
    });
  } finally {
    await db.end().catch(() => {});
  }
}

/** One line of MySQL's EXPLAIN, the fields that say where the rows came from. */
function explainLine(row: Record<string, unknown>): string {
  const cell = (key: string) => {
    const value = row[key];
    return value === null || value === undefined || value === '' ? '' : `${key}=${value}`;
  };
  return ['table', 'type', 'key', 'rows', 'Extra'].map(cell).filter(Boolean).join('  ');
}

/**
 * Runs one SELECT and its EXPLAIN in a read-only transaction. The statement comes from
 * `mysqlSelectSql`. At most 1,000 rows come back; `capped` is set when the query asked for more.
 */
export async function readMysqlQuery(
  connection: Connection,
  query: Select,
  tables: readonly QueryTable[],
): Promise<{ columns: string[]; rows: LiveRow[]; capped: boolean; plan: string[] }> {
  const bounded = boundedSelect(query);
  const sql = mysqlSelectSql(bounded.query, tables);
  if (!sql) throw new Error('The request does not describe a query.');
  const db = await open(connection);
  try {
    return await reading(async () => {
      await db.query('START TRANSACTION READ ONLY');
      const [listed, fields] = await db.query(sql.sql, sql.params);
      let plan: string[];
      try {
        const [explained] = await db.query(`EXPLAIN ${sql.sql}`, sql.params);
        plan = (explained as Record<string, unknown>[]).map(explainLine).filter(Boolean);
      } catch {
        plan = [];
      }
      await db.query('ROLLBACK');
      const raw = listed as Record<string, unknown>[];
      const capped = bounded.probe && raw.length > QUERY_MAX_ROWS;
      const kept = capped ? raw.slice(0, QUERY_MAX_ROWS) : raw;
      const named = (fields as { name: string }[] | undefined)?.map((field) => field.name);
      const columns = named?.length ? named : kept[0] ? Object.keys(kept[0]) : [];
      const rows = kept.map((row) => Object.fromEntries(columns.map((name) => [name, liveValue(row[name])])) as LiveRow);
      return { columns, rows, capped, plan };
    });
  } finally {
    await db.end().catch(() => {});
  }
}
