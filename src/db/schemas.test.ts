import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteTable, moveTable } from '../core/edit';
import { ecommerceSnapshot, tableNamed } from '../core/fixtures/testing';
import type { SchemaSnapshot } from '../core/model';
import { db } from './db';
import {
  createSchema,
  deleteSchema,
  getVersion,
  listSchemas,
  listVersions,
  openLatestSchema,
  openSchema,
  openSchemaNamed,
  restoreVersion,
  saveVersion,
  schemaSummary,
} from './schemas';
import { resetDatabase } from './testing';

const ecommerce = { name: 'ecommerce', engine: 'PostgreSQL' };
const T0 = new Date(2026, 9, 6, 8, 14).getTime();
const HOUR = 3_600_000;

/** Sets the clock that stamps the records. Only `Date` is faked: IndexedDB needs the real timers. */
const at = (time: number) => vi.setSystemTime(time);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(T0);
  await resetDatabase();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSchema', () => {
  it('stores the schema with the snapshot as v1', async () => {
    const snapshot = ecommerceSnapshot();
    const schema = await createSchema(ecommerce, snapshot, 'Sample schema');

    expect(schema).toEqual({
      id: schema.id,
      name: 'ecommerce',
      engine: 'PostgreSQL',
      version: 1,
      tables: 5,
      relationships: 4,
      createdAt: T0,
      updatedAt: T0,
    });
    expect(await db.schemas.get(schema.id)).toEqual(schema);
    expect(await listVersions(schema.id)).toEqual([
      { id: expect.any(Number), schemaId: schema.id, version: 1, message: 'Sample schema', createdAt: T0, snapshot },
    ]);
  });

  it('keeps a description, trimmed, and leaves a blank one out', async () => {
    const shop = await createSchema({ ...ecommerce, description: '  Orders, catalogue, payments ' }, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'MySQL', description: '   ' }, { tables: [], positions: {} });

    expect(shop.description).toBe('Orders, catalogue, payments');
    expect((await db.schemas.get(shop.id))?.description).toBe('Orders, catalogue, payments');
    expect(blog).not.toHaveProperty('description');
    expect(blog).toMatchObject({ version: 1, tables: 0, relationships: 0 });
    expect((await openSchema(blog.id))?.snapshot).toEqual({ tables: [], positions: {} });
  });

  it('refuses a name that is taken and stores nothing', async () => {
    await createSchema(ecommerce, ecommerceSnapshot());
    await expect(createSchema({ name: 'ecommerce', engine: 'MySQL' }, ecommerceSnapshot())).rejects.toThrow(
      'Schema "ecommerce" already exists.',
    );
    expect(await db.schemas.count()).toBe(1);
    expect(await db.versions.count()).toBe(1);
  });
});

