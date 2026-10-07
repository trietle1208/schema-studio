import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import type { Route } from '../core/routes';
import { db, type SchemaRecord } from '../db/db';
import { createSchema, saveVersion } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { ecommerceSample, selectDirty, useSchemaStore } from '../store/schema';
import { memoryAddress, type MemoryAddress } from '../store/testing';
import { useUiStore, type Dialog } from '../store/ui';
import { go, startRouting } from './navigation';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

/** Waits until `route` is on screen: a schema is read from the database after the navigation has returned. */
const shown = (route: Route) => vi.waitFor(() => expect(ui().route).toEqual(route));
/** Lets the reads that are under way finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

function confirmDiscard() {
  const dialog = ui().dialog as Extract<Dialog, { kind: 'discard-changes' }>;
  expect(dialog?.kind).toBe('discard-changes');
  // What the dialog's confirm button does.
  ui().closeDialog();
  dialog.onDiscard();
}

const LIST: Route = { screen: 'schemas' };
const SHOP: Route = { screen: 'workspace', schema: 'ecommerce' };
const BLOG: Route = { screen: 'workspace', schema: 'blog' };

let shop: SchemaRecord;
let blog: SchemaRecord;
let address: MemoryAddress;

/** Stores blog (two tables) and then ecommerce, which is therefore the schema saved last. */
async function storeTwoSchemas() {
  blog = await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: ecommerceSnapshot().tables.slice(0, 2), positions: {} });
  shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
}

async function start(at = '') {
  address = memoryAddress(at);
  await startRouting(address);
}

