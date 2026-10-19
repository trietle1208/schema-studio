import { beforeEach, describe, expect, it } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { defaultQuery } from '../core/records/query';
import { db } from './db';
import { clearQueries, deleteSavedQuery, listQueries, RECENT_QUERIES, recordRun, saveQuery } from './queries';
import { createSchema, deleteSchema } from './schemas';
import { resetDatabase } from './testing';

beforeEach(resetDatabase);

const ids = async (name: string) => (await createSchema({ name, engine: 'PostgreSQL' }, ecommerceSnapshot())).id;

describe('saved queries', () => {
  it('keeps a query under a name, with the Builder it was written in, and lists the newest first', async () => {
    const a = await ids('a');
    const spec = defaultQuery({ name: 'users' });
    await saveQuery(a, { name: 'Everyone', sql: 'SELECT *\nFROM users;', spec }, 1000);
    await saveQuery(a, { name: 'Paid orders', sql: "SELECT *\nFROM orders\nWHERE status = 'paid';" }, 2000);

    const { saved, recent } = await listQueries(a);
    expect(saved.map((q) => q.name)).toEqual(['Paid orders', 'Everyone']);
    expect(saved[1].spec).toEqual(spec);
    expect(saved[0]).not.toHaveProperty('spec');
    expect(recent).toEqual([]);
  });

  it('refuses a name that is taken, but only within the schema', async () => {
    const a = await ids('a');
    const b = await ids('b');
    await saveQuery(a, { name: 'Same', sql: 'SELECT 1' });
    await expect(saveQuery(a, { name: 'Same', sql: 'SELECT 2' })).rejects.toThrow('A saved query named "Same" already exists.');
    await saveQuery(b, { name: 'Same', sql: 'SELECT 3' });
    expect((await listQueries(a)).saved).toHaveLength(1);
    expect((await listQueries(b)).saved.map((q) => q.sql)).toEqual(['SELECT 3']);
  });
});

describe('deleting a saved query', () => {
  it('removes one query of the schema, hands it back, and lets the name be used again', async () => {
    const a = await ids('a');
    const keep = await saveQuery(a, { name: 'Keep', sql: 'SELECT 1' }, 1000);
    const drop = await saveQuery(a, { name: 'Drop', sql: 'SELECT 2', spec: defaultQuery({ name: 'users' }) }, 2000);

    const removed = await deleteSavedQuery(a, drop.id);
    expect(removed).toEqual(drop);
    expect((await listQueries(a)).saved.map((q) => q.name)).toEqual(['Keep']);

    // Put back with the same name and time, as Undo does.
    await saveQuery(a, { name: removed!.name!, sql: removed!.sql, spec: removed!.spec }, removed!.at);
    expect((await listQueries(a)).saved.map((q) => q.name)).toEqual(['Drop', 'Keep']);
    expect(keep.id).not.toBe(drop.id);
  });

  it('touches nothing for a query of another schema, a recent run or an id that is gone', async () => {
    const a = await ids('a');
    const b = await ids('b');
    const mine = await saveQuery(a, { name: 'Mine', sql: 'SELECT 1' });
    const run = await recordRun(a, { sql: 'SELECT 2', ok: true, ms: 1 });

    expect(await deleteSavedQuery(b, mine.id)).toBeNull();
    expect(await deleteSavedQuery(a, run.id)).toBeNull();
    expect(await deleteSavedQuery(a, 9999)).toBeNull();
    const { saved, recent } = await listQueries(a);
    expect(saved).toHaveLength(1);
    expect(recent).toHaveLength(1);
  });
});

describe('recent queries', () => {
  it('remember how a run went, and how long it took only when it worked', async () => {
    const a = await ids('a');
    await recordRun(a, { sql: 'SELECT * FROM users;', ok: true, ms: 12 }, 1000);
    await recordRun(a, { sql: 'SELECT nope FROM users;', ok: false, ms: 3 }, 2000);

    const { recent } = await listQueries(a);
    expect(recent.map((q) => [q.sql, q.ok, q.ms])).toEqual([
      ['SELECT nope FROM users;', false, undefined],
      ['SELECT * FROM users;', true, 12],
    ]);
  });

  it('list a query once, from its latest run', async () => {
    const a = await ids('a');
    await recordRun(a, { sql: 'SELECT 1', ok: true, ms: 5 }, 1000);
    await recordRun(a, { sql: 'SELECT 2', ok: true, ms: 5 }, 2000);
    await recordRun(a, { sql: 'SELECT 1', ok: false }, 3000);

    expect((await listQueries(a)).recent.map((q) => [q.sql, q.ok])).toEqual([['SELECT 1', false], ['SELECT 2', true]]);
  });

  it('keep the latest few', async () => {
    const a = await ids('a');
    for (let i = 0; i < RECENT_QUERIES + 3; i++) await recordRun(a, { sql: `SELECT ${i}`, ok: true, ms: 1 }, 1000 + i);

    const { recent } = await listQueries(a);
    expect(recent).toHaveLength(RECENT_QUERIES);
    expect(recent[0].sql).toBe(`SELECT ${RECENT_QUERIES + 2}`);
    expect(recent[RECENT_QUERIES - 1].sql).toBe('SELECT 3');
  });

  it('do not take the place of a saved query', async () => {
    const a = await ids('a');
    await saveQuery(a, { name: 'Mine', sql: 'SELECT 1' });
    await recordRun(a, { sql: 'SELECT 1', ok: true, ms: 1 });
    const { saved, recent } = await listQueries(a);
    expect(saved).toHaveLength(1);
    expect(recent).toHaveLength(1);
  });
});

describe('removing queries', () => {
  it('goes with the schema, and only with that one', async () => {
    const a = await ids('a');
    const b = await ids('b');
    for (const id of [a, b]) {
      await saveQuery(id, { name: 'Q', sql: 'SELECT 1' });
      await recordRun(id, { sql: 'SELECT 1', ok: true, ms: 1 });
    }
    await deleteSchema(a);
    expect(await db.queries.count()).toBe(2);
    expect((await listQueries(b)).saved).toHaveLength(1);

    await clearQueries(b);
    expect(await db.queries.count()).toBe(0);
  });
});
