import Dexie, { type EntityTable } from 'dexie';
import type { SchemaSnapshot } from '../core/model';

/** One row per schema: what the lists show, and the number of its current version. */
export interface SchemaRecord {
  id: number;
  /** Unique among the schemas. */
  name: string;
  /** A line about what the schema holds, shown and searched in the schema list. */
  description?: string;
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

/**
 * One row per saved version. The snapshot of a row is written once and never changed; only the
 * words about it, `message` and `note`, can be edited afterwards (see `describeVersion`).
 */
export interface VersionRecord {
  id: number;
  schemaId: number;
  /** Counts up from 1 within a schema. */
  version: number;
  /** What the version is called in the history. Blank for a version that is listed by what it changed. */
  message: string;
  /** A longer text about the version. Left out when there is none. */
  note?: string;
  createdAt: number;
  snapshot: SchemaSnapshot;
}

/** An SSH server whose key was trusted, so the bridge logs in to it without asking again. One row per `host:port`. */
export interface KnownHostRecord {
  /** The server as it is named in the connection form, in lower case: `bastion.example.com:22`. */
  id: string;
  /** The key of the server as ssh-keygen writes it: `SHA256:…`. */
  fingerprint: string;
  /** Milliseconds since the epoch. */
  trustedAt: number;
}

export type Database = Dexie & {
  schemas: EntityTable<SchemaRecord, 'id'>;
  versions: EntityTable<VersionRecord, 'id'>;
  knownHosts: EntityTable<KnownHostRecord, 'id'>;
};

export const db = new Dexie('schema-studio') as Database;

db.version(1).stores({
  schemas: '++id, &name, updatedAt',
  // The unique pair is what keeps a version from being stored twice.
  versions: '++id, &[schemaId+version]',
});

db.version(2).stores({
  knownHosts: 'id',
});
