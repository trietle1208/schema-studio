import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSql } from '../core/fixtures/sql';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { nodeRects } from '../core/layout';
import type { Table } from '../core/model';
import { parserFor } from '../core/parse';
import { db, type SchemaRecord } from '../db/db';
import { createSchema, listSchemas, listVersions } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, useSchemaStore } from '../store/schema';
import { memoryAddress, type MemoryAddress } from '../store/testing';
import { useUiStore, type Dialog } from '../store/ui';
import { go, startRouting } from './navigation';
import { createNewSchema, deleteSchema, importSchema, requestDeleteSchema, requestImport, requestNewSchema } from './schemaActions';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

/** Waits until `done` holds: opening a schema reads the database after the action has returned. */
const until = (done: () => boolean) => vi.waitFor(() => expect(done()).toBe(true));

function confirmDiscard() {
  const dialog = ui().dialog as Extract<Dialog, { kind: 'discard-changes' }>;
  expect(dialog.kind).toBe('discard-changes');
  // What the dialog's confirm button does.
  ui().closeDialog();
  dialog.onDiscard();
}

let shop: SchemaRecord;
let blog: SchemaRecord;
let address: MemoryAddress;

// Two stored schemas, with ecommerce (saved last) open in the workspace.
beforeEach(async () => {
  await resetDatabase();
  blog = await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: ecommerceSnapshot().tables.slice(0, 2), positions: {} });
  shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
  useUiStore.setState({ dialog: null, toast: null, search: '', fitPending: false });
  address = memoryAddress();
  await startRouting(address);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestNewSchema', () => {
  it('opens the New Schema dialog', () => {
    requestNewSchema();
    expect(ui().dialog).toEqual({ kind: 'new-schema' });
  });

  it('asks about unsaved changes first', () => {
    schema().deleteTable('payments');
    requestNewSchema();
    expect(ui().dialog?.kind).toBe('discard-changes');

    confirmDiscard();
    expect(ui().dialog).toEqual({ kind: 'new-schema' });
    // Nothing is dropped until the new schema is created.
    expect(selectDirty(schema())).toBe(true);
  });
});

describe('createNewSchema', () => {
  it('stores a blank schema as v1 and opens it in the workspace', async () => {
    go({ screen: 'schemas' });
    requestNewSchema();
    expect(await createNewSchema({ name: 'crm', engine: 'SQLite', description: 'Leads and accounts' })).toBe(true);

    expect(ui().dialog).toBeNull();
    expect(ui().route).toEqual({ screen: 'workspace', schema: 'crm' });
    expect(address.read()).toBe('#/schemas/crm');
    expect(schema()).toMatchObject({ name: 'crm', engine: 'SQLite', version: 1, tables: [], positions: {} });
    expect(selectDirty(schema())).toBe(false);

    const stored = (await listSchemas()).find((s) => s.name === 'crm');
    expect(stored).toMatchObject({ id: schema().id, description: 'Leads and accounts', version: 1, tables: 0 });
    expect((await listVersions(stored!.id)).map((v) => [v.version, v.message])).toEqual([[1, 'New schema']]);
  });

  it('starts a schema with the ecommerce sample when asked to', async () => {
    expect(await createNewSchema({ name: 'shop_v2', engine: 'PostgreSQL', sample: true })).toBe(true);

    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    const stored = (await listSchemas()).find((s) => s.name === 'shop_v2');
    expect(stored).toMatchObject({ tables: 5, relationships: 4, version: 1 });
    expect((await listVersions(stored!.id))[0].snapshot).toEqual(ecommerceSnapshot());
  });

  it('adds the new schema to the history, so Back returns to where it was created from', async () => {
    go({ screen: 'schemas' });
    await createNewSchema({ name: 'crm', engine: 'SQLite' });
    expect(address.entries).toEqual(['#/schemas/ecommerce', '#/schemas', '#/schemas/crm']);

    address.back();
    expect(ui().route).toEqual({ screen: 'schemas' });
    expect(schema().name).toBe('crm');
  });

  it('saves the new schema under its own id afterwards', async () => {
    await createNewSchema({ name: 'shop_v2', engine: 'PostgreSQL', sample: true });
    schema().deleteTable('payments');
    await schema().save();

    expect(schema().version).toBe(2);
    expect((await listSchemas()).map((s) => [s.name, s.version])).toEqual([
      ['shop_v2', 2],
      ['ecommerce', 1],
      ['blog', 1],
    ]);
  });

  it('reports a name that is taken and leaves the dialog and the open schema as they were', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestNewSchema();
    expect(await createNewSchema({ name: 'blog', engine: 'PostgreSQL' })).toBe(false);

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not create schema', description: 'Schema "blog" already exists.' });
    expect(ui().dialog).toEqual({ kind: 'new-schema' });
    expect(schema().id).toBe(shop.id);
    expect(await db.schemas.count()).toBe(2);
  });
});

/** The tables the import dialog hands over: the ecommerce DDL, parsed. */
function parsedTables(): Table[] {
  const outcome = parserFor('PostgreSQL')?.parse(ecommerceSql);
  if (!outcome?.ok) throw new Error('The ecommerce DDL did not parse.');
  return outcome.tables;
}

describe('requestImport', () => {
  it('opens the Import Schema dialog', () => {
    requestImport();
    expect(ui().dialog).toEqual({ kind: 'import-schema' });
  });

  it('asks about unsaved changes first', () => {
    schema().deleteTable('payments');
    requestImport();
    expect(ui().dialog?.kind).toBe('discard-changes');

    confirmDiscard();
    expect(ui().dialog).toEqual({ kind: 'import-schema' });
    // Nothing is dropped until the schema is imported.
    expect(selectDirty(schema())).toBe(true);
  });
});

