import Dexie from 'dexie';
import type { Table } from '../core/model';
import { seedRecords, type Row, type RecordsByTable } from '../core/records';
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

/**
 * The rows of every table of `tables`, for the record editor: what a foreign key is chosen from and
 * checked against, and the rows that point at a record. A schema that is not stored has seed 0.
 */
export async function readAllRecords(schemaId: number | null, tables: readonly Table[]): Promise<RecordsByTable> {
  if (schemaId === null) return seedRecords(tables, 0);
  const stored = () => db.records.where('[schemaId+table]').between([schemaId, Dexie.minKey], [schemaId, Dexie.maxKey]).toArray();
  let all = await stored();
  // A table the schema got after its rows were drawn has none yet: opening it draws all that are missing.
  const missing = tables.find((t) => !all.some((r) => r.table === t.name));
  if (missing) {
    await openRecords(schemaId, tables, missing.name);
    all = await stored();
  }
  return Object.fromEntries(tables.map((t) => [t.name, all.find((r) => r.table === t.name)?.rows ?? []]));
}

/**
 * Changes the rows of a table that has been opened, in one write: `change` is given the stored rows
 * and returns the rows to store (see `core/records/rows`). Returns what was stored. A table that has
 * no record yet has nothing to change, as nothing has opened it.
 */
export function changeRecords(schemaId: number, table: string, change: (rows: Row[]) => Row[]): Promise<Row[]> {
  return db.transaction('rw', db.records, async () => {
    const stored = await db.records.get([schemaId, table]);
    if (!stored) throw new Error(`The records of ${table} have not been opened.`);
    const rows = change(stored.rows);
    await db.records.update([schemaId, table], { rows });
    return rows;
  });
}

/**
 * Replaces the rows of several tables in one write, as a delete that reaches other tables does.
 * Returns the rows each table had, so that writing them back undoes it. A table that has not been
 * opened has nothing to replace, and nothing is written.
 */
export function writeRecords(schemaId: number, rows: Readonly<Record<string, Row[]>>): Promise<Record<string, Row[]>> {
  return db.transaction('rw', db.records, async () => {
    const before: Record<string, Row[]> = {};
    for (const table of Object.keys(rows)) {
      const stored = await db.records.get([schemaId, table]);
      if (!stored) throw new Error(`The records of ${table} have not been opened.`);
      before[table] = stored.rows;
    }
    for (const [table, next] of Object.entries(rows)) await db.records.update([schemaId, table], { rows: next });
    return before;
  });
}