beforeEach(async () => {
  await resetDatabase();
  schema().load(ecommerceSample);
  useUiStore.setState({ route: LIST, dialog: null, toast: null, search: '' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startRouting', () => {
  it('starts on the schema list while nothing is stored, and stores nothing', async () => {
    await start();

    expect(ui().route).toEqual(LIST);
    expect(address.entries).toEqual(['#/schemas']);
    expect(ui().toast).toBeNull();
    expect(schema().id).toBeNull();
    expect(await db.schemas.count()).toBe(0);
  });

  it('opens the schema saved last when the address names no route', async () => {
    await storeTwoSchemas();
    await saveVersion(blog.id, { tables: [], positions: {} });
    await start();

    expect(ui().route).toEqual(BLOG);
    expect(address.entries).toEqual(['#/schemas/blog']);
    expect(schema()).toMatchObject({ id: blog.id, name: 'blog', version: 2, tables: [] });
  });

  it('opens the schema the address names, as after a reload', async () => {
    await storeTwoSchemas();
    await start('#/schemas/blog');

    expect(ui().route).toEqual(BLOG);
    expect(schema()).toMatchObject({ id: blog.id, name: 'blog', version: 1 });
    expect(names()).toEqual(['users', 'orders']);
    expect(selectDirty(schema())).toBe(false);
    expect(address.entries).toEqual(['#/schemas/blog']);
  });

  it.each<[string, Route]>([
    ['#/schemas', LIST],
    ['#/schemas/blog/history', { screen: 'history', schema: 'blog' }],
    ['#/schemas/blog/diff/v1/v2', { screen: 'diff', schema: 'blog', from: 1, to: 2 }],
  ])('starts on %s', async (at, route) => {
    await storeTwoSchemas();
    await start(at);

    expect(ui().route).toEqual(route);
    expect(address.entries).toEqual([at]);
    expect(schema().id).toBe(route.screen === 'schemas' ? null : blog.id);
  });

  it('puts an address that is no route right', async () => {
    await storeTwoSchemas();
    await start('#/tables/users');

    expect(ui().route).toEqual(SHOP);
    expect(address.entries).toEqual(['#/schemas/ecommerce']);
    expect(ui().toast).toBeNull();
  });

  it('says so when the address names a schema that is not stored, and opens the one saved last', async () => {
    await storeTwoSchemas();
    await start('#/schemas/inventory/history');

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Schema not found', description: 'No schema is called "inventory".' });
    expect(ui().route).toEqual(SHOP);
    expect(address.entries).toEqual(['#/schemas/ecommerce']);
  });

  it('starts on the list and says so when the database cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();
    await start('#/schemas/ecommerce');

    expect(ui().route).toEqual(LIST);
    expect(address.entries).toEqual(['#/schemas']);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open saved schemas' });
    expect(schema().id).toBeNull();
  });
});

describe('go', () => {
  beforeEach(async () => {
    await storeTwoSchemas();
    await start();
  });

  it('shows the list and keeps the open schema with its unsaved changes', () => {
    schema().deleteTable('payments');
    go(LIST);

    expect(ui().route).toEqual(LIST);
    expect(ui().dialog).toBeNull();
    expect(address.entries).toEqual(['#/schemas/ecommerce', '#/schemas']);
    expect(schema().id).toBe(shop.id);
    expect(selectDirty(schema())).toBe(true);
  });

  it('opens the current version of another schema in the workspace', async () => {
    go(LIST);
    ui().setSearch('orders');
    go(BLOG);
    await shown(BLOG);

    expect(schema()).toMatchObject({ id: blog.id, name: 'blog', engine: 'MySQL', version: 1, selected: null });
    expect(names()).toEqual(['users', 'orders']);
    expect(selectDirty(schema())).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
    expect(ui().search).toBe('');
    expect(address.entries).toEqual(['#/schemas/ecommerce', '#/schemas', '#/schemas/blog']);
  });

  it('goes back to the schema that is open without reading it again', () => {
    schema().deleteTable('payments');
    go(LIST);
    go(SHOP);

    expect(ui().route).toEqual(SHOP);
    expect(ui().dialog).toBeNull();
    expect(names()).not.toContain('payments');
    expect(selectDirty(schema())).toBe(true);
  });

  it('moves between the screens of the open schema without touching its unsaved changes', () => {
    schema().deleteTable('payments');
    go({ screen: 'history', schema: 'ecommerce' });
    expect(ui().route).toEqual({ screen: 'history', schema: 'ecommerce' });
    go({ screen: 'diff', schema: 'ecommerce', from: 1, to: 2 });
    expect(ui().route).toEqual({ screen: 'diff', schema: 'ecommerce', from: 1, to: 2 });
    go(SHOP);

    expect(ui().dialog).toBeNull();
    expect(selectDirty(schema())).toBe(true);
    expect(address.entries).toEqual([
      '#/schemas/ecommerce',
      '#/schemas/ecommerce/history',
      '#/schemas/ecommerce/diff/v1/v2',
      '#/schemas/ecommerce',
    ]);
  });

  it('does not add a history entry for the route that is already on screen', () => {
    go(SHOP);
    go(SHOP);
    expect(address.entries).toEqual(['#/schemas/ecommerce']);
  });

  it('asks before dropping unsaved changes, and keeps them when the answer is no', async () => {
    schema().deleteTable('payments');
    go(LIST);
    go({ screen: 'history', schema: 'blog' });

    expect(ui().dialog?.kind).toBe('discard-changes');
    ui().closeDialog();
    await settled();
    expect(schema().id).toBe(shop.id);
    expect(selectDirty(schema())).toBe(true);
    expect(ui().route).toEqual(LIST);
    expect(address.read()).toBe('#/schemas');
  });

  it('opens the other schema once the changes are given up; the saved version is untouched', async () => {
    schema().deleteTable('payments');
    go(BLOG);
    expect(ui().route).toEqual(SHOP);
    confirmDiscard();
    await shown(BLOG);

    expect(ui().dialog).toBeNull();
    expect(names()).toEqual(['users', 'orders']);

    go(SHOP);
    await shown(SHOP);
    expect(names()).toContain('payments');
    expect(schema().version).toBe(1);
  });

  it('says so when the schema is not stored, and stays where it was', async () => {
    go(LIST);
    go({ screen: 'workspace', schema: 'inventory' });
    await vi.waitFor(() => expect(ui().toast).not.toBeNull());

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Schema not found' });
    expect(ui().route).toEqual(LIST);
    expect(address.entries).toEqual(['#/schemas/ecommerce', '#/schemas']);
    expect(schema().id).toBe(shop.id);
  });

  it('says so when the schema cannot be read, and stays where it was', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();
    go(BLOG);
    await vi.waitFor(() => expect(ui().toast).not.toBeNull());

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open schema' });
    expect(ui().route).toEqual(SHOP);
    expect(schema().id).toBe(shop.id);
  });

  it('ends on the last of two schemas asked for in a row', async () => {
    go(LIST);
    go(BLOG);
    go(LIST);
    await settled();
    expect(ui().route).toEqual(LIST);
    expect(schema().id).toBe(shop.id);

    go(BLOG);
    go(SHOP);
    await settled();
    expect(ui().route).toEqual(SHOP);
    expect(schema().id).toBe(shop.id);
  });
});

