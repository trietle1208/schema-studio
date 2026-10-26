import { markRuns as markChangeRuns } from '../core/changes/deploy';
import { undoRun, type Change, type ServerId } from '../core/changes/model';
import { db, type ChangeRecord } from './db';

/** Every change of the log, the newest first. An empty log lists nothing: nothing is written to it for the sake of having something to show. */
export function listChanges(): Promise<ChangeRecord[]> {
  return db.changes.orderBy('seq').reverse().toArray();
}

/**
 * Keeps a change: a new one is added, one that is stored (it has an `id`) is replaced. Rejects when
 * another change has its `seq`. Written at once, not when anything is saved.
 */
export async function putChange(change: Change & { id?: number }): Promise<ChangeRecord> {
  const id = await db.changes.put(change);
  return { ...change, id };
}

/** Adds a change under the next number of the log: one more than the highest, whatever the database. */
export function addChange(draft: Omit<Change, 'seq'>): Promise<ChangeRecord> {
  return db.transaction('rw', db.changes, async () => {
    const last = await db.changes.orderBy('seq').last();
    const change: Change = { ...draft, seq: (last?.seq ?? 0) + 1 };
    const id = await db.changes.add(change);
    return { ...change, id };
  });
}

/**
 * Marks the changes called `seqs` as run on `server` at `at`, in one write. A change that is run
 * there already, or is not in the log, is left as it is. Answers the changes that were marked.
 */
export function markRuns(seqs: Iterable<number>, server: ServerId, at = Date.now()): Promise<ChangeRecord[]> {
  const wanted = [...seqs];
  return db.transaction('rw', db.changes, async () => {
    const stored = await db.changes.where('seq').anyOf(wanted).toArray();
    const marked = markChangeRuns(stored, wanted, server, at);
    await db.changes.bulkPut(marked);
    return marked;
  });
}

/** Takes back the last setting of the run on `server` of each change called `seqs`: what `markRuns` did, as far as it went. */
export function undoRuns(seqs: Iterable<number>, server: ServerId): Promise<ChangeRecord[]> {
  return db.transaction('rw', db.changes, async () => {
    const stored = await db.changes.where('seq').anyOf([...seqs]).toArray();
    const undone = stored.filter((c) => c.runs[server].undo).map((c) => undoRun(c, server));
    await db.changes.bulkPut(undone);
    return undone;
  });
}
