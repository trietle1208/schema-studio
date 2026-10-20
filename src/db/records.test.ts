import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../core/fixtures/ecommerce';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { insertRow, removeRows, replaceRow, restoreRows } from '../core/records/rows';
import { db } from './db';
import { changeRecords, openRecords, readAllRecords, readRecords, recordCounts, writeRecords } from './records';
import { createSchema, deleteSchema } from './schemas';
import { resetDatabase } from './testing';

const ecommerce = { name: 'ecommerce', engine: 'PostgreSQL' };

beforeEach(resetDatabase);

describe('openRecords', () => {
  it('creates empty rows the first time a table is opened, and stores them', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect(await db.records.count()).toBe(0);

    const users = await openRecords(schema.id, ecommerceTables, 'users');

    expect(users).toEqual([]);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual([]);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('opens every table together when any one is opened first', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'order_items');
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect(await openRecords(schema.id, ecommerceTables, 'orders')).toEqual([]);
    expect(await openRecords(schema.id, ecommerceTables, 'products')).toEqual([]);
  });

  it('gives the same rows when it is asked again, without creating again', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const first = await openRecords(schema.id, ecommerceTables, 'users');
    const createdAt = (await db.records.get([schema.id, 'users']))!.createdAt;

    expect(await openRecords(schema.id, ecommerceTables, 'users', 99)).toEqual(first);
    expect((await db.records.get([schema.id, 'users']))!.createdAt).toBe(createdAt);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('makes only what is missing: a table that has rows keeps them, even none', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await db.records.add({ schemaId: schema.id, table: 'users', rows: [{ id: 1 }], seed: 1, createdAt: 1 });

    expect(await openRecords(schema.id, ecommerceTables, 'users')).toEqual([{ id: 1 }]);
    expect(await db.records.count()).toBe(1);

    expect(await openRecords(schema.id, ecommerceTables, 'orders')).toEqual([]);
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual([{ id: 1 }]);
  });

  it('fills a table that was added to the schema later without touching the others', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = ecommerceTables.filter((t) => t.name !== 'payments');
    await openRecords(schema.id, before, 'users');
    expect(await db.records.get([schema.id, 'payments'])).toBeUndefined();

    const payments = await openRecords(schema.id, ecommerceTables, 'payments');
    expect(payments).toEqual([]);
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual([]);
  });

  it('gives each schema its own records', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'PostgreSQL' }, ecommerceSnapshot());
    await openRecords(shop.id, ecommerceTables, 'users');
    await openRecords(blog.id, ecommerceTables, 'users');

    expect(await db.records.count()).toBe(2 * ecommerceTables.length);
    expect(await db.records.get([shop.id, 'users'])).toBeDefined();
    expect(await db.records.get([blog.id, 'users'])).toBeDefined();
  });

  it('has no rows for a table the schema does not have, and stores nothing', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect(await openRecords(schema.id, ecommerceTables, 'nope')).toEqual([]);
    expect(await db.records.count()).toBe(0);
  });

  it('stores the rows once when two opens run at the same time', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const [a, b] = await Promise.all([
      openRecords(schema.id, ecommerceTables, 'users'),
      openRecords(schema.id, ecommerceTables, 'orders'),
    ]);
    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(await db.records.count()).toBe(ecommerceTables.length);
    await expect(db.records.add({ schemaId: schema.id, table: 'users', rows: [], seed: 1, createdAt: 1 })).rejects.toThrow();
  });
});

describe('recordCounts', () => {
  it('counts the rows of every table that has been opened', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect(await recordCounts(schema.id)).toEqual({});
    await openRecords(schema.id, ecommerceTables, 'users');
    expect(await recordCounts(schema.id)).toEqual(Object.fromEntries(ecommerceTables.map((t) => [t.name, 0])));
  });
});

describe('deleteSchema clears its records', () => {
  it('removes the records of a schema that is deleted', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'PostgreSQL' }, ecommerceSnapshot());
    await openRecords(shop.id, ecommerceTables, 'users');
    await openRecords(blog.id, ecommerceTables, 'users');

    await deleteSchema(shop.id);

    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect(await openRecords(blog.id, ecommerceTables, 'users')).toEqual([]);
  });
});