describe('a change of the address', () => {
  beforeEach(async () => {
    await storeTwoSchemas();
    await start();
  });

  it('follows Back and Forward', async () => {
    go(LIST);
    go(BLOG);
    await shown(BLOG);

    address.back();
    expect(ui().route).toEqual(LIST);
    address.back();
    await shown(SHOP);
    expect(schema().id).toBe(shop.id);

    address.forward();
    expect(ui().route).toEqual(LIST);
    address.forward();
    await shown(BLOG);
    expect(schema().id).toBe(blog.id);
    expect(address.entries).toEqual(['#/schemas/ecommerce', '#/schemas', '#/schemas/blog']);
  });

  it('shows an address that was typed in', async () => {
    address.visit('/schemas/blog/diff/v1/v2');
    await shown({ screen: 'diff', schema: 'blog', from: 1, to: 2 });
    expect(schema().id).toBe(blog.id);
    expect(address.read()).toBe('#/schemas/blog/diff/v1/v2');
  });

  it('closes the dialog of the screen that is left', () => {
    ui().openDialog({ kind: 'delete-table', table: 'orders' });
    address.visit('/schemas');
    expect(ui().dialog).toBeNull();
    expect(ui().route).toEqual(LIST);
  });

  it('asks before unsaved changes are dropped, with the address back on the open schema meanwhile', async () => {
    go(LIST);
    go(BLOG);
    await shown(BLOG);
    schema().deleteTable('orders');

    address.back();
    address.back();
    expect(ui().dialog?.kind).toBe('discard-changes');
    expect(ui().route).toEqual(LIST);
    expect(address.read()).toBe('#/schemas');

    ui().closeDialog();
    await settled();
    expect(schema().id).toBe(blog.id);
    expect(selectDirty(schema())).toBe(true);

    address.visit('/schemas/ecommerce');
    expect(address.read()).toBe('#/schemas');
    confirmDiscard();
    await shown(SHOP);
    expect(schema().id).toBe(shop.id);
    expect(address.read()).toBe('#/schemas/ecommerce');
  });

  it('puts back an address that is no route, and leaves the screen alone', () => {
    address.visit('/settings');
    expect(ui().route).toEqual(SHOP);
    expect(address.read()).toBe('#/schemas/ecommerce');
    expect(ui().toast).toBeNull();
  });

  it('puts back an address that names a schema that is not stored, and says so', async () => {
    address.visit('/schemas/inventory');
    await vi.waitFor(() => expect(ui().toast).not.toBeNull());
    await settled();

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Schema not found' });
    expect(ui().route).toEqual(SHOP);
    expect(address.read()).toBe('#/schemas/ecommerce');
  });

  it('is no longer followed by an earlier start', async () => {
    const first = address;
    await start('#/schemas');
    first.visit('/schemas/blog');
    await settled();
    expect(ui().route).toEqual(LIST);
  });
});
