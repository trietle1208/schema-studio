import { sampleChanges } from '../core/fixtures/changes';
import { db } from './db';

/** Empties the database, for the start of each test. The tests run on fake-indexeddb (see vite.config.ts). */
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}

/** Writes the nine changes of the change log fixture (core/fixtures/changes) into the log. */
export async function seedChanges(): Promise<void> {
  await db.changes.bulkAdd(sampleChanges());
}
