import { beforeEach, describe, expect, it } from 'vitest';
import { arrangeOnly, arrangeTables } from '../core/arrange';
import type { SchemaSnapshot } from '../core/model';
import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import { ecommerceSnapshot, inferredTables, tableNamed } from '../core/fixtures/testing';
import { assignGroup, recolorGroup, renameGroup } from '../core/groups';
import { countInferred, countRelations, removeInferred } from '../core/relations';
import {
  createSchemaStore,
  selectDirty,
  selectDirtyTables,
  selectFocused,
  selectTable,
  useSchemaStore,
  type Persist,
  type SchemaStore,
} from './schema';

const SCHEMA_ID = 7;

let store: SchemaStore;
/** The snapshots the store has asked to have stored, oldest first. */
let stored: SchemaSnapshot[];
/** Stands in for the database: a new schema gets `SCHEMA_ID`, and versions count up from 1. */
let persist: Persist;
const state = () => store.getState();
const history = () => store.temporal.getState();
const names = () => state().tables.map((t) => t.name);

beforeEach(() => {
  stored = [];
  persist = async (schema, snapshot) => {
    stored.push(snapshot);
    return { id: schema.id ?? SCHEMA_ID, version: stored.length };
  };
  store = createSchemaStore({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() }, (...args) =>
    persist(...args),
  );
});

/** A `persist` that waits until it is told how to end. */
function deferredPersist() {
  let resolve!: (stored: { id: number; version: number }) => void;
  let reject!: (error: Error) => void;
  persist = () =>
    new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  return { resolve: () => resolve({ id: SCHEMA_ID, version: 1 }), reject: () => reject(new Error('QuotaExceededError')) };
}

