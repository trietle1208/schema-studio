import Dexie from 'dexie';
import type { Table } from '../core/model';
import { seedRecords, type Row } from '../core/records';
import { db } from './db';

/**
 * The rows of `table`, made the first time they are asked for. The rows of every table without a
 * record are drawn together, so that foreign keys point at rows that exist, and stored; the tables
 * that have rows already keep them. `seed` defaults to the schema's id, so each schema has its
 * own data and the same data every time. A table that is not in `tables` has no rows.
 */
export function openRecords(schemaId: number, tables: readonly Table[], table: string, seed = schemaId): Promise<Row[]> {
  return db.transaction('rw', db.records, async () => {
    const stored = await db.records.get([schemaId, table]);
    if (stored) return stored.rows;
    if (!tables.some((t) => t.name === table)) return [];

    const have = new Set((await db.records.where('[schemaId+table]').between([schemaId, Dexie.minKey], [schemaId, Dexie.maxKey]).primaryKeys()).map(([, name]) => name));
    const made = seedRecords(tables, seed);
    const now = Date.now();
    await db.records.bulkAdd(
      tables.filter((t) => !have.has(t.name)).map((t) => ({ schemaId, table: t.name, rows: made[t.name], seed, createdAt: now })),
    );
    return made[table];
  });
}

/** How many rows each table that has been opened holds, by table name. */
export async function recordCounts(schemaId: number): Promise<Record<string, number>> {
  const all = await db.records.where('[schemaId+table]').between([schemaId, Dexie.minKey], [schemaId, Dexie.maxKey]).toArray();
  return Object.fromEntries(all.map((r) => [r.table, r.rows.length]));
}

/** What the Data mode shows: the rows of one table, and how many rows each table has. */
export interface TableRecords {
  rows: Row[];
  counts: Record<string, number>;
}

/**
 * The rows of `table` and the row counts of every table, for the Data mode. A schema that is not
 * stored yet (`schemaId` null) has nothing to keep rows in: its rows are drawn again each time, with
 * seed 0, and are gone when it goes. Opening a table fills all of them, so every table has a count.
 */
export async function readRecords(schemaId: number | null, tables: readonly Table[], table: string): Promise<TableRecords> {
  if (schemaId === null) {
    const made = seedRecords(tables, 0);
    return { rows: made[table] ?? [], counts: Object.fromEntries(Object.entries(made).map(([name, rows]) => [name, rows.length])) };
  }
  const rows = await openRecords(schemaId, tables, table);
  return { rows, counts: await recordCounts(schemaId) };
}