describe('importSchema', () => {
  it('stores the parsed tables as v1 of a new schema and opens it in the workspace', async () => {
    go({ screen: 'schemas' });
    requestImport();
    const tables = parsedTables();
    expect(await importSchema({ name: 'shop_prod', engine: 'PostgreSQL', tables, file: 'shop_prod.sql' })).toBe(true);

    expect(ui().dialog).toBeNull();
    expect(ui().route).toEqual({ screen: 'workspace', schema: 'shop_prod' });
    expect(address.read()).toBe('#/schemas/shop_prod');
    expect(schema()).toMatchObject({ name: 'shop_prod', engine: 'PostgreSQL', version: 1, tables });
    expect(selectDirty(schema())).toBe(false);
    expect(ui().toast).toMatchObject({ title: 'Imported shop_prod', description: '5 tables · 4 relationships · 11 indexes' });

    const stored = (await listSchemas()).find((s) => s.name === 'shop_prod');
    expect(stored).toMatchObject({ id: schema().id, version: 1, tables: 5, relationships: 4 });
    expect((await listVersions(stored!.id)).map((v) => [v.version, v.message])).toEqual([[1, 'Imported from shop_prod.sql']]);
  });

  it('lays the tables out in a grid and asks the canvas to fit them', async () => {
    const tables = parsedTables();
    await importSchema({ name: 'shop_prod', engine: 'PostgreSQL', tables });

    const rects = nodeRects(tables, schema().positions);
    expect(rects.map((r) => r.name)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
    // Three columns of nodes, the first row level.
    expect(rects.slice(0, 3).map((r) => [r.x, r.y])).toEqual([
      [24, 24],
      [304, 24],
      [584, 24],
    ]);
    expect(ui().fitPending).toBe(true);
    const stored = (await listSchemas()).find((s) => s.name === 'shop_prod');
    expect((await listVersions(stored!.id))[0].snapshot.positions).toEqual(schema().positions);
  });

  it('names pasted SQL as the source when there is no file', async () => {
    await importSchema({ name: 'pasted', engine: 'PostgreSQL', tables: parsedTables() });
    const stored = (await listSchemas()).find((s) => s.name === 'pasted');
    expect((await listVersions(stored!.id))[0].message).toBe('Imported from pasted SQL');
  });

  it('reports a name that is taken and leaves the dialog and the open schema as they were', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestImport();
    expect(await importSchema({ name: 'blog', engine: 'PostgreSQL', tables: parsedTables() })).toBe(false);

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not import schema', description: 'Schema "blog" already exists.' });
    expect(ui().dialog).toEqual({ kind: 'import-schema' });
    expect(ui().fitPending).toBe(false);
    expect(schema().id).toBe(shop.id);
    expect(await db.schemas.count()).toBe(2);
  });
});

describe('requestDeleteSchema', () => {
  it('asks for confirmation and deletes nothing yet', async () => {
    await schema().save();
    requestDeleteSchema(blog);
    expect(ui().dialog).toEqual({ kind: 'delete-schema', id: blog.id, name: 'blog', versions: 1 });
    expect(await db.schemas.count()).toBe(2);
  });
});

describe('deleteSchema', () => {
  it('removes another schema with its versions and leaves the open one alone', async () => {
    schema().deleteTable('payments');
    go({ screen: 'schemas' });
    requestDeleteSchema(blog);
    await deleteSchema(blog.id);

    expect(ui().dialog).toBeNull();
    expect((await listSchemas()).map((s) => s.name)).toEqual(['ecommerce']);
    expect(await listVersions(blog.id)).toEqual([]);
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'Deleted schema blog', description: '1 version removed from this browser.' });
    expect(schema().id).toBe(shop.id);
    expect(selectDirty(schema())).toBe(true);
  });

  it('closes the open schema when that is the one deleted, unsaved changes included', async () => {
    schema().deleteTable('payments');
    await schema().save();
    schema().deleteTable('orders');
    const [stored] = await listSchemas();
    requestDeleteSchema(stored);
    await deleteSchema(shop.id);

    expect(ui().toast).toMatchObject({ title: 'Deleted schema ecommerce', description: '2 versions removed from this browser.' });
    expect(ui().route).toEqual({ screen: 'schemas' });
    expect(address.read()).toBe('#/schemas');
    expect(schema().id).toBeNull();
    expect(schema().version).toBeNull();
    expect(selectDirty(schema())).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
    expect(await db.versions.count()).toBe(1);

    // Nothing stands in the way of opening or creating a schema afterwards.
    go({ screen: 'workspace', schema: 'blog' });
    await until(() => schema().id === blog.id);
    expect(ui().dialog).toBeNull();
  });

  it('starts on the schema list after the last schema is deleted', async () => {
    await deleteSchema(shop.id);
    await deleteSchema(blog.id);
    expect(await listSchemas()).toEqual([]);

    await startRouting(memoryAddress('#/schemas/ecommerce'));
    expect(ui().route).toEqual({ screen: 'schemas' });
  });

  it('says so when the schema cannot be removed, and keeps it open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestDeleteSchema(shop);
    db.close();
    await deleteSchema(shop.id);

    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not delete schema' });
    expect(schema().id).toBe(shop.id);
    expect(ui().route).toEqual({ screen: 'workspace', schema: 'ecommerce' });
  });
});
