import { beforeEach, describe, expect, it } from 'vitest';
import { ecommerceSnapshot, tableNamed } from '../core/fixtures/testing';
import { selectDirty, undo, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { deleteTable, requestDeleteTable, saveSchema } from './workspaceActions';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

beforeEach(() => {
  schema().load({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
  useUiStore.setState({ dialog: null, toast: null });
});

describe('saveSchema', () => {
  it('saves a changed schema and says so', () => {
    schema().deleteTable('payments');
    saveSchema();
    expect(selectDirty(schema())).toBe(false);
    expect(ui().toast).toMatchObject({ title: 'Saved', description: 'ecommerce · 4 tables' });
  });

  it('stays quiet when there is nothing to save', () => {
    saveSchema();
    expect(ui().toast).toBeNull();
  });

  it('reports validation errors instead of saving', () => {
    const users = tableNamed(schema(), 'users');
    schema().updateTable('users', { ...users, columns: [...users.columns, { name: '', type: 'TEXT' }] });
    saveSchema();
    expect(selectDirty(schema())).toBe(true);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Fix validation errors before saving' });
    expect(schema().selected).toBe('users');
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

  it('leaves a later toast alone when the delete is undone', () => {
    deleteTable('payments');
    saveSchema();
    expect(ui().toast?.title).toBe('Saved');

    undo();
    expect(names()).toContain('payments');
    expect(ui().toast?.title).toBe('Saved');
  });
});
