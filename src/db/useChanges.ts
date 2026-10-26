import { useLiveQuery } from 'dexie-react-hooks';
import type { ChangeRecord } from './db';
import { listChanges } from './changes';

const NO_CHANGES: ChangeRecord[] = [];

/**
 * Every change of the log, the newest first; undefined until the first read is back. The list is
 * read again whenever a change is written. A database that cannot be read lists nothing.
 */
export function useChanges(): ChangeRecord[] | undefined {
  return useLiveQuery(() => listChanges().catch(() => NO_CHANGES), []);
}
