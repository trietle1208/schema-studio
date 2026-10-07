import { useLiveQuery } from 'dexie-react-hooks';
import type { SchemaRecord } from './db';
import { listSchemas } from './schemas';

const NO_SCHEMAS: SchemaRecord[] = [];

/**
 * Every stored schema, the one saved last first; undefined until the first read is back. The list
 * is read again whenever a schema or a version is written, in this tab or another. A database that
 * cannot be read lists nothing.
 */
export function useSchemas(): SchemaRecord[] | undefined {
  return useLiveQuery(() => listSchemas().catch(() => NO_SCHEMAS), []);
}
