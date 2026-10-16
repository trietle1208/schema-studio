import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../core/fixtures/ecommerce';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { seedRecords, DEFAULT_RECORD_ROWS } from '../core/records';
import { insertRow, removeRows, replaceRow, restoreRows } from '../core/records/rows';
import { db } from './db';
import { changeRecords, openRecords, readAllRecords, readRecords, recordCounts, writeRecords } from './records';
import { createSchema, deleteSchema } from './schemas';
import { resetDatabase } from './testing';

const ecommerce = { name: 'ecommerce', engine: 'PostgreSQL' };

beforeEach(resetDatabase);

describe('openRecords', () => {
  it('draws the rows the first time a table is opened, and stores them', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect(await db.records.count()).toBe(0);

    const users = await openRecords(schema.id, ecommerceTables, 'users');

    expect(users).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(users).toEqual(seedRecords(ecommerceTables, schema.id).users);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(users);
  });

  it('fills every table together, so that foreign keys match whichever table is opened first', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const items = await openRecords(schema.id, ecommerceTables, 'order_items');
    const orders = await openRecords(schema.id, ecommerceTables, 'orders');
    const products = await openRecords(schema.id, ecommerceTables, 'products');

    expect(await db.records.count()).toBe(ecommerceTables.length);
    const orderIds = new Set(orders.map((r) => r.id));
    const productIds = new Set(products.map((r) => r.id));
    expect(items.every((r) => orderIds.has(r.order_id) && productIds.has(r.product_id))).toBe(true);
  });

  it('gives the same rows when it is asked again, without drawing again', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const first = await openRecords(schema.id, ecommerceTables, 'users');
    const createdAt = (await db.records.get([schema.id, 'users']))!.createdAt;

    // Another seed would give other rows; the stored ones win.
    expect(await openRecords(schema.id, ecommerceTables, 'users', 99)).toEqual(first);
    expect((await db.records.get([schema.id, 'users']))!.createdAt).toBe(createdAt);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('makes only what is missing: a table that has rows keeps them, even none', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await db.records.add({ schemaId: schema.id, table: 'users', rows: [], seed: 1, createdAt: 1 });

    expect(await openRecords(schema.id, ecommerceTables, 'users')).toEqual([]);
    expect(await db.records.count()).toBe(1);

    // Opening another table fills the others but leaves the emptied one as it is.
    expect(await openRecords(schema.id, ecommerceTables, 'orders')).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual([]);
  });

  it('fills a table that was added to the schema later without touching the others', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = ecommerceTables.filter((t) => t.name !== 'payments');
    await openRecords(schema.id, before, 'users');
    expect(await db.records.get([schema.id, 'payments'])).toBeUndefined();

    const payments = await openRecords(schema.id, ecommerceTables, 'payments');
    expect(payments).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(seedRecords(ecommerceTables, schema.id).users);
  });

  it('gives each schema its own rows', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'PostgreSQL' }, ecommerceSnapshot());
    const a = await openRecords(shop.id, ecommerceTables, 'users');
    const b = await openRecords(blog.id, ecommerceTables, 'users');

    expect(a).not.toEqual(b);
    expect(await db.records.count()).toBe(2 * ecommerceTables.length);
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
    expect(a).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(b).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('cannot store the same table of a schema twice', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'users');
    await expect(db.records.add({ schemaId: schema.id, table: 'users', rows: [], seed: 1, createdAt: 1 })).rejects.toThrow();
  });
});

describe('recordCounts', () => {
  it('counts the rows of the tables that were filled, of one schema', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'PostgreSQL' }, ecommerceSnapshot());
    expect(await recordCounts(shop.id)).toEqual({});

    await openRecords(shop.id, ecommerceTables, 'users');
    await db.records.put({ schemaId: shop.id, table: 'orders', rows: [], seed: 1, createdAt: 1 });
    await openRecords(blog.id, ecommerceTables.slice(0, 1), 'users');

    expect(await recordCounts(shop.id)).toEqual({
      users: DEFAULT_RECORD_ROWS,
      orders: 0,
      products: DEFAULT_RECORD_ROWS,
      payments: DEFAULT_RECORD_ROWS,
      order_items: DEFAULT_RECORD_ROWS,
    });
    expect(Object.keys(await recordCounts(blog.id))).toEqual(['users']);
  });
});

describe('deleteSchema', () => {
  it('removes the rows of the schema and keeps those of the others', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'PostgreSQL' }, ecommerceSnapshot());
    await openRecords(shop.id, ecommerceTables, 'users');
    const kept = await openRecords(blog.id, ecommerceTables, 'users');

    await deleteSchema(shop.id);

    expect(await recordCounts(shop.id)).toEqual({});
    expect(await db.records.count()).toBe(ecommerceTables.length);
    expect(await openRecords(blog.id, ecommerceTables, 'users')).toEqual(kept);
  });

  it('does not leave rows behind for a schema that never had any', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    await deleteSchema(shop.id);
    expect(await db.records.count()).toBe(0);
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

    expect(db.verno).toBe(3);
    expect(await db.schemas.toArray()).toEqual([expect.objectContaining({ id, name: 'old' })]);
    expect((await db.versions.toArray())[0].snapshot).toEqual(snapshot);
    expect(await db.records.count()).toBe(0);
    // The old schema gets its rows the first time its data is opened.
    expect(await openRecords(id, snapshot.tables, 'users')).toHaveLength(DEFAULT_RECORD_ROWS);
    expect(await recordCounts(id)).toMatchObject({ users: DEFAULT_RECORD_ROWS });
  });
});

