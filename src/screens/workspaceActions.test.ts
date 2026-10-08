import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot, inferredTables, tableNamed } from '../core/fixtures/testing';
import { convertTables } from '../core/generate/convert';
import type { Table } from '../core/model';
import { countInferred, countRelations, removeInferred } from '../core/relations';
import { db } from '../db/db';
import { createSchema, listSchemas, listVersions } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, selectFocused, undo, useSchemaStore } from '../store/schema';
import { memoryAddress } from '../store/testing';
import { useUiStore } from '../store/ui';
import { startRouting } from './navigation';
import {
  arrangeTables,
  copyCreateTable,
  deleteTable,
  drawForeignKey,
  focusRelatedTables,
  groupTables,
  groupTablesAsNew,
  inferRelationships,
  newTable,
  removeInferredRelationships,
  requestAddForeignKey,
  requestDeleteTable,
  requestReviewInferred,
  requestTableGroups,
  saveSchema,
  searchFor,
  showAllTables,
} from './workspaceActions';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

// Each test starts with the ecommerce sample stored as v1 and open in the workspace.
beforeEach(async () => {
  await resetDatabase();
  await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
  await startRouting(memoryAddress());
  useUiStore.setState({ dialog: null, toast: null, fitPending: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it('ends a focus, which would hide the new table', () => {
    focusRelatedTables('users');
    newTable({ x: 320, y: 400 });
    expect(selectFocused(schema())).toBeNull();
    expect(schema().selected).toBe('new_table');
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

describe('requestAddForeignKey', () => {
  it('opens the dialog for the table and adds nothing yet', () => {
    requestAddForeignKey('products');
    expect(ui().dialog).toEqual({ kind: 'add-foreign-key', table: 'products' });
    expect(selectDirty(schema())).toBe(false);
  });

  it('says so instead when no other table has a primary key to reference', () => {
    const { positions } = ecommerceSnapshot();
    const tables = ecommerceSnapshot().tables.map((t) => (t.name === 'users' ? t : { ...t, columns: t.columns.map((c) => ({ ...c, pk: false })) }));
    schema().load({ name: 'ecommerce', engine: 'PostgreSQL', tables, positions });

    requestAddForeignKey('users');
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'No table to reference' });

    // users itself has one, which the other tables can reference.
    requestAddForeignKey('orders');
    expect(ui().dialog).toEqual({ kind: 'add-foreign-key', table: 'orders' });
  });

  it('ignores a table that does not exist', () => {
    requestAddForeignKey('invoices');
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toBeNull();
  });
});

describe('drawForeignKey', () => {
  it('declares the foreign key on the column, selects it and names it, in one step that undo takes back', () => {
    drawForeignKey({ table: 'payments', column: 'provider' }, { table: 'products', column: 'sku' });

    expect(tableNamed(schema(), 'payments').columns[2]).toEqual({
      name: 'provider',
      type: 'VARCHAR(32)',
      nullable: false,
      fk: { table: 'products', column: 'sku', onDelete: 'RESTRICT' },
    });
    expect(countRelations(schema().tables)).toBe(5);
    expect([schema().selected, schema().selectedColumn]).toEqual(['payments', 2]);
    expect(ui().toast).toMatchObject({
      title: 'Added foreign key',
      description: 'payments.provider → products.sku. Press ⌘Z to undo.',
    });

    undo();
    expect(schema().tables).toEqual(ecommerceSnapshot().tables);
  });

  it('points a column that referenced another column at this one, with the action it had', () => {
    drawForeignKey({ table: 'orders', column: 'user_id' }, { table: 'products', column: 'id' });

    expect(tableNamed(schema(), 'orders').columns[1].fk).toEqual({ table: 'products', column: 'id', onDelete: 'CASCADE' });
    expect(countRelations(schema().tables)).toBe(4);
    expect(ui().toast).toMatchObject({
      title: 'Changed foreign key',
      description: 'orders.user_id → products.id, in place of users.id. Press ⌘Z to undo.',
    });
  });

  it('declares a foreign key that was inferred', () => {
    schema().load({ name: 'ecommerce', engine: 'PostgreSQL', tables: inferredTables(), positions: ecommerceSnapshot().positions });

    drawForeignKey({ table: 'orders', column: 'user_id' }, { table: 'users', column: 'id' });
    expect(tableNamed(schema(), 'orders').columns[1].fk).toEqual({ table: 'users', column: 'id', onDelete: 'RESTRICT' });
    expect(countInferred(schema().tables)).toBe(3);
    expect(ui().toast).toMatchObject({ title: 'Added foreign key' });
  });

  it('draws nothing that cannot be a foreign key', () => {
    // To a column that is no key, within one table, and the foreign key the column has.
    drawForeignKey({ table: 'orders', column: 'status' }, { table: 'users', column: 'name' });
    drawForeignKey({ table: 'users', column: 'name' }, { table: 'users', column: 'id' });
    drawForeignKey({ table: 'orders', column: 'user_id' }, { table: 'users', column: 'id' });
    drawForeignKey({ table: 'orders', column: 'buyer_id' }, { table: 'users', column: 'id' });

    expect(selectDirty(schema())).toBe(false);
    expect(schema().selected).toBeNull();
    expect(ui().toast).toBeNull();
  });
});

describe('copyCreateTable', () => {
  it('puts the statements that make the table on the clipboard and says how long they are', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyCreateTable('payments');

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(`CREATE TABLE payments (
  id        BIGSERIAL PRIMARY KEY,
  order_id  BIGINT NOT NULL,
  provider  VARCHAR(32) NOT NULL,
  amount    DECIMAL(12,2) NOT NULL,
  paid_at   TIMESTAMPTZ
);

ALTER TABLE payments
  ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders (id)
  ON DELETE RESTRICT;
`);
    expect(ui().toast).toMatchObject({ title: 'Copied CREATE TABLE', description: 'payments · PostgreSQL · 12 lines' });
    expect(selectDirty(schema())).toBe(false);
  });

  it('copies the table as it is in the workspace, unsaved changes included', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    schema().addForeignKey({ table: 'products', column: 'user_id' }, { table: 'users', column: 'id' }, 'SET NULL');
    await copyCreateTable('products');

    const text: string = writeText.mock.calls[0][0];
    expect(text).toContain('  user_id  BIGINT\n');
    expect(text).toContain('FOREIGN KEY (user_id) REFERENCES users (id)\n  ON DELETE SET NULL;');
  });

  it('says that a column with a validation error was copied as it is', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    schema().addColumn('users');
    await copyCreateTable('users');
    expect(ui().toast).toMatchObject({
      tone: 'info',
      title: 'Copied CREATE TABLE',
      description: 'users · PostgreSQL · 15 lines · 1 column with validation errors',
    });
  });

  it('writes the types of the database the schema is for', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const tables = convertTables(ecommerceSnapshot().tables, 'PostgreSQL', 'MySQL') as Table[];
    schema().load({ name: 'shop', engine: 'MySQL', tables, positions: ecommerceSnapshot().positions });
    await copyCreateTable('users');

    expect(writeText.mock.calls[0][0]).toContain('CREATE TABLE `users` (\n  `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,');
    expect(ui().toast?.description).toMatch(/^users · MySQL · \d+ lines$/);
  });

  it('says so when the browser keeps the clipboard to itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await copyCreateTable('users');
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not copy' });
  });

  it('ignores a table that does not exist', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyCreateTable('invoices');
    expect(writeText).not.toHaveBeenCalled();
    expect(ui().toast).toBeNull();
  });
});