describe('saveVersion', () => {
  it('adds the next version, makes it current and leaves the earlier ones as they were', async () => {
    const v1 = ecommerceSnapshot();
    const schema = await createSchema(ecommerce, v1, 'Sample schema');

    at(T0 + HOUR);
    const v2 = deleteTable(v1, 'payments');
    const saved = await saveVersion(schema.id, v2, 'Drop payments');

    expect(saved).toEqual({ ...schema, version: 2, tables: 4, relationships: 3, updatedAt: T0 + HOUR });
    expect(await db.schemas.get(schema.id)).toEqual(saved);

    at(T0 + 2 * HOUR);
    const v3 = moveTable(v2, 'users', { x: 40, y: 48 });
    expect((await saveVersion(schema.id, v3)).version).toBe(3);

    const versions = await listVersions(schema.id);
    expect(versions.map((v) => [v.version, v.message, v.createdAt])).toEqual([
      [3, '', T0 + 2 * HOUR],
      [2, 'Drop payments', T0 + HOUR],
      [1, 'Sample schema', T0],
    ]);
    expect(versions.map((v) => v.snapshot)).toEqual([v3, v2, v1]);
    expect((await getVersion(schema.id, 1))?.snapshot.tables.map((t) => t.name)).toContain('payments');
  });

  it('stores a copy: editing the object that was saved does not reach the version', async () => {
    const snapshot: SchemaSnapshot = structuredClone(ecommerceSnapshot());
    const schema = await createSchema(ecommerce, snapshot);

    tableNamed(snapshot, 'users').columns.length = 0;
    snapshot.positions.users = { x: 0, y: 0 };

    expect((await getVersion(schema.id, 1))?.snapshot).toEqual(ecommerceSnapshot());
  });

  it('numbers the versions of each schema separately', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const blog = await createSchema({ name: 'blog', engine: 'MySQL' }, ecommerceSnapshot());
    await saveVersion(shop.id, deleteTable(ecommerceSnapshot(), 'payments'));

    expect((await saveVersion(blog.id, ecommerceSnapshot())).version).toBe(2);
    expect((await saveVersion(shop.id, ecommerceSnapshot())).version).toBe(3);
    expect((await listVersions(blog.id)).map((v) => v.version)).toEqual([2, 1]);
    expect((await listVersions(shop.id)).map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it('gives two saves of one schema that run at once different numbers', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const saved = await Promise.all([
      saveVersion(schema.id, ecommerceSnapshot(), 'a'),
      saveVersion(schema.id, ecommerceSnapshot(), 'b'),
    ]);
    expect(saved.map((s) => s.version).sort()).toEqual([2, 3]);
    expect((await db.schemas.get(schema.id))?.version).toBe(3);
  });

  it('cannot store a version number twice', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const again = { schemaId: schema.id, version: 1, message: '', createdAt: T0, snapshot: ecommerceSnapshot() };
    await expect(db.versions.add(again)).rejects.toThrow();
    expect(await db.versions.count()).toBe(1);
  });

  it('fails for a schema that is gone, storing nothing', async () => {
    await expect(saveVersion(99, ecommerceSnapshot())).rejects.toThrow('Schema no longer exists.');
    expect(await db.versions.count()).toBe(0);
  });
});

describe('restoreVersion', () => {
  it('stores the earlier snapshot as the next version and keeps every version in between', async () => {
    const first = ecommerceSnapshot();
    const schema = await createSchema(ecommerce, first, 'Sample schema');
    at(T0 + HOUR);
    await saveVersion(schema.id, deleteTable(first, 'payments'), 'Drop payments');
    at(T0 + 2 * HOUR);

    const restored = await restoreVersion(schema.id, 1);
    expect(restored.schema).toMatchObject({ version: 3, tables: 5, relationships: 4, updatedAt: T0 + 2 * HOUR });
    expect(restored.snapshot).toEqual(first);
    expect((await listVersions(schema.id)).map((v) => [v.version, v.message, v.snapshot.tables.length])).toEqual([
      [3, 'Restored from v1', 5],
      [2, 'Drop payments', 4],
      [1, 'Sample schema', 5],
    ]);
    expect((await openSchema(schema.id))?.snapshot).toEqual(first);
  });

  it('rejects for a version that is not there, and stores nothing', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    await expect(restoreVersion(schema.id, 7)).rejects.toThrow('Version v7 no longer exists.');
    expect(await db.versions.count()).toBe(1);
  });
});

describe('deleteSchema', () => {
  it('removes the schema with all its versions and leaves the others alone', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    await saveVersion(shop.id, deleteTable(ecommerceSnapshot(), 'payments'));
    const blog = await createSchema({ name: 'blog', engine: 'MySQL' }, ecommerceSnapshot());
    await saveVersion(blog.id, deleteTable(ecommerceSnapshot(), 'users'));

    await deleteSchema(shop.id);

    expect((await listSchemas()).map((s) => s.name)).toEqual(['blog']);
    expect(await listVersions(shop.id)).toEqual([]);
    expect(await openSchema(shop.id)).toBeUndefined();
    expect((await listVersions(blog.id)).map((v) => v.version)).toEqual([2, 1]);
    expect(await db.versions.count()).toBe(2);
  });

  it('frees the name for a new schema, which starts again at v1', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    await saveVersion(shop.id, deleteTable(ecommerceSnapshot(), 'payments'));
    await deleteSchema(shop.id);

    const again = await createSchema(ecommerce, { tables: [], positions: {} });
    expect(again.id).not.toBe(shop.id);
    expect(again.version).toBe(1);
    expect((await listVersions(again.id)).map((v) => v.version)).toEqual([1]);
  });

  it('does nothing for a schema that is already gone', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    await deleteSchema(99);
    await deleteSchema(shop.id);
    await deleteSchema(shop.id);
    expect(await db.schemas.count()).toBe(0);
    expect(await db.versions.count()).toBe(0);
  });
});