describe('readRecords', () => {
  it('reads one table and the counts of all of them, filling every table the first time', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());

    const read = await readRecords(schema.id, ecommerceTables, 'orders');

    expect(read.rows).toEqual(seedRecords(ecommerceTables, schema.id).orders);
    expect(Object.keys(read.counts).sort()).toEqual(ecommerceTables.map((t) => t.name).sort());
    expect(read.counts.orders).toBe(read.rows.length);
    // The rows are stored: the next read gives the same.
    expect(await readRecords(schema.id, ecommerceTables, 'orders')).toEqual(read);
  });

  it('draws the rows of a schema that is not stored without storing them', async () => {
    const read = await readRecords(null, ecommerceTables, 'users');

    expect(read.rows).toEqual(seedRecords(ecommerceTables, 0).users);
    expect(read.counts.users).toBe(DEFAULT_RECORD_ROWS);
    expect(await db.records.count()).toBe(0);
  });

  it('has no rows for a table the schema does not have', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    expect((await readRecords(schema.id, ecommerceTables, 'nope')).rows).toEqual([]);
    expect((await readRecords(null, ecommerceTables, 'nope')).rows).toEqual([]);
  });
});

describe('changeRecords', () => {
  it('stores the rows the change gives, in one write, and returns them', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'users');
    const row = { ...before[0], id: 500, email: 'new@example.com' };

    const after = await changeRecords(schema.id, 'users', (rows) => insertRow(rows, row));

    expect(after).toHaveLength(before.length + 1);
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(after);
    expect((await recordCounts(schema.id)).users).toBe(before.length + 1);
    // The other tables are not touched.
    expect((await openRecords(schema.id, ecommerceTables, 'orders'))).toEqual(seedRecords(ecommerceTables, schema.id).orders);
  });

  it('edits, deletes and restores rows, and what is stored is what a reload reads', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'products');

    await changeRecords(schema.id, 'products', (rows) => replaceRow(rows, 1, { ...rows[1], name: 'Renamed' }));
    expect((await readRecords(schema.id, ecommerceTables, 'products')).rows[1].name).toBe('Renamed');

    const taken = removeRows(before, [0, 2]);
    await changeRecords(schema.id, 'products', (rows) => removeRows(rows, [0, 2]).rows);
    expect((await readRecords(schema.id, ecommerceTables, 'products')).rows).toHaveLength(before.length - 2);

    await changeRecords(schema.id, 'products', (rows) => restoreRows(rows, taken.removed));
    const rows = (await readRecords(schema.id, ecommerceTables, 'products')).rows;
    expect(rows.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(rows[1].name).toBe('Renamed');
  });

  it('keeps a table that was emptied empty: it is not drawn again', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'payments');
    await changeRecords(schema.id, 'payments', () => []);
    expect((await readRecords(schema.id, ecommerceTables, 'payments')).rows).toEqual([]);
  });

  it('writes nothing when the change throws', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const before = await openRecords(schema.id, ecommerceTables, 'users');
    await expect(
      changeRecords(schema.id, 'users', () => {
        throw new Error('no');
      }),
    ).rejects.toThrow('no');
    expect((await db.records.get([schema.id, 'users']))?.rows).toEqual(before);
  });

  it('has nothing to change in a table nothing opened', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await expect(changeRecords(schema.id, 'users', (rows) => rows)).rejects.toThrow();
  });
});

describe('readAllRecords', () => {
  it('reads every table, drawing the ones that have no rows yet together', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const all = await readAllRecords(schema.id, ecommerceTables);
    expect(Object.keys(all).sort()).toEqual(ecommerceTables.map((t) => t.name).sort());
    expect(all.users).toEqual(seedRecords(ecommerceTables, schema.id).users);
    expect(await db.records.count()).toBe(ecommerceTables.length);
  });

  it('reads the rows that were changed, not the ones that were drawn', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'users');
    await changeRecords(schema.id, 'users', (rows) => removeRows(rows, [0, 1]).rows);
    expect((await readAllRecords(schema.id, ecommerceTables)).users).toHaveLength(DEFAULT_RECORD_ROWS - 2);
  });

  it('draws a table the schema got after its rows were made, and keeps the others', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const users = await openRecords(schema.id, ecommerceTables, 'users');
    await db.records.delete([schema.id, 'payments']);
    const all = await readAllRecords(schema.id, ecommerceTables);
    expect(all.users).toEqual(users);
    expect(all.payments.length).toBeGreaterThan(0);
  });

  it('draws seed 0 for a schema that is not stored', async () => {
    expect(await readAllRecords(null, ecommerceTables)).toEqual(seedRecords(ecommerceTables, 0));
  });
});

describe('writeRecords', () => {
  it('replaces the rows of several tables in one write and gives back the rows they had', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const all = await readAllRecords(schema.id, ecommerceTables);

    const before = await writeRecords(schema.id, { orders: all.orders.slice(1), order_items: [] });

    expect(before).toEqual({ orders: all.orders, order_items: all.order_items });
    expect((await readAllRecords(schema.id, ecommerceTables)).orders).toHaveLength(all.orders.length - 1);
    expect(await recordCounts(schema.id)).toMatchObject({ order_items: 0, users: all.users.length });
    await writeRecords(schema.id, before);
    expect(await readAllRecords(schema.id, ecommerceTables)).toEqual(all);
  });

  it('writes nothing when one of the tables has not been opened', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await openRecords(schema.id, ecommerceTables, 'users');
    await db.records.delete([schema.id, 'orders']);
    const users = (await db.records.get([schema.id, 'users']))!.rows;

    await expect(writeRecords(schema.id, { users: [], orders: [] })).rejects.toThrow('orders');
    expect((await db.records.get([schema.id, 'users']))!.rows).toEqual(users);
  });
});
