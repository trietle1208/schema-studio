import Dexie from 'dexie';
import type { SchemaSnapshot, SchemaSummary } from '../core/model';
import { countRelations } from '../core/relations';
import { relativeTime } from '../core/time';
import { versionLabel } from '../core/versions';
import { db, type SchemaRecord, type VersionRecord } from './db';

export interface NewSchema {
  name: string;
  engine: string;
  description?: string;
}

/** A schema together with the snapshot of its current version. */
export interface StoredSchema {
  schema: SchemaRecord;
  snapshot: SchemaSnapshot;
}

/** Stores a new schema with `snapshot` as its v1. */
export function createSchema(
  { name, engine, description }: NewSchema,
  snapshot: SchemaSnapshot,
  message = '',
): Promise<SchemaRecord> {
  return db.transaction('rw', db.schemas, db.versions, async () => {
    if (await db.schemas.where('name').equals(name).count()) throw new Error(`Schema "${name}" already exists.`);
    const now = Date.now();
    const schema = {
      name,
      // A blank description is not stored.
      ...(description?.trim() ? { description: description.trim() } : {}),
      engine,
      version: 1,
      tables: snapshot.tables.length,
      relationships: countRelations(snapshot.tables),
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.schemas.add(schema);
    await db.versions.add({ schemaId: id, version: 1, message, createdAt: now, snapshot });
    return { ...schema, id };
  });
}

/**
 * Stores `snapshot` as the next version of a schema and makes it the current one. Earlier versions
 * are left as they are. Returns the schema, which carries the new version number.
 */
export function saveVersion(schemaId: number, snapshot: SchemaSnapshot, message = ''): Promise<SchemaRecord> {
  return db.transaction('rw', db.schemas, db.versions, async () => {
    const schema = await db.schemas.get(schemaId);
    if (!schema) throw new Error('Schema no longer exists.');
    const now = Date.now();
    const next: SchemaRecord = {
      ...schema,
      version: schema.version + 1,
      tables: snapshot.tables.length,
      relationships: countRelations(snapshot.tables),
      updatedAt: now,
    };
    await db.versions.add({ schemaId, version: next.version, message, createdAt: now, snapshot });
    await db.schemas.put(next);
    return next;
  });
}

/** Removes a schema and every version of it. Removing one that is already gone does nothing. */
export function deleteSchema(id: number): Promise<void> {
  return db.transaction('rw', db.schemas, db.versions, async () => {
    await db.versions
      .where('[schemaId+version]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey])
      .delete();
    await db.schemas.delete(id);
  });
}

/** Every schema, the one saved last first. */
export function listSchemas(): Promise<SchemaRecord[]> {
  return db.schemas.orderBy('updatedAt').reverse().toArray();
}

export function getVersion(schemaId: number, version: number): Promise<VersionRecord | undefined> {
  return db.versions.where('[schemaId+version]').equals([schemaId, version]).first();
}

/** The versions of a schema, newest first. */
export function listVersions(schemaId: number): Promise<VersionRecord[]> {
  return db.versions
    .where('[schemaId+version]')
    .between([schemaId, Dexie.minKey], [schemaId, Dexie.maxKey])
    .reverse()
    .toArray();
}

/** A schema with the snapshot of its current version. */
export function openSchema(id: number): Promise<StoredSchema | undefined> {
  return db.transaction('r', db.schemas, db.versions, async () => {
    const schema = await db.schemas.get(id);
    const current = schema && (await getVersion(id, schema.version));
    return current ? { schema, snapshot: current.snapshot } : undefined;
  });
}

/** The schema called `name`, with the snapshot of its current version. */
export function openSchemaNamed(name: string): Promise<StoredSchema | undefined> {
  return db.transaction('r', db.schemas, db.versions, async () => {
    const schema = await db.schemas.where('name').equals(name).first();
    return schema && openSchema(schema.id);
  });
}

/** The schema saved last, with the snapshot of its current version. Undefined while nothing is stored. */
export function openLatestSchema(): Promise<StoredSchema | undefined> {
  return db.transaction('r', db.schemas, db.versions, async () => {
    const latest = await db.schemas.orderBy('updatedAt').last();
    return latest && openSchema(latest.id);
  });
}

/** A schema as the sidebar and the schema list show it at the time `now`. */
export function schemaSummary(schema: SchemaRecord, now: number): SchemaSummary {
  return {
    name: schema.name,
    engine: schema.engine,
    tables: schema.tables,
    relationships: schema.relationships,
    version: versionLabel(schema.version),
    updated: relativeTime(schema.updatedAt, now),
  };
}
