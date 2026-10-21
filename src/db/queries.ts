import Dexie from 'dexie';
import type { QuerySpec } from '../core/records/query';
import { db, type QueryRecord } from './db';

/** How many runs are kept for a schema. */
export const RECENT_QUERIES = 8;

/** The queries of a schema, the newest first. */
export interface SchemaQueries {
  saved: QueryRecord[];
  recent: QueryRecord[];
}

const ofKind = (schemaId: number, kind: QueryRecord['kind']) => db.queries.where('[schemaId+kind]').equals([schemaId, kind]);

/** What a schema has saved and run, the newest first. */
export async function listQueries(schemaId: number): Promise<SchemaQueries> {
  const [saved, recent] = await Promise.all([ofKind(schemaId, 'saved').toArray(), ofKind(schemaId, 'recent').toArray()]);
  const newest = (a: QueryRecord, b: QueryRecord) => b.at - a.at || b.id - a.id;
  return { saved: saved.sort(newest), recent: recent.sort(newest) };
}

/**
 * Keeps a query under a name. Rejects with nothing written when the schema already has a saved
 * query of that name; names are compared as they are written.
 */
export function saveQuery(schemaId: number, entry: { name: string; sql: string; spec?: QuerySpec }, at = Date.now()): Promise<QueryRecord> {
  return db.transaction('rw', db.queries, async () => {
    const taken = await ofKind(schemaId, 'saved').filter((q) => q.name === entry.name).count();
    if (taken) throw new Error(`A saved query named "${entry.name}" already exists.`);
    const record: Omit<QueryRecord, 'id'> = { schemaId, kind: 'saved', name: entry.name, sql: entry.sql, ...(entry.spec ? { spec: entry.spec } : null), at };
    const id = await db.queries.add(record as QueryRecord);
    return { ...record, id };
  });
}

/**
 * Replaces the saved query of this name. Rejects, with nothing written, when the schema has no
 * saved query of that name. A query saved from SQL, with no Builder, drops the Builder it had.
 */
export function overwriteSavedQuery(schemaId: number, entry: { name: string; sql: string; spec?: QuerySpec }, at = Date.now()): Promise<QueryRecord> {
  return db.transaction('rw', db.queries, async () => {
    const found = await ofKind(schemaId, 'saved').filter((q) => q.name === entry.name).first();
    if (!found) throw new Error(`No saved query named "${entry.name}".`);
    const next: QueryRecord = { ...found, sql: entry.sql, at };
    if (entry.spec) next.spec = entry.spec;
    else delete next.spec;
    await db.queries.put(next);
    return next;
  });
}

/**
 * Gives a saved query another name. Rejects, with nothing written, when another saved query of
 * the schema already has that name. Answers null when this schema has no saved query with `id`.
 */
export function renameSavedQuery(schemaId: number, id: number, name: string, at = Date.now()): Promise<QueryRecord | null> {
  return db.transaction('rw', db.queries, async () => {
    const nextName = name.trim();
    if (!nextName) throw new Error('Query name cannot be empty.');
    const found = await db.queries.get(id);
    if (!found || found.schemaId !== schemaId || found.kind !== 'saved') return null;
    const taken = await ofKind(schemaId, 'saved').filter((q) => q.name === nextName && q.id !== id).count();
    if (taken) throw new Error(`A saved query named "${nextName}" already exists.`);
    const next: QueryRecord = { ...found, name: nextName, at };
    await db.queries.put(next);
    return next;
  });
}

/**
 * Removes a saved query. Answers the query that was removed, so that it can be put back, or null
 * when the schema has no saved query with that id (it is gone already).
 */
export function deleteSavedQuery(schemaId: number, id: number): Promise<QueryRecord | null> {
  return db.transaction('rw', db.queries, async () => {
    const found = await db.queries.get(id);
    if (!found || found.schemaId !== schemaId || found.kind !== 'saved') return null;
    await db.queries.delete(id);
    return found;
  });
}

/**
 * Remembers that a query was run. The same SQL run before is replaced, so a query is listed once,
 * and only the latest `RECENT_QUERIES` runs stay.
 */
export function recordRun(
  schemaId: number,
  run: { sql: string; spec?: QuerySpec; ok: boolean; ms?: number },
  at = Date.now(),
): Promise<QueryRecord> {
  return db.transaction('rw', db.queries, async () => {
    const same = await ofKind(schemaId, 'recent').filter((q) => q.sql === run.sql).primaryKeys();
    await db.queries.bulkDelete(same);
    const record: Omit<QueryRecord, 'id'> = {
      schemaId,
      kind: 'recent',
      sql: run.sql,
      ...(run.spec ? { spec: run.spec } : null),
      ok: run.ok,
      ...(run.ok && run.ms !== undefined ? { ms: run.ms } : null),
      at,
    };
    const id = await db.queries.add(record as QueryRecord);
    const kept = await ofKind(schemaId, 'recent').toArray();
    const old = kept.sort((a, b) => b.at - a.at || b.id - a.id).slice(RECENT_QUERIES);
    await db.queries.bulkDelete(old.map((q) => q.id));
    return { ...record, id };
  });
}

/** Removes every query of a schema. */
export async function clearQueries(schemaId: number): Promise<void> {
  await db.queries.where('[schemaId+kind]').between([schemaId, Dexie.minKey], [schemaId, Dexie.maxKey]).delete();
}