describe('focusRelatedTables', () => {
  it('focuses the canvas on the table, selects it and asks for the related tables to be fitted', () => {
    ui().setSearch('pay');
    focusRelatedTables('orders');

    expect(selectFocused(schema())).toBe('orders');
    expect(schema().selected).toBe('orders');
    expect(ui().fitPending).toBe(true);
    // The search would hide users and order_items.
    expect(ui().search).toBe('');
    expect(ui().toast).toBeNull();
    // Looking at part of the schema is no edit.
    expect(selectDirty(schema())).toBe(false);
  });

  it('moves from one table to another', () => {
    focusRelatedTables('orders');
    focusRelatedTables('products');
    expect(selectFocused(schema())).toBe('products');
    expect(schema().selected).toBe('products');
  });

  it('says so and shows every table when the table is related to none', () => {
    newTable({ x: 0, y: 0 });
    useUiStore.setState({ fitPending: false });
    focusRelatedTables('new_table');

    expect(selectFocused(schema())).toBeNull();
    expect(ui().fitPending).toBe(false);
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'No related tables', description: 'new_table has no relationship with another table.' });
  });

  it('ignores a table that does not exist', () => {
    focusRelatedTables('invoices');
    expect(selectFocused(schema())).toBeNull();
    expect(ui().toast).toBeNull();
  });
});

