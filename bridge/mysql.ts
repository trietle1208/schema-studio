import mysql from 'mysql2/promise';
import type { Connection, MysqlCatalog } from '../src/core/introspect/catalog.ts';
import { reading } from './errors.ts';

// Reads the tables of one MySQL database as SHOW CREATE TABLE writes them. Nothing but the
// statements below is ever sent, and they run in a read-only transaction.

const CONNECT_TIMEOUT_MS = 8000;

const TABLES = `
  SELECT TABLE_NAME AS name
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME`;

export async function readMysql(connection: Connection): Promise<MysqlCatalog> {
  const db = await mysql.createConnection({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
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
