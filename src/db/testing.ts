import { db } from './db';

/** Empties the database, for the start of each test. The tests run on fake-indexeddb (see vite.config.ts). */
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