describe('showAllTables', () => {
  it('ends the focus and leaves the selection alone', () => {
    focusRelatedTables('orders');
    showAllTables();
    expect(selectFocused(schema())).toBeNull();
    expect(schema().selected).toBe('orders');
  });
});

describe('searchFor', () => {
  it('looks through every table, so it ends a focus', () => {
    focusRelatedTables('orders');
    searchFor('prod');
    expect(ui().search).toBe('prod');
    expect(selectFocused(schema())).toBeNull();
  });

  it('keeps the focus when the search box is only cleared', () => {
    focusRelatedTables('orders');
    searchFor('');
    expect(selectFocused(schema())).toBe('orders');
  });
});

describe('inferRelationships', () => {
  it('adds the relationships the column names point to and says how many', () => {
    const { positions } = ecommerceSnapshot();
    schema().load({ name: 'shop', engine: 'PostgreSQL', tables: removeInferred(inferredTables()), positions });

    inferRelationships();
    expect(countInferred(schema().tables)).toBe(4);
    expect(ui().toast).toMatchObject({
      title: 'Inferred 4 relationships',
      description: 'Drawn dashed and left out of exported SQL. Press ⌘Z to undo.',
    });

    undo();
    expect(countRelations(schema().tables)).toBe(0);
  });

  it('says so when there is nothing to infer, and changes nothing', () => {
    const { tables } = schema();
    inferRelationships();
    expect(schema().tables).toBe(tables);
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'No relationships to infer' });
  });
});

describe('requestReviewInferred', () => {
  it('opens the review, in place of the toast that offered it', () => {
    const { positions } = ecommerceSnapshot();
    schema().load({ name: 'shop', engine: 'PostgreSQL', tables: removeInferred(inferredTables()), positions });
    inferRelationships();
    expect(ui().toast?.actions?.map((a) => a.label)).toEqual(['Review']);

    ui().toast?.actions?.[0].onClick?.();
    expect(ui().dialog).toEqual({ kind: 'review-inferred' });
    expect(ui().toast).toBeNull();
  });

  it('has nothing to open in a schema without inferred relationships', () => {
    requestReviewInferred();
    expect(ui().dialog).toBeNull();
  });
});

describe('removeInferredRelationships', () => {
  it('removes them and offers ⌘Z', () => {
    const { positions } = ecommerceSnapshot();
    schema().load({ name: 'shop', engine: 'PostgreSQL', tables: inferredTables(), positions });

    removeInferredRelationships();
    expect(countRelations(schema().tables)).toBe(0);
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'Removed 4 inferred relationships' });

    undo();
    expect(countInferred(schema().tables)).toBe(4);
  });

  it('does nothing in a schema without any', () => {
    removeInferredRelationships();
    expect(ui().toast).toBeNull();
    expect(selectDirty(schema())).toBe(false);
  });
});