describe('database version 2', () => {
  it('opens a database made before records, keeping its schemas and versions', async () => {
    await db.delete();
    const before = new Dexie('schema-studio');
    before.version(1).stores({ schemas: '++id, &name, updatedAt', versions: '++id, &[schemaId+version]' });
    const snapshot = ecommerceSnapshot();
    const id = (await before.table('schemas').add({ name: 'old', engine: 'PostgreSQL', version: 1, tables: 5, relationships: 4, createdAt: 1, updatedAt: 1 })) as number;
    await before.table('versions').add({ schemaId: id, version: 1, message: 'Sample schema', createdAt: 1, snapshot });
    before.close();

    await db.open();

    expect(db.verno).toBe(6);
    expect(await db.schemas.toArray()).toEqual([expect.objectContaining({ id, name: 'old' })]);
    expect((await db.versions.toArray())[0].snapshot).toEqual(snapshot);
    expect(await db.records.count()).toBe(0);
    expect(await db.queries.count()).toBe(0);
    expect(await openRecords(id, snapshot.tables, 'users')).toEqual([]);
    expect(await recordCounts(id)).toMatchObject({ users: 0 });
  });
});

describe('readRecords', () => {
  it('reads one table and the counts of all of them, filling every table the first time', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());

    const read = await readRecords(schema.id, ecommerceTables, 'orders');

    expect(read.rows).toEqual([]);
    expect(Object.keys(read.counts).sort()).toEqual(ecommerceTables.map((t) => t.name).sort());
    expect(read.counts.orders).toBe(0);
    expect(await readRecords(schema.id, ecommerceTables, 'orders')).toEqual(read);
  });

  it('gives empty rows for a schema that is not stored without storing them', async () => {
    const read = await readRecords(null, ecommerceTables, 'users');
    expect(read.rows).toEqual([]);
    expect(read.counts.users).toBe(0);
    expect(await db.records.count()).toBe(0);
  });
});

describe('changeRecords and writeRecords', () => {
  it('changes the rows of one table in one write', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'users');
    const after = insertRow(before, { id: 1, email: 'a@x.io' });

    expect(await changeRecords(schema.id, 'users', () => after)).toEqual(after);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(after);
    expect(await openRecords(schema.id, ecommerceTables, 'orders')).toEqual([]);
  });

  it('replaces several tables and returns what they had', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'products');
    const next = insertRow(before, { id: 99, sku: 'X' });

    const previous = await writeRecords(schema.id, { products: next, users: [{ id: 1 }] });
    expect(previous.products).toEqual(before);
    expect(previous.users).toEqual([]);
    expect((await db.records.get([schema.id, 'products']))?.rows).toEqual(next);
  });

  it('refuses a table that has not been opened', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await expect(changeRecords(schema.id, 'payments', (r) => r)).rejects.toThrow(/have not been opened/);
    await expect(writeRecords(schema.id, { payments: [] })).rejects.toThrow(/have not been opened/);
  });

  it('undoes a change by writing the rows it returned', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'users');
    const next = insertRow(before, { id: 1 });
    await changeRecords(schema.id, 'users', () => next);
    await writeRecords(schema.id, { users: before });
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(before);
  });
});

describe('readAllRecords', () => {
  it('reads every table, opening those that are missing', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect(await db.records.count()).toBe(0);
    const all = await readAllRecords(schema.id, ecommerceTables);
    expect(Object.keys(all).sort()).toEqual(ecommerceTables.map((t) => t.name).sort());
    expect(all.users).toEqual([]);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('fills a table that appeared after the others were opened', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'users');
    await db.records.delete([schema.id, 'orders']);
    const all = await readAllRecords(schema.id, ecommerceTables);
    expect(all.orders).toEqual([]);
    expect(all.users).toEqual([]);
  });

  it('gives empty tables for a schema that is not stored', async () => {
    expect(await readAllRecords(null, ecommerceTables)).toEqual(Object.fromEntries(ecommerceTables.map((t) => [t.name, []])));
    expect(await db.records.count()).toBe(0);
  });
});

describe('row helpers through changeRecords', () => {
  it('inserts, replaces and removes through changeRecords', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'users');
    const a = { id: 1, email: 'a@x.io' };
    const b = { id: 2, email: 'b@x.io' };
    await changeRecords(schema.id, 'users', (rows) => insertRow(rows, a));
    await changeRecords(schema.id, 'users', (rows) => insertRow(rows, b));
    await changeRecords(schema.id, 'users', (rows) => replaceRow(rows, 0, { ...a, email: 'aa@x.io' }));
    const { rows, removed } = removeRows((await db.records.get([schema.id, 'users']))!.rows, [1]);
    expect(removed).toEqual([{ index: 1, row: b }]);
    await changeRecords(schema.id, 'users', () => rows);
    expect((await db.records.get([schema.id, 'users']))!.rows).toEqual([{ id: 1, email: 'aa@x.io' }]);
    await changeRecords(schema.id, 'users', (cur) => restoreRows(cur, removed));
    expect((await db.records.get([schema.id, 'users']))!.rows).toEqual([
      { id: 1, email: 'aa@x.io' },
      b,
    ]);
  });
});
