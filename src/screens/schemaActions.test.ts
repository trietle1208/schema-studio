import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { db, type SchemaRecord } from '../db/db';
import { createSchema, listSchemas, listVersions } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, useSchemaStore } from '../store/schema';
import { openLastSchema } from '../store/startup';
import { useUiStore, type Dialog } from '../store/ui';
import {
  createNewSchema,
  deleteSchema,
  openSchema,
  requestDeleteSchema,
  requestNewSchema,
  showSchemas,
} from './schemaActions';

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

// Two stored schemas, with ecommerce (saved last) open in the workspace.
beforeEach(async () => {
  await resetDatabase();
  blog = await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: ecommerceSnapshot().tables.slice(0, 2), positions: {} });
  shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
  useUiStore.setState({ screen: 'schemas', dialog: null, toast: null, search: '' });
  await openLastSchema();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('showSchemas', () => {
  it('shows the list and keeps the open schema with its unsaved changes', () => {
    schema().deleteTable('payments');
    showSchemas();
    expect(ui().screen).toBe('schemas');
    expect(schema().id).toBe(shop.id);
    expect(selectDirty(schema())).toBe(true);
  });
});

describe('openSchema', () => {
  it('opens the current version of another schema in the workspace', async () => {
    showSchemas();
    ui().setSearch('orders');
    openSchema(blog.id);
    await until(() => schema().id === blog.id);

    expect(schema()).toMatchObject({ name: 'blog', engine: 'MySQL', version: 1, selected: null });
    expect(names()).toEqual(['users', 'orders']);
    expect(selectDirty(schema())).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
    expect(ui().screen).toBe('workspace');
    expect(ui().search).toBe('');
  });

  it('goes back to the schema that is open without reading it again', () => {
    schema().deleteTable('payments');
    showSchemas();
    openSchema(shop.id);

    expect(ui().screen).toBe('workspace');
    expect(ui().dialog).toBeNull();
    expect(names()).not.toContain('payments');
    expect(selectDirty(schema())).toBe(true);
  });

  it('asks before dropping unsaved changes, and keeps them when the answer is no', async () => {
    schema().deleteTable('payments');
    showSchemas();
    openSchema(blog.id);

    expect(ui().dialog?.kind).toBe('discard-changes');
    ui().closeDialog();
    expect(schema().id).toBe(shop.id);
    expect(selectDirty(schema())).toBe(true);
    expect(ui().screen).toBe('schemas');
  });

  it('opens the other schema once the changes are given up; the saved version is untouched', async () => {
    schema().deleteTable('payments');
    openSchema(blog.id);
    confirmDiscard();
    await until(() => schema().id === blog.id);

    expect(ui().dialog).toBeNull();
    expect(names()).toEqual(['users', 'orders']);

    openSchema(shop.id);
    await until(() => schema().id === shop.id);
    expect(names()).toContain('payments');
    expect(schema().version).toBe(1);
  });

  it('says so when the schema cannot be read, and leaves the open one alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    showSchemas();
    openSchema(99);
    await until(() => ui().toast !== null);

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open schema' });
    expect(schema().id).toBe(shop.id);
    expect(ui().screen).toBe('schemas');
  });
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
    showSchemas();
    requestNewSchema();
    expect(await createNewSchema({ name: 'crm', engine: 'SQLite', description: 'Leads and accounts' })).toBe(true);

    expect(ui().dialog).toBeNull();
    expect(ui().screen).toBe('workspace');
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
    showSchemas();
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
    expect(ui().screen).toBe('schemas');
    expect(schema().id).toBeNull();
    expect(schema().version).toBeNull();
    expect(selectDirty(schema())).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
    expect(await db.versions.count()).toBe(1);

    // Nothing stands in the way of opening or creating a schema afterwards.
    openSchema(blog.id);
    await until(() => schema().id === blog.id);
    expect(ui().dialog).toBeNull();
  });

  it('starts on the schema list after the last schema is deleted', async () => {
    await deleteSchema(shop.id);
    await deleteSchema(blog.id);
    expect(await listSchemas()).toEqual([]);

    useUiStore.setState({ screen: 'workspace' });
    await openLastSchema();
    expect(ui().screen).toBe('schemas');
  });

  it('says so when the schema cannot be removed, and keeps it open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestDeleteSchema(shop);
    db.close();
    await deleteSchema(shop.id);

    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not delete schema' });
    expect(schema().id).toBe(shop.id);
    expect(ui().screen).toBe('workspace');
  });
});