describe('arrangeTables', () => {
  it('moves the tables, asks the canvas to fit them and offers ⌘Z', () => {
    const { positions } = schema();
    arrangeTables();

    expect(schema().positions).not.toEqual(positions);
    expect(ui().fitPending).toBe(true);
    expect(ui().toast).toMatchObject({
      title: 'Arranged 5 tables',
      description: 'Related tables are next to each other. Press ⌘Z to undo.',
    });

    undo();
    expect(schema().positions).toEqual(positions);
  });

  it('says so when the tables are arranged already, and still shows them all', () => {
    arrangeTables();
    useUiStore.setState({ fitPending: false, toast: null });
    const { positions } = schema();

    arrangeTables();
    expect(schema().positions).toBe(positions);
    expect(ui().fitPending).toBe(true);
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'Tables are already arranged' });
  });

  it('arranges only the tables that are selected when several are, and leaves the canvas where it is', () => {
    const { positions } = schema();
    schema().selectTables(['orders', 'order_items', 'payments']);
    arrangeTables();

    expect(schema().positions).not.toEqual(positions);
    expect(schema().positions.users).toBe(positions.users);
    expect(schema().positions.products).toBe(positions.products);
    expect(schema().selection).toEqual(['orders', 'order_items', 'payments']);
    expect(ui().fitPending).toBe(false);
    expect(ui().toast).toMatchObject({
      title: 'Arranged 3 selected tables',
      description: 'Only the selected tables moved. Press ⌘Z to undo.',
    });

    arrangeTables();
    expect(ui().toast).toMatchObject({ tone: 'info', title: 'Selected tables are already arranged' });

    undo();
    expect(schema().positions).toEqual(positions);
  });

  it('arranges every table while one table is selected', () => {
    schema().select('orders');
    arrangeTables();
    expect(ui().fitPending).toBe(true);
    expect(ui().toast).toMatchObject({ title: 'Arranged 5 tables' });
  });

  it('does nothing in a schema without tables', () => {
    schema().load({ name: 'empty', engine: 'PostgreSQL', tables: [], positions: {} });
    arrangeTables();
    expect(ui().fitPending).toBe(false);
    expect(ui().toast).toBeNull();
  });
});

describe('groups of tables', () => {
  it('opens the dialog of the groups over a toast', () => {
    ui().showToast({ title: 'Saved as v2' });
    requestTableGroups();
    expect(ui().dialog).toEqual({ kind: 'table-groups' });
    expect(ui().toast).toBeNull();
  });

  it('puts tables into a group and takes them out, one undo step each', () => {
    groupTables(['orders', 'order_items'], 'sales');
    expect(schema().groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
    groupTables(['payments'], 'sales');
    groupTables(['orders'], null);
    expect(schema().groups[0].tables).toEqual(['order_items', 'payments']);
    undo();
    undo();
    expect(schema().groups[0].tables).toEqual(['orders', 'order_items']);
    undo();
    expect(schema().groups).toEqual([]);
    expect(selectDirty(schema())).toBe(false);
  });

  it('makes a new group of the selected tables and opens the dialog to name it', () => {
    groupTables(['users'], 'group_1');
    groupTablesAsNew(['orders', 'order_items']);
    expect(schema().groups.map((g) => [g.name, g.color, g.tables])).toEqual([
      ['group_1', 'violet', ['users']],
      ['group_2', 'orange', ['orders', 'order_items']],
    ]);
    expect(ui().dialog).toEqual({ kind: 'table-groups' });
  });

  it('saves the groups with the version, which a reload opens with them', async () => {
    groupTables(['orders', 'order_items'], 'sales');
    await saveSchema();
    expect(schema().version).toBe(2);
    const [latest, first] = await listVersions(schema().id!);
    expect(latest.snapshot.groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
    expect(first.snapshot.groups).toBeUndefined();

    await startRouting(memoryAddress('#/schemas/ecommerce'));
    expect(schema().groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
    expect(selectDirty(schema())).toBe(false);
  });
});
