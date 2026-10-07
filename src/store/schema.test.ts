import { beforeEach, describe, expect, it } from 'vitest';
import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import { ecommerceSnapshot, tableNamed } from '../core/fixtures/testing';
import {
  createSchemaStore,
  selectDirty,
  selectDirtyTables,
  selectTable,
  useSchemaStore,
  type SchemaStore,
} from './schema';

let store: SchemaStore;
const state = () => store.getState();
const history = () => store.temporal.getState();
const names = () => state().tables.map((t) => t.name);

beforeEach(() => {
  store = createSchemaStore({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
});

describe('schema store', () => {
  it('starts the app on the ecommerce sample, saved and with nothing selected', () => {
    const s = useSchemaStore.getState();
    expect(s.name).toBe('ecommerce');
    expect(s.engine).toBe('PostgreSQL');
    expect(s.tables).toBe(ecommerceTables);
    expect(s.positions).toBe(ecommercePositions);
    expect(s.selected).toBeNull();
    expect(s.selectedColumn).toBeNull();
    expect(selectDirty(s)).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
  });

  it('selects a table and clears the column selection when the table changes', () => {
    state().select('orders');
    state().selectColumn(2);
    expect(selectTable(state())?.name).toBe('orders');
    expect(state().selectedColumn).toBe(2);

    state().select('orders');
    expect(state().selectedColumn).toBe(2);

    state().select('users');
    expect(state().selectedColumn).toBeNull();

    state().select(null);
    expect(selectTable(state())).toBeNull();
  });

  it('does not add undo steps for selection', () => {
    state().select('orders');
    state().selectColumn(1);
    state().select(null);
    expect(history().pastStates).toEqual([]);
    expect(selectDirty(state())).toBe(false);
  });

  it('edits a table, becomes dirty, and is clean again after undo', () => {
    const orders = tableNamed(state(), 'orders');
    state().updateTable('orders', { ...orders, comment: 'One row per checkout.' });

    expect(tableNamed(state(), 'orders').comment).toBe('One row per checkout.');
    expect(selectDirty(state())).toBe(true);
    expect(selectDirtyTables(state())).toEqual(['orders']);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(tableNamed(state(), 'orders')).toBe(orders);
    expect(selectDirty(state())).toBe(false);
    expect(history().futureStates).toHaveLength(1);

    history().redo();
    expect(tableNamed(state(), 'orders').comment).toBe('One row per checkout.');
    expect(selectDirty(state())).toBe(true);
  });

  it('undoes typing into one field in a single step', () => {
    const before = tableNamed(state(), 'orders');
    const type = (text: string, field: string) =>
      state().updateTable('orders', { ...tableNamed(state(), 'orders'), comment: text }, field);

    type('O', 'comment');
    type('On', 'comment');
    type('One', 'comment');
    expect(tableNamed(state(), 'orders').comment).toBe('One');
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(tableNamed(state(), 'orders')).toBe(before);
    expect(selectDirty(state())).toBe(false);

    history().redo();
    expect(tableNamed(state(), 'orders').comment).toBe('One');
  });

  it('starts a new undo step for another field, another table, a new selection or an edit in between', () => {
    const edit = (table: string, comment: string, field?: string) =>
      state().updateTable(table, { ...tableNamed(state(), table), comment }, field);

    edit('orders', 'a', 'comment');
    edit('orders', 'ab', 'columns.0.comment');
    expect(history().pastStates).toHaveLength(2);

    edit('users', 'c', 'columns.0.comment');
    expect(history().pastStates).toHaveLength(3);

    edit('users', 'cd', 'columns.0.comment');
    state().selectColumn(1);
    edit('users', 'cde', 'columns.0.comment');
    expect(history().pastStates).toHaveLength(4);

    state().moveTable('users', { x: 40, y: 48 });
    state().endMove();
    edit('users', 'cdef', 'columns.0.comment');
    expect(history().pastStates).toHaveLength(6);

    edit('users', 'x');
    edit('users', 'xy');
    expect(history().pastStates).toHaveLength(8);
  });

  it('does not merge typing into a step that was undone', () => {
    const type = (text: string) => state().updateTable('orders', { ...tableNamed(state(), 'orders'), comment: text }, 'comment');

    type('a');
    type('ab');
    history().undo();
    type('x');
    type('xy');

    expect(history().pastStates).toHaveLength(1);
    expect(history().futureStates).toEqual([]);
    history().undo();
    expect(tableNamed(state(), 'orders').comment).toBe('Customer orders. Totals are stored, not derived.');
  });

  it('keeps the selection on a renamed table, and undo restores the old name and selection', () => {
    state().select('orders');
    state().selectColumn(3);
    state().renameTable('orders', 'purchases');

    expect(state().selected).toBe('purchases');
    expect(state().selectedColumn).toBe(3);
    expect(tableNamed(state(), 'order_items').columns[1].fk?.table).toBe('purchases');
    expect(state().positions.purchases).toEqual({ x: 304, y: 24 });

    history().undo();
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(state().selected).toBe('orders');
    expect(state().selectedColumn).toBe(3);
    expect(selectTable(state())?.name).toBe('orders');

    history().redo();
    expect(state().selected).toBe('purchases');
  });

  it('ignores a rename to a name that is taken', () => {
    state().select('orders');
    state().renameTable('orders', 'users');
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(state().selected).toBe('orders');
    expect(history().pastStates).toEqual([]);
  });

  it('selects the copy after duplicating, and undo returns to the original', () => {
    state().select('products');
    state().selectColumn(1);
    state().duplicateTable('products');

    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments', 'products_copy']);
    expect(state().selected).toBe('products_copy');
    expect(state().selectedColumn).toBeNull();

    state().duplicateTable('products');
    expect(state().selected).toBe('products_copy2');

    history().undo();
    history().undo();
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(state().selected).toBe('products');
    expect(state().selectedColumn).toBe(1);
  });

  it('clears the selection when the selected table is deleted, and undo brings both back', () => {
    state().select('orders');
    state().deleteTable('orders');

    expect(names()).toEqual(['users', 'order_items', 'products', 'payments']);
    expect(state().selected).toBeNull();
    expect(tableNamed(state(), 'payments').columns[1].fk).toBeNull();
    expect(selectDirty(state())).toBe(true);

    history().undo();
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(state().selected).toBe('orders');
    expect(tableNamed(state(), 'payments').columns[1].fk?.table).toBe('orders');
    expect(selectDirty(state())).toBe(false);
  });

  it('keeps the selection when another table is deleted', () => {
    state().select('users');
    state().deleteTable('payments');
    expect(state().selected).toBe('users');
  });

  it('records a whole drag as one undo step', () => {
    state().moveTable('users', { x: 32, y: 48 });
    state().moveTable('users', { x: 64, y: 72 });
    state().moveTable('users', { x: 96, y: 120 });
    state().endMove();

    expect(state().positions.users).toEqual({ x: 96, y: 120 });
    expect(history().pastStates).toHaveLength(1);
    expect(selectDirtyTables(state())).toEqual(['users']);

    history().undo();
    expect(state().positions.users).toEqual({ x: 24, y: 48 });
    expect(selectDirty(state())).toBe(false);

    history().redo();
    expect(state().positions.users).toEqual({ x: 96, y: 120 });
  });

  it('records the next edit after a drag, and a drag that goes nowhere records nothing', () => {
    state().moveTable('users', { x: 24, y: 48 });
    state().endMove();
    expect(history().pastStates).toEqual([]);

    state().moveTable('users', { x: 40, y: 48 });
    state().endMove();
    state().moveTable('orders', { x: 320, y: 24 });
    state().endMove();
    state().deleteTable('payments');
    expect(history().pastStates).toHaveLength(3);
  });

  it('is clean after saving, and dirty again when the save is undone past', () => {
    state().renameTable('orders', 'purchases');
    expect(selectDirty(state())).toBe(true);

    state().markSaved();
    expect(selectDirty(state())).toBe(false);
    expect(selectDirtyTables(state())).toEqual([]);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(names()).toContain('orders');
    expect(selectDirty(state())).toBe(true);

    history().redo();
    expect(selectDirty(state())).toBe(false);
  });

  it('saves a valid schema and clears the draft mark without adding an undo step', () => {
    const orders = tableNamed(state(), 'orders');
    state().updateTable('orders', { ...orders, columns: [...orders.columns, { name: 'note', type: 'TEXT', nullable: true, draft: true }] });
    expect(history().pastStates).toHaveLength(1);

    expect(state().save()).toBe(true);

    expect(selectDirty(state())).toBe(false);
    expect(tableNamed(state(), 'orders').columns[5]).toEqual({ name: 'note', type: 'TEXT', nullable: true });
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(tableNamed(state(), 'orders')).toBe(orders);
    expect(selectDirty(state())).toBe(true);

    history().redo();
    expect(tableNamed(state(), 'orders').columns[5].draft).toBeUndefined();
    expect(selectDirty(state())).toBe(false);
  });

  it('does not save a schema with problems and selects the first one instead', () => {
    const payments = tableNamed(state(), 'payments');
    state().updateTable('payments', { ...payments, columns: [...payments.columns, { name: '', type: 'TEXT', nullable: true, draft: true }] });
    state().select('users');
    state().selectColumn(1);

    expect(state().save()).toBe(false);

    expect(selectDirty(state())).toBe(true);
    expect(state().selected).toBe('payments');
    expect(state().selectedColumn).toBe(5);
    expect(tableNamed(state(), 'payments').columns[5].draft).toBe(true);
    expect(history().pastStates).toHaveLength(1);
  });

  it('saving a clean schema changes nothing', () => {
    const before = state();
    expect(state().save()).toBe(true);
    expect(state().tables).toBe(before.tables);
    expect(state().saved).toBe(before.saved);
  });

  it('keeps at most 50 undo steps', () => {
    for (let i = 1; i <= 60; i++) {
      state().moveTable('users', { x: 24 + i * 8, y: 48 });
      state().endMove();
    }
    expect(history().pastStates).toHaveLength(50);
  });

  it('loads another schema as saved, with no selection and no history', () => {
    state().select('orders');
    state().deleteTable('users');
    const { tables, positions } = ecommerceSnapshot();

    state().load({ name: 'blog', engine: 'MySQL', tables: tables.slice(0, 2), positions });

    expect(state().name).toBe('blog');
    expect(state().engine).toBe('MySQL');
    expect(names()).toEqual(['users', 'orders']);
    expect(state().selected).toBeNull();
    expect(selectDirty(state())).toBe(false);
    expect(history().pastStates).toEqual([]);
    expect(history().futureStates).toEqual([]);
  });
});
