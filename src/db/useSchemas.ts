import { useLiveQuery } from 'dexie-react-hooks';
import type { SchemaRecord, VersionRecord } from './db';
import { listSchemas, listVersions } from './schemas';

const NO_SCHEMAS: SchemaRecord[] = [];

/**
 * Every stored schema, the one saved last first; undefined until the first read is back. The list
 * is read again whenever a schema or a version is written, in this tab or another. A database that
 * cannot be read lists nothing.
 */
export function useSchemas(): SchemaRecord[] | undefined {
  return useLiveQuery(() => listSchemas().catch(() => NO_SCHEMAS), []);
}

const NO_VERSIONS: VersionRecord[] = [];

/**
 * The saved versions of a schema, newest first; undefined until the first read is back. Like the
 * list of schemas it is read again whenever a version is written. A schema that is not stored
 * (`id` null) has none.
 */
export function useVersions(schemaId: number | null): VersionRecord[] | undefined {
  return useLiveQuery(() => (schemaId === null ? NO_VERSIONS : listVersions(schemaId).catch(() => NO_VERSIONS)), [schemaId]);
}
