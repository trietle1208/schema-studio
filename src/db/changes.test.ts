import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { pendingRuns, type Change } from '../core/changes/model';
import { sampleChanges } from '../core/fixtures/changes';
import { addChange, listChanges, markRuns, putChange, undoRuns } from './changes';
import { db } from './db';
import { resetDatabase, seedChanges } from './testing';

beforeEach(resetDatabase);

const seqs = (rows: { seq: number }[]) => rows.map((r) => r.seq);

/** `value` without the property `key`. */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<T, K>;
}

/** A change that waits everywhere, as `addChange` takes it: it has no number yet. */
const draft = (database = 'atad5s'): Omit<Change, 'seq'> => without({ ...sampleChanges()[0], runs: pendingRuns(), database }, 'seq');

describe('the database', () => {
  it('opens a database of version 8 as version 9, with what it holds', async () => {
    await db.delete();
    // The database as the version before this one left it.
    const old = new Dexie('schema-studio');
    old.version(8).stores({
      schemas: '++id, &name, updatedAt',
      versions: '++id, &[schemaId+version]',
      records: '[schemaId+table]',
      knownHosts: 'id',
      queries: '++id, [schemaId+kind]',
      connections: 'schemaId',
      views: '++id, schemaId',
    });
    await old.open();
    expect(old.verno).toBe(8);
    await old.table('schemas').add({ name: 'shop', engine: 'PostgreSQL', version: 1, tables: 1, relationships: 0, createdAt: 1, updatedAt: 1 });
    await old.table('views').add({ schemaId: 1, name: 'Pay', tables: ['orders'], positions: {}, at: 1 });
    await old.table('records').add({ schemaId: 1, table: 'orders', rows: [{ id: 1 }], seed: 1, createdAt: 1 });
    old.close();

    await db.open();
    expect(db.verno).toBe(9);
    expect(db.tables.map((table) => table.name)).toContain('changes');
    expect(await db.schemas.count()).toBe(1);
    expect(await db.views.count()).toBe(1);
    expect(await db.records.count()).toBe(1);
    expect(await db.changes.count()).toBe(0);
  });
});

describe('listChanges', () => {
  it('lists nothing in an empty log, and writes nothing to it', async () => {
    expect(await listChanges()).toEqual([]);
    expect(await listChanges()).toEqual([]);
    expect(await db.changes.count()).toBe(0);
  });

  it('lists the changes newest first, each with its id', async () => {
    await seedChanges();
    const rows = await listChanges();
    expect(seqs(rows)).toEqual([47, 46, 45, 44, 43, 42, 41, 40, 39]);
    expect(rows[0]).toMatchObject({ seq: 47, key: 'ATA-318', database: 'atad5s' });
    expect(rows.every((row) => typeof row.id === 'number')).toBe(true);
  });

  it('lists a log that was written to by hand as it is', async () => {
    await addChange(draft());
    expect(seqs(await listChanges())).toEqual([1]);
    expect(await db.changes.count()).toBe(1);
  });
});

describe('putChange', () => {
  it('adds a change that has no id, and gives it one', async () => {
    await seedChanges();
    const [first] = await listChanges();
    const added = await putChange({ ...without(first, 'id'), seq: 60, title: 'Another' });
    expect(typeof added.id).toBe('number');
    expect(added.id).not.toBe(first.id);
    expect(await db.changes.count()).toBe(10);
    expect(seqs(await listChanges())[0]).toBe(60);
  });

  it('replaces a stored change by its id', async () => {
    await seedChanges();
    const [first] = await listChanges();
    const renamed = await putChange({ ...first, title: 'Renamed' });
    expect(renamed.id).toBe(first.id);
    const rows = await listChanges();
    expect(rows).toHaveLength(9);
    expect(rows.find((r) => r.id === first.id)!.title).toBe('Renamed');
  });

  it('refuses the number of another change', async () => {
    await seedChanges();
    const [first] = await listChanges();
    await expect(putChange({ ...without(first, 'id'), seq: 46 })).rejects.toThrow();
    expect(await db.changes.count()).toBe(9);
  });
});

describe('addChange', () => {
  it('takes the next number of the log, whatever the database', async () => {
    await seedChanges();
    const first = await addChange(draft('acm'));
    const second = await addChange(draft('acm'));
    expect([first.seq, second.seq]).toEqual([48, 49]);
    expect(seqs(await listChanges()).slice(0, 2)).toEqual([49, 48]);
  });

  it('starts at 1 in an empty log, and is not made twice by two at once', async () => {
    const [a, b] = await Promise.all([addChange(draft()), addChange(draft())]);
    expect([a.seq, b.seq].sort()).toEqual([1, 2]);
  });
});

describe('markRuns', () => {
  const at = new Date(2026, 9, 26, 12, 0).getTime();

  it('writes the run and its time at once, and the next read sees them', async () => {
    await seedChanges();
    const marked = await markRuns([46, 47], 'staging', at);
    expect(seqs(marked).sort()).toEqual([46, 47]);

    const rows = await listChanges();
    expect(rows.find((r) => r.seq === 46)!.runs.staging).toEqual({ status: 'ran', at, undo: { status: 'pending' } });
    expect(rows.find((r) => r.seq === 47)!.runs.staging).toEqual({ status: 'ran', at, undo: { status: 'pending' } });
    expect(rows.find((r) => r.seq === 45)!.runs.staging.status).toBe('ran');
    expect(rows.find((r) => r.seq === 46)!.runs.production).toEqual({ status: 'pending' });
  });

  it('stamps the moment of the call when no time is given', async () => {
    await seedChanges();
    const before = Date.now();
    const [marked] = await markRuns([45], 'production');
    expect(marked.runs.production.at).toBeGreaterThanOrEqual(before);
    expect(marked.runs.production.at).toBeLessThanOrEqual(Date.now());
  });

  it('leaves a change that was run there, and one that is not in the log', async () => {
    await seedChanges();
    expect(await markRuns([41, 9999], 'production', at)).toEqual([]);
    const rows = await listChanges();
    expect(rows.find((r) => r.seq === 41)!.runs.production).toEqual(sampleChanges().find((c) => c.seq === 41)!.runs.production);
  });

  it('takes the marks back one step', async () => {
    await seedChanges();
    await markRuns([46, 45], 'production', at);
    const undone = await undoRuns([46, 41], 'production');
    expect(seqs(undone)).toEqual([46]);
    const rows = await listChanges();
    expect(rows.find((r) => r.seq === 46)!.runs.production).toEqual({ status: 'pending' });
    expect(rows.find((r) => r.seq === 45)!.runs.production.status).toBe('ran');
  });
});