describe('listSchemas', () => {
  it('lists the schema saved last first', async () => {
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    at(T0 + HOUR);
    await createSchema({ name: 'blog', engine: 'MySQL' }, ecommerceSnapshot());
    expect((await listSchemas()).map((s) => s.name)).toEqual(['blog', 'ecommerce']);

    at(T0 + 2 * HOUR);
    await saveVersion(shop.id, deleteTable(ecommerceSnapshot(), 'payments'));
    expect((await listSchemas()).map((s) => [s.name, s.version, s.tables])).toEqual([
      ['ecommerce', 2, 4],
      ['blog', 1, 5],
    ]);
  });

  it('is empty in a new database', async () => {
    expect(await listSchemas()).toEqual([]);
  });
});

describe('openSchema', () => {
  it('returns the schema with the snapshot of its current version', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    const v2 = deleteTable(ecommerceSnapshot(), 'payments');
    const saved = await saveVersion(schema.id, v2);

    expect(await openSchema(schema.id)).toEqual({ schema: saved, snapshot: v2 });
  });

  it('is undefined for an id that is not stored', async () => {
    expect(await openSchema(99)).toBeUndefined();
  });
});

describe('openSchemaNamed', () => {
  it('finds a schema by its name', async () => {
    await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: [], positions: {} });
    const shop = await createSchema(ecommerce, ecommerceSnapshot());
    const v2 = deleteTable(ecommerceSnapshot(), 'payments');
    const saved = await saveVersion(shop.id, v2);

    expect(await openSchemaNamed('ecommerce')).toEqual({ schema: saved, snapshot: v2 });
    expect((await openSchemaNamed('blog'))?.snapshot).toEqual({ tables: [], positions: {} });
  });

  it('is undefined for a name that is not stored', async () => {
    await createSchema(ecommerce, ecommerceSnapshot());
    expect(await openSchemaNamed('Ecommerce')).toBeUndefined();
    expect(await openSchemaNamed('')).toBeUndefined();
  });
});

describe('openLatestSchema', () => {
  it('is undefined while nothing is stored, and stores nothing', async () => {
    expect(await openLatestSchema()).toBeUndefined();
    expect(await db.schemas.count()).toBe(0);
  });

  it('opens the schema saved last', async () => {
    await createSchema(ecommerce, ecommerceSnapshot());
    at(T0 + HOUR);
    const blog = await createSchema({ name: 'blog', engine: 'MySQL' }, ecommerceSnapshot());
    expect((await openLatestSchema())?.schema.name).toBe('blog');

    at(T0 + 2 * HOUR);
    const v2 = deleteTable(ecommerceSnapshot(), 'payments');
    const saved = await saveVersion(blog.id, v2);
    expect(await openLatestSchema()).toEqual({ schema: saved, snapshot: v2 });
  });
});

describe('schemaSummary', () => {
  it('describes a schema for the lists', async () => {
    const schema = await createSchema(ecommerce, ecommerceSnapshot());
    at(T0 + HOUR);
    const saved = await saveVersion(schema.id, deleteTable(ecommerceSnapshot(), 'payments'));

    expect(schemaSummary(saved, T0 + 3 * HOUR)).toEqual({
      name: 'ecommerce',
      engine: 'PostgreSQL',
      tables: 4,
      relationships: 3,
      version: 'v2',
      updated: '2 hours ago',
      updatedShort: '2h',
    });
  });
});
