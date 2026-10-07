import Dexie, { type EntityTable } from 'dexie';
import type { SchemaSnapshot } from '../core/model';

/** One row per schema: what the lists show, and the number of its current version. */
export interface SchemaRecord {
  id: number;
  /** Unique among the schemas. */
  name: string;
  engine: string;
  /** The current version: the latest one saved. */
  version: number;
  /** Counts of the current version, so listing schemas reads no snapshot. */
  tables: number;
  relationships: number;
  /** Milliseconds since the epoch. `updatedAt` is when the current version was saved. */
  createdAt: number;
  updatedAt: number;
}

/** One row per saved version. A row is written once and never changed. */
export interface VersionRecord {
  id: number;
  schemaId: number;
  /** Counts up from 1 within a schema. */
  version: number;
  message: string;
  createdAt: number;
  snapshot: SchemaSnapshot;
}

export type Database = Dexie & {
  schemas: EntityTable<SchemaRecord, 'id'>;
  versions: EntityTable<VersionRecord, 'id'>;
};

export const db = new Dexie('schema-studio') as Database;

db.version(1).stores({
  schemas: '++id, &name, updatedAt',
  // The unique pair is what keeps a version from being stored twice.
  versions: '++id, &[schemaId+version]',
});
