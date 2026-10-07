import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot, tableNamed } from '../core/fixtures/testing';
import { db } from '../db/db';
import { createSchema, listSchemas, listVersions } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, undo, useSchemaStore } from '../store/schema';
import { memoryAddress } from '../store/testing';
import { useUiStore } from '../store/ui';
import { startRouting } from './navigation';
import { deleteTable, newTable, requestDeleteTable, saveSchema } from './workspaceActions';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

// Each test starts with the ecommerce sample stored as v1 and open in the workspace.
beforeEach(async () => {
  await resetDatabase();
  await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
  await startRouting(memoryAddress());
  useUiStore.setState({ dialog: null, toast: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveSchema', () => {
  it('stores a changed schema as the next version and names it', async () => {
    schema().deleteTable('payments');
    await saveSchema();

    expect(selectDirty(schema())).toBe(false);
    expect(schema().version).toBe(2);
    expect(ui().toast).toMatchObject({ title: 'Saved as v2', description: 'ecommerce · 4 tables' });

    const versions = await listVersions(schema().id!);
    expect(versions.map((v) => [v.version, v.snapshot.tables.length])).toEqual([
      [2, 4],
      [1, 5],
    ]);
    expect(versions[0].snapshot).toEqual(schema().saved);
  });

  it('stays quiet when there is nothing to save', async () => {
    await saveSchema();
    expect(ui().toast).toBeNull();
    expect(schema().version).toBe(1);
    expect(await db.versions.count()).toBe(1);
  });

  it('reports validation errors instead of saving', async () => {
    const users = tableNamed(schema(), 'users');
    schema().updateTable('users', { ...users, columns: [...users.columns, { name: '', type: 'TEXT' }] });
    await saveSchema();
    expect(selectDirty(schema())).toBe(true);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Fix validation errors before saving' });
    expect(schema().selected).toBe('users');
    expect(await db.versions.count()).toBe(1);
  });

  it('stores one version when save is pressed twice in a row', async () => {
    schema().deleteTable('payments');
    await Promise.all([saveSchema(), saveSchema()]);
    expect(schema().version).toBe(2);
    expect(await db.versions.count()).toBe(2);
    expect(ui().toast?.title).toBe('Saved as v2');
  });

  it('says that the save failed and keeps the changes unsaved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    schema().deleteTable('payments');
    db.close();

    await saveSchema();

    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Save failed' });
    expect(schema().version).toBe(1);
    expect(schema().saving).toBe(false);
    expect(selectDirty(schema())).toBe(true);
    expect(names()).not.toContain('payments');
  });

  it('creates a schema that is not stored yet, as v1', async () => {
    schema().load({ name: 'blog', engine: 'MySQL', ...ecommerceSnapshot() });
    await saveSchema();

    expect(schema().version).toBe(1);
    expect(ui().toast).toMatchObject({ title: 'Saved as v1', description: 'blog · 5 tables' });
    expect((await listSchemas()).map((s) => s.name).sort()).toEqual(['blog', 'ecommerce']);
  });
});

describe('newTable', () => {
  it('adds a table where it was asked for, selected and ready to be renamed', () => {
    ui().setSearch('orders');
    const signal = ui().renameSignal;

    newTable({ x: 320, y: 400 });

    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments', 'new_table']);
    expect(schema().positions.new_table).toEqual({ x: 320, y: 400 });
    expect(schema().selected).toBe('new_table');
    expect(ui().renameSignal).toBe(signal + 1);
    expect(ui().search).toBe('');
    expect(selectDirty(schema())).toBe(true);
  });

  it('is stored with the next save', async () => {
    newTable({ x: 320, y: 400 });
    schema().renameTable('new_table', 'invoices');
    await saveSchema();

    const [v2] = await listVersions(schema().id!);
    expect(v2.snapshot.tables.map((t) => t.name)).toContain('invoices');
    expect(v2.snapshot.positions.invoices).toEqual({ x: 320, y: 400 });
    expect(ui().toast).toMatchObject({ title: 'Saved as v2', description: 'ecommerce · 6 tables' });
  });
});

describe('requestDeleteTable', () => {
  it('asks for confirmation and deletes nothing yet', () => {
    requestDeleteTable('orders');
    expect(ui().dialog).toEqual({ kind: 'delete-table', table: 'orders' });
    expect(names()).toContain('orders');
  });

  it('ignores a table that does not exist', () => {
    requestDeleteTable('invoices');
    expect(ui().dialog).toBeNull();
  });
});

describe('deleteTable', () => {
  it('deletes the table, closes the dialog and offers Undo', () => {
    requestDeleteTable('orders');
    deleteTable('orders');
    expect(names()).toEqual(['users', 'order_items', 'products', 'payments']);
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'Deleted table orders' });

    ui().toast?.actions?.[0].onClick?.();
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(tableNamed(schema(), 'payments').columns.find((c) => c.name === 'order_id')?.fk?.table).toBe('orders');
    expect(ui().toast).toBeNull();
  });

  it('withdraws the Undo offer once the schema changes again', () => {
    deleteTable('orders');
    schema().select('users');
    expect(ui().toast?.title).toBe('Deleted table orders');

    schema().duplicateTable('users');
    expect(ui().toast).toBeNull();
  });

  it('leaves a later toast alone when the delete is undone', async () => {
    deleteTable('payments');
    await saveSchema();
    expect(ui().toast?.title).toBe('Saved as v2');

    undo();
    expect(names()).toContain('payments');
    expect(ui().toast?.title).toBe('Saved as v2');
  });
});