describe('schema store', () => {
  it('starts the app on the ecommerce sample, saved and with nothing selected', () => {
    const s = useSchemaStore.getState();
    expect(s.name).toBe('ecommerce');
    expect(s.engine).toBe('PostgreSQL');
    expect(s.tables).toBe(ecommerceTables);
    expect(s.positions).toBe(ecommercePositions);
    expect(s.selected).toBeNull();
    expect(s.selectedColumn).toBeNull();
    expect(s.id).toBeNull();
    expect(s.version).toBeNull();
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

  it('adds a new table, selected, as one undo step', () => {
    state().select('products');
    state().selectColumn(1);

    expect(state().addTable({ x: 320, y: 400 })).toBe('new_table');

    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments', 'new_table']);
    expect(state().positions.new_table).toEqual({ x: 320, y: 400 });
    expect(state().selected).toBe('new_table');
    expect(state().selectedColumn).toBeNull();
    expect(selectDirtyTables(state())).toEqual(['new_table']);
    expect(state().addTable({ x: 352, y: 432 })).toBe('new_table2');
    expect(history().pastStates).toHaveLength(2);

    history().undo();
    history().undo();
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(state().selected).toBe('products');
    expect(state().selectedColumn).toBe(1);
    expect(selectDirty(state())).toBe(false);
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

  it('records what the tables show of their columns as one undo step, whatever the number of tables', () => {
    expect(state().showColumns('keys')).toBe(true);
    expect(Object.values(state().positions).every((p) => p.cols === 'keys')).toBe(true);
    expect(history().pastStates).toHaveLength(1);
    expect(selectDirtyTables(state()).sort()).toEqual(['order_items', 'orders', 'payments', 'products', 'users']);

    // The same again changes nothing, and records nothing.
    expect(state().showColumns('keys')).toBe(false);
    expect(history().pastStates).toHaveLength(1);

    expect(state().showColumns('none', ['users'])).toBe(true);
    expect(state().positions.users.cols).toBe('none');
    expect(state().positions.orders.cols).toBe('keys');

    history().undo();
    history().undo();
    expect(state().positions.users).toEqual({ x: 24, y: 48 });
    expect(selectDirty(state())).toBe(false);
    history().redo();
    expect(state().positions.users.cols).toBe('keys');
  });

  it('records a whole drag of the side of a table as one undo step', () => {
    state().resizeTables({ users: { x: 24, y: 48, w: 240 } });
    state().resizeTables({ users: { x: 24, y: 48, w: 280 } });
    state().resizeTables({ users: { x: 24, y: 48, w: 300 } });
    state().endMove();

    expect(state().positions.users).toEqual({ x: 24, y: 48, w: 300 });
    expect(history().pastStates).toHaveLength(1);
    expect(selectDirtyTables(state())).toEqual(['users']);

    history().undo();
    expect(state().positions.users).toEqual({ x: 24, y: 48 });
    expect(selectDirty(state())).toBe(false);

    history().redo();
    expect(state().positions.users).toEqual({ x: 24, y: 48, w: 300 });

    // A side that is dragged and let go where it was records nothing more.
    state().resizeTables({ users: { x: 24, y: 48, w: 300 } });
    state().endMove();
    expect(history().pastStates).toHaveLength(1);
    state().deleteTable('payments');
    expect(history().pastStates).toHaveLength(2);
  });

  it('keeps the width of a table that is moved or arranged', () => {
    state().resizeTables({ orders: { x: 304, y: 24, w: 400 } });
    state().endMove();
    state().moveTable('orders', { x: 320, y: 40 });
    state().endMove();
    expect(state().positions.orders).toEqual({ x: 320, y: 40, w: 400 });

    expect(state().arrangeTables()).toBe(true);
    expect(state().positions).toEqual(arrangeTables(state().tables, { orders: { x: 0, y: 0, w: 400 } }));
    expect(state().positions.orders.w).toBe(400);
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

  it('is clean after saving, and dirty again when the save is undone past', async () => {
    state().renameTable('orders', 'purchases');
    expect(selectDirty(state())).toBe(true);

    await state().save();
    expect(selectDirty(state())).toBe(false);
    expect(selectDirtyTables(state())).toEqual([]);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(names()).toContain('orders');
    expect(selectDirty(state())).toBe(true);

    history().redo();
    expect(selectDirty(state())).toBe(false);
  });

  it('stores the working copy as a new version each time it is saved', async () => {
    state().deleteTable('payments');
    expect(await state().save()).toEqual({ status: 'saved', version: 1 });
    expect(state().id).toBe(SCHEMA_ID);
    expect(state().version).toBe(1);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toBe(state().saved);
    expect(stored[0].tables).toBe(state().tables);

    state().moveTable('users', { x: 40, y: 48 });
    state().endMove();
    expect(await state().save()).toEqual({ status: 'saved', version: 2 });
    expect(state().id).toBe(SCHEMA_ID);
    expect(state().version).toBe(2);
    expect(stored[1].positions.users).toEqual({ x: 40, y: 48 });
    expect(stored[0].positions.users).toEqual(ecommercePositions.users);
  });

  it('saves a valid schema and clears the draft mark without adding an undo step', async () => {
    const orders = tableNamed(state(), 'orders');
    state().updateTable('orders', { ...orders, columns: [...orders.columns, { name: 'note', type: 'TEXT', nullable: true, draft: true }] });
    expect(history().pastStates).toHaveLength(1);

    expect((await state().save()).status).toBe('saved');

    expect(selectDirty(state())).toBe(false);
    expect(tableNamed(state(), 'orders').columns[5]).toEqual({ name: 'note', type: 'TEXT', nullable: true });
    expect(tableNamed(stored[0], 'orders').columns[5]).toEqual({ name: 'note', type: 'TEXT', nullable: true });
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(tableNamed(state(), 'orders')).toBe(orders);
    expect(selectDirty(state())).toBe(true);

    history().redo();
    expect(tableNamed(state(), 'orders').columns[5].draft).toBeUndefined();
    expect(selectDirty(state())).toBe(false);
  });

  it('does not save a schema with problems and selects the first one instead', async () => {
    const payments = tableNamed(state(), 'payments');
    state().updateTable('payments', { ...payments, columns: [...payments.columns, { name: '', type: 'TEXT', nullable: true, draft: true }] });
    state().select('users');
    state().selectColumn(1);

    expect(await state().save()).toEqual({ status: 'invalid' });

    expect(stored).toEqual([]);
    expect(selectDirty(state())).toBe(true);
    expect(state().selected).toBe('payments');
    expect(state().selectedColumn).toBe(5);
    expect(tableNamed(state(), 'payments').columns[5].draft).toBe(true);
    expect(history().pastStates).toHaveLength(1);
  });

  it('saving a stored schema with no changes stores nothing', async () => {
    state().load({ id: SCHEMA_ID, version: 3, name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    const before = state();
    expect(await state().save()).toEqual({ status: 'unchanged' });
    expect(stored).toEqual([]);
    expect(state().tables).toBe(before.tables);
    expect(state().saved).toBe(before.saved);
    expect(state().version).toBe(3);
  });

  it('stores a schema that has never been saved even when nothing in it changed', async () => {
    expect(state().id).toBeNull();
    expect(await state().save()).toEqual({ status: 'saved', version: 1 });
    expect(stored).toHaveLength(1);
    expect(state().id).toBe(SCHEMA_ID);
  });

  it('saves a stored schema under its own id', async () => {
    const asked: (number | null)[] = [];
    persist = async (schema) => {
      asked.push(schema.id);
      return { id: schema.id ?? SCHEMA_ID, version: 4 };
    };
    state().load({ id: 12, version: 3, name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    state().deleteTable('payments');
    expect(await state().save()).toEqual({ status: 'saved', version: 4 });
    expect(asked).toEqual([12]);
    expect(state().id).toBe(12);
  });

  it('is saving until the version is written, and refuses a second save meanwhile', async () => {
    const writing = deferredPersist();
    state().deleteTable('payments');

    const save = state().save();
    expect(state().saving).toBe(true);
    expect(selectDirty(state())).toBe(true);
    expect(await state().save()).toEqual({ status: 'busy' });

    writing.resolve();
    expect((await save).status).toBe('saved');
    expect(state().saving).toBe(false);
    expect(selectDirty(state())).toBe(false);
  });

  it('keeps an edit made while the version was being written, as an unsaved change', async () => {
    const writing = deferredPersist();
    const orders = tableNamed(state(), 'orders');
    const users = tableNamed(state(), 'users');
    state().updateTable('orders', { ...orders, columns: [...orders.columns, { name: 'note', type: 'TEXT', nullable: true, draft: true }] });
    state().updateTable('users', { ...users, columns: [...users.columns, { name: 'phone', type: 'TEXT', nullable: true, draft: true }] });

    const save = state().save();
    state().updateTable('users', { ...tableNamed(state(), 'users'), comment: 'Edited during the save.' });
    writing.resolve();
    await save;

    expect(tableNamed(state().saved, 'users').comment).toBe(users.comment);
    expect(tableNamed(state(), 'users').comment).toBe('Edited during the save.');
    expect(selectDirtyTables(state())).toEqual(['users']);
    // The untouched table is the saved one, without its draft mark.
    expect(tableNamed(state(), 'orders')).toBe(tableNamed(state().saved, 'orders'));
    expect(tableNamed(state(), 'orders').columns[5].draft).toBeUndefined();
    expect(history().pastStates).toHaveLength(3);
  });

  it('leaves the working copy unsaved when the version cannot be written', async () => {
    const writing = deferredPersist();
    const orders = tableNamed(state(), 'orders');
    state().updateTable('orders', { ...orders, columns: [...orders.columns, { name: 'note', type: 'TEXT', nullable: true, draft: true }] });
    const before = state();

    const save = state().save();
    writing.reject();
    await expect(save).rejects.toThrow('QuotaExceededError');

    expect(state().saving).toBe(false);
    expect(state().tables).toBe(before.tables);
    expect(state().saved).toBe(before.saved);
    expect(state().id).toBeNull();
    expect(state().version).toBeNull();
    expect(selectDirty(state())).toBe(true);
  });

  it('does not touch a schema loaded while another was being saved', async () => {
    const writing = deferredPersist();
    state().deleteTable('payments');
    const save = state().save();

    const { tables, positions } = ecommerceSnapshot();
    state().load({ id: 12, version: 3, name: 'blog', engine: 'MySQL', tables: tables.slice(0, 2), positions });
    writing.resolve();
    expect(await save).toEqual({ status: 'saved', version: 1 });

    expect(state().name).toBe('blog');
    expect(state().id).toBe(12);
    expect(state().version).toBe(3);
    expect(names()).toEqual(['users', 'orders']);
    expect(state().saving).toBe(false);
    expect(selectDirty(state())).toBe(false);
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

    state().load({ id: 12, version: 3, name: 'blog', engine: 'MySQL', tables: tables.slice(0, 2), positions });

    expect(state().name).toBe('blog');
    expect(state().engine).toBe('MySQL');
    expect(state().id).toBe(12);
    expect(state().version).toBe(3);
    expect(names()).toEqual(['users', 'orders']);
    expect(state().selected).toBeNull();
    expect(selectDirty(state())).toBe(false);
    expect(history().pastStates).toEqual([]);
    expect(history().futureStates).toEqual([]);
  });
});

describe('a selection of several tables', () => {
  it('has no table for the inspector, and is of one table again once the others are taken out', () => {
    state().select('orders');
    state().selectColumn(2);
    state().selectTables(['orders', 'users']);
    expect(state().selection).toEqual(['orders', 'users']);
    expect(state().selected).toBeNull();
    expect(selectTable(state())).toBeNull();
    expect(state().selectedColumn).toBeNull();

    state().selectTables(['users']);
    expect(state().selected).toBe('users');
    expect(state().selection).toEqual(['users']);

    state().selectTables([]);
    expect(state().selected).toBeNull();
    expect(state().selection).toEqual([]);
  });

  it('follows the selection of one table, which ends it', () => {
    state().select('orders');
    expect(state().selection).toEqual(['orders']);

    state().selectTables(['orders', 'users', 'orders']);
    expect(state().selection).toEqual(['orders', 'users']);

    state().select('users');
    expect(state().selection).toEqual(['users']);
    state().selectTables(['orders', 'users']);
    state().select(null);
    expect(state().selection).toEqual([]);
  });

  it('is no edit, and is the same selection when it is made again', () => {
    state().selectTables(['orders', 'users']);
    const { selection } = state();
    state().selectTables(['orders', 'users']);
    expect(state().selection).toBe(selection);
    expect(history().pastStates).toEqual([]);
    expect(selectDirty(state())).toBe(false);
  });

  it('moves together in one undo step, which brings the tables and the selection back', () => {
    state().selectTables(['users', 'payments']);
    state().moveTables({ users: { x: 32, y: 56 }, payments: { x: 32, y: 344 } });
    state().moveTables({ users: { x: 104, y: 128 }, payments: { x: 104, y: 416 } });
    state().endMove();

    expect(state().positions).toEqual({ ...ecommercePositions, users: { x: 104, y: 128 }, payments: { x: 104, y: 416 } });
    expect(history().pastStates).toHaveLength(1);
    expect(selectDirtyTables(state())).toEqual(['users', 'payments']);

    state().select('orders');
    history().undo();
    expect(state().positions).toEqual(ecommercePositions);
    expect(state().selection).toEqual(['users', 'payments']);
    expect(state().selected).toBeNull();
  });

  it('follows a table through a rename, and loses a table that is deleted', () => {
    state().selectTables(['users', 'payments', 'orders']);
    state().renameTable('users', 'customers');
    expect(state().selection).toEqual(['customers', 'payments', 'orders']);

    state().deleteTable('payments');
    expect(state().selection).toEqual(['customers', 'orders']);
    expect(state().selected).toBeNull();

    state().deleteTable('orders');
    expect(state().selection).toEqual(['customers']);
    expect(state().selected).toBe('customers');

    history().undo();
    expect(state().selection).toEqual(['customers', 'orders']);
  });

  it('ends with an edit that selects its table', () => {
    state().selectTables(['users', 'payments']);
    state().addColumn('orders');
    expect(state().selection).toEqual(['orders']);

    state().selectTables(['users', 'payments']);
    state().duplicateTable('users');
    expect(state().selection).toEqual(['users_copy']);

    state().selectTables(['users', 'payments']);
    const name = state().addTable({ x: 0, y: 0 });
    expect(state().selection).toEqual([name]);
  });

  it('ends when another schema is loaded', () => {
    state().selectTables(['users', 'payments']);
    state().load({ name: 'shop', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    expect(state().selection).toEqual([]);
  });
});

describe('addColumn', () => {
  it('adds a blank column to the table and selects it, in one step that undo takes back', () => {
    state().select('users');
    state().addColumn('orders');

    const orders = tableNamed(state(), 'orders');
    expect(orders.columns).toHaveLength(6);
    expect(orders.columns[5]).toEqual({ name: '', type: 'TEXT', nullable: true, draft: true });
    expect(state().selected).toBe('orders');
    expect(state().selectedColumn).toBe(5);
    expect(selectDirtyTables(state())).toEqual(['orders']);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(state().tables).toEqual(ecommerceSnapshot().tables);
    expect(state().selected).toBe('users');
    expect(state().selectedColumn).toBeNull();
  });

  it('is a step of its own after typing into the table', () => {
    const users = tableNamed(state(), 'users');
    state().updateTable('users', { ...users, comment: 'a' }, 'comment');
    state().updateTable('users', { ...tableNamed(state(), 'users'), comment: 'ab' }, 'comment');
    state().addColumn('users');
    state().updateTable('users', { ...tableNamed(state(), 'users'), comment: 'abc' }, 'comment');
    expect(history().pastStates).toHaveLength(3);
  });

  it('does nothing for a table the schema does not have', () => {
    state().addColumn('invoices');
    expect(state().tables).toEqual(ecommerceSnapshot().tables);
    expect(history().pastStates).toEqual([]);
  });
});

describe('addForeignKey', () => {
  it('adds the foreign key on a new column and selects it, in one step that undo takes back', () => {
    expect(state().addForeignKey({ table: 'products', column: 'user_id' }, { table: 'users', column: 'id' }, 'SET NULL')).toBe(true);

    expect(tableNamed(state(), 'products').columns[4]).toEqual({
      name: 'user_id',
      type: 'BIGINT',
      nullable: true,
      fk: { table: 'users', column: 'id', onDelete: 'SET NULL' },
    });
    expect(countRelations(state().tables)).toBe(5);
    expect(state().selected).toBe('products');
    expect(state().selectedColumn).toBe(4);
    expect(selectDirtyTables(state())).toEqual(['products']);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(state().tables).toEqual(ecommerceSnapshot().tables);
    expect(state().selected).toBeNull();
  });

  it('adds it on a column the table has, which it selects', () => {
    expect(state().addForeignKey({ table: 'payments', column: 'amount' }, { table: 'products', column: 'id' })).toBe(true);
    expect(tableNamed(state(), 'payments').columns[3].fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
    expect(tableNamed(state(), 'payments').columns).toHaveLength(5);
    expect(state().selectedColumn).toBe(3);
  });

  it('says so and changes nothing when there is nothing to reference', () => {
    expect(state().addForeignKey({ table: 'products', column: 'user_id' }, { table: 'customers', column: 'id' })).toBe(false);
    expect(state().tables).toEqual(ecommerceSnapshot().tables);
    expect(state().selected).toBeNull();
    expect(history().pastStates).toEqual([]);
  });
});

describe('focus', () => {
  it('is on one table, is no edit, and ends with null', () => {
    state().focus('orders');
    expect(selectFocused(state())).toBe('orders');
    expect(selectDirty(state())).toBe(false);
    expect(history().pastStates).toEqual([]);

    state().focus(null);
    expect(selectFocused(state())).toBeNull();
  });

  it('follows the table through a rename', () => {
    state().focus('orders');
    state().renameTable('orders', 'purchases');
    expect(selectFocused(state())).toBe('purchases');
    state().renameTable('users', 'customers');
    expect(selectFocused(state())).toBe('purchases');
  });

  it('is none while its table is gone, and back when undo brings the table back', () => {
    state().focus('orders');
    state().deleteTable('orders');
    expect(selectFocused(state())).toBeNull();
    history().undo();
    expect(selectFocused(state())).toBe('orders');
  });

  it('ends when another schema is loaded', () => {
    state().focus('orders');
    state().load({ name: 'shop', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    expect(state().focused).toBeNull();
  });
});

describe('inferred relationships', () => {
  /** The sample as a database that declares no foreign keys has it. */
  const undeclared = () => removeInferred(inferredTables());

  it('are added in one step that undo takes back', () => {
    state().load({ name: 'shop', engine: 'PostgreSQL', tables: undeclared(), positions: ecommercePositions });
    expect(countRelations(state().tables)).toBe(0);

    expect(state().inferRelations()).toBe(4);
    expect(countInferred(state().tables)).toBe(4);
    expect(selectDirtyTables(state())).toEqual(['orders', 'order_items', 'payments']);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(countRelations(state().tables)).toBe(0);
    expect(selectDirty(state())).toBe(false);
  });

  it('are not added twice, and leave the declared ones alone', () => {
    expect(state().inferRelations()).toBe(0);
    expect(history().pastStates).toEqual([]);

    state().load({ name: 'shop', engine: 'PostgreSQL', tables: undeclared(), positions: ecommercePositions });
    state().inferRelations();
    expect(state().inferRelations()).toBe(0);
    expect(history().pastStates).toHaveLength(1);
  });

  it('are removed together, which undo takes back too', () => {
    const { tables } = ecommerceSnapshot();
    const mixed = [...tables.slice(0, 2), ...inferredTables().slice(2)];
    state().load({ name: 'shop', engine: 'PostgreSQL', tables: mixed, positions: ecommercePositions });

    expect(state().removeInferred()).toBe(3);
    expect(countRelations(state().tables)).toBe(1);
    expect(state().removeInferred()).toBe(0);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(countInferred(state().tables)).toBe(3);
  });

  it('are accepted or removed one at a time, each in a step of its own', () => {
    state().load({ name: 'shop', engine: 'PostgreSQL', tables: inferredTables(), positions: ecommercePositions });

    expect(state().acceptInferred({ table: 'orders', column: 'user_id' })).toBe(1);
    expect(tableNamed(state(), 'orders').columns[1].fk).toEqual({ table: 'users', column: 'id', onDelete: 'RESTRICT' });
    expect(state().removeInferred({ table: 'payments', column: 'order_id' })).toBe(1);
    expect(tableNamed(state(), 'payments').columns[1].fk).toBeNull();
    expect(countInferred(state().tables)).toBe(2);
    expect(countRelations(state().tables)).toBe(3);
    expect(selectDirtyTables(state())).toEqual(['orders', 'payments']);
    expect(history().pastStates).toHaveLength(2);

    // A relationship that is decided is not decided again.
    expect(state().acceptInferred({ table: 'orders', column: 'user_id' })).toBe(0);
    expect(state().removeInferred({ table: 'orders', column: 'user_id' })).toBe(0);
    expect(history().pastStates).toHaveLength(2);

    history().undo();
    expect(countInferred(state().tables)).toBe(3);
  });

  it('are all accepted in one step', () => {
    state().load({ name: 'shop', engine: 'PostgreSQL', tables: inferredTables(), positions: ecommercePositions });

    expect(state().acceptInferred()).toBe(4);
    expect(countInferred(state().tables)).toBe(0);
    expect(countRelations(state().tables)).toBe(4);
    expect(state().acceptInferred()).toBe(0);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(countInferred(state().tables)).toBe(4);
  });
});

describe('arrangeTables', () => {
  it('moves every table in one step that undo takes back', () => {
    const { tables, positions } = state();
    state().select('orders');

    expect(state().arrangeTables()).toBe(true);
    expect(state().positions).toEqual(arrangeTables(tables));
    expect(state().tables).toBe(tables);
    expect(state().selected).toBe('orders');
    expect(selectDirty(state())).toBe(true);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(state().positions).toEqual(positions);
    expect(selectDirty(state())).toBe(false);
  });

  it('changes nothing when the tables are where it would put them', () => {
    state().arrangeTables();
    const { positions } = state();

    expect(state().arrangeTables()).toBe(false);
    expect(state().positions).toBe(positions);
    expect(history().pastStates).toHaveLength(1);
  });

  it('moves only the tables it is given, among themselves, in one step that undo takes back', () => {
    const { tables, positions } = state();
    const only = ['orders', 'order_items', 'payments'];
    state().selectTables(only);

    expect(state().arrangeTables(only)).toBe(true);
    expect(state().positions).toEqual(arrangeOnly(tables, positions, only));
    expect(state().positions.users).toBe(positions.users);
    expect(state().positions.products).toBe(positions.products);
    expect(state().selection).toEqual(only);
    expect(history().pastStates).toHaveLength(1);

    expect(state().arrangeTables(only)).toBe(false);
    expect(history().pastStates).toHaveLength(1);

    history().undo();
    expect(state().positions).toEqual(positions);
  });

  it('places a table that has no position yet', () => {
    const { tables, positions } = ecommerceSnapshot();
    const placed = Object.fromEntries(Object.entries(positions).filter(([name]) => name !== 'payments'));
    state().load({ name: 'shop', engine: 'PostgreSQL', tables, positions: placed });

    expect(state().arrangeTables()).toBe(true);
    expect(Object.keys(state().positions)).toEqual(names());
  });
});

describe('groups of tables', () => {
  it('are edited in one undo step each, and make the schema dirty', () => {
    expect(state().groups).toEqual([]);
    expect(state().editGroups((groups) => assignGroup(groups, ['orders', 'order_items'], 'sales'))).toBe(true);
    expect(state().groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
    expect(selectDirty(state())).toBe(true);
    expect(selectDirtyTables(state())).toEqual(['orders', 'order_items']);
    expect(history().pastStates).toHaveLength(1);

    // An edit that changes nothing is no step.
    expect(state().editGroups((groups) => assignGroup(groups, ['orders'], 'sales'))).toBe(false);
    expect(state().editGroups((groups) => renameGroup(groups, 'sales', ' '))).toBe(false);
    expect(history().pastStates).toHaveLength(1);

    state().editGroups((groups) => recolorGroup(groups, 'sales', 'lime'));
    expect(history().pastStates).toHaveLength(2);
    history().undo();
    expect(state().groups[0].color).toBe('violet');
    history().undo();
    expect(state().groups).toEqual([]);
    expect(selectDirty(state())).toBe(false);
    history().redo();
    expect(state().groups.map((g) => g.name)).toEqual(['sales']);
  });

  it('follow the tables that are renamed, duplicated and deleted, and come back with an undo', () => {
    state().editGroups((groups) => assignGroup(groups, ['orders', 'order_items'], 'sales'));
    state().renameTable('orders', 'purchases');
    expect(state().groups[0].tables).toEqual(['purchases', 'order_items']);
    state().duplicateTable('order_items');
    expect(state().groups[0].tables).toEqual(['purchases', 'order_items', 'order_items_copy']);
    state().deleteTable('purchases');
    expect(state().groups[0].tables).toEqual(['order_items', 'order_items_copy']);
    history().undo();
    expect(state().groups[0].tables).toEqual(['purchases', 'order_items', 'order_items_copy']);
  });

  it('does not join the typing in a field with what was typed before the groups changed', () => {
    const orders = tableNamed(state(), 'orders');
    state().updateTable('orders', { ...orders, comment: 'One' }, 'comment');
    state().editGroups((groups) => assignGroup(groups, ['orders'], 'sales'));
    state().updateTable('orders', { ...tableNamed(state(), 'orders'), comment: 'One row' }, 'comment');
    expect(history().pastStates).toHaveLength(3);
  });

  it('are saved with the version and loaded with a schema', async () => {
    state().editGroups((groups) => assignGroup(groups, ['orders', 'order_items'], 'sales'));
    await state().save();
    expect(stored[0].groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
    expect(selectDirty(state())).toBe(false);
    expect(selectDirtyTables(state())).toEqual([]);

    state().load({ name: 'shop', engine: 'MySQL', ...stored[0] });
    expect(state().groups).toBe(stored[0].groups);
    expect(selectDirty(state())).toBe(false);
    // A version that was saved before there were groups has none.
    state().load({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    expect(state().groups).toEqual([]);
    expect(selectDirty(state())).toBe(false);
  });
});
