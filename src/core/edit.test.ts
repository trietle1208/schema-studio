import { describe, expect, it } from 'vitest';
import {
  addTable,
  copyName,
  deleteTable,
  duplicateTable,
  moveTable,
  moveTables,
  newTable,
  newTableName,
  renameTable,
  updateTable,
} from './edit';
import { validateColumns, validateTableName } from './validate';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import type { Table } from './model';

const names = (tables: Table[]) => tables.map((t) => t.name);

describe('updateTable', () => {
  it('replaces one table and keeps the others and the positions as they were', () => {
    const before = ecommerceSnapshot();
    const users = tableNamed(before, 'users');
    const edited: Table = { ...users, columns: [...users.columns, { name: 'phone', type: 'VARCHAR(32)', nullable: true }] };

    const after = updateTable(before, 'users', edited);

    expect(tableNamed(after, 'users')).toBe(edited);
    expect(names(after.tables)).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    for (const name of ['orders', 'order_items', 'products', 'payments']) {
      expect(tableNamed(after, name)).toBe(tableNamed(before, name));
    }
    expect(after.positions).toBe(before.positions);
  });

  it('returns the same snapshot when nothing would change', () => {
    const before = ecommerceSnapshot();
    const users = tableNamed(before, 'users');
    expect(updateTable(before, 'users', users)).toBe(before);
    expect(updateTable(before, 'invoices', { ...users, name: 'invoices' })).toBe(before);
  });

  it('does not rename: a table with a different name is ignored', () => {
    const before = ecommerceSnapshot();
    expect(updateTable(before, 'users', { ...tableNamed(before, 'users'), name: 'customers' })).toBe(before);
  });
});

describe('renameTable', () => {
  it('renames the table, repoints foreign keys and moves its position', () => {
    const before = ecommerceSnapshot();
    const after = renameTable(before, 'orders', 'purchases');

    expect(names(after.tables)).toEqual(['users', 'purchases', 'order_items', 'products', 'payments']);
    expect(tableNamed(after, 'purchases').columns).toEqual(tableNamed(before, 'orders').columns);
    expect(tableNamed(after, 'order_items').columns[1].fk).toEqual({ table: 'purchases', column: 'id', onDelete: 'CASCADE' });
    expect(tableNamed(after, 'order_items').columns[2].fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
    expect(tableNamed(after, 'payments').columns[1].fk).toEqual({ table: 'purchases', column: 'id', onDelete: 'RESTRICT' });
    expect(after.positions).toEqual({
      users: { x: 24, y: 48 },
      purchases: { x: 304, y: 24 },
      order_items: { x: 584, y: 160 },
      products: { x: 304, y: 328 },
      payments: { x: 24, y: 336 },
    });
  });

  it('keeps the identity of tables that do not reference the renamed one', () => {
    const before = ecommerceSnapshot();
    const after = renameTable(before, 'orders', 'purchases');
    expect(tableNamed(after, 'users')).toBe(tableNamed(before, 'users'));
    expect(tableNamed(after, 'products')).toBe(tableNamed(before, 'products'));
    expect(tableNamed(after, 'order_items')).not.toBe(tableNamed(before, 'order_items'));
  });

  it('repoints a self-referencing foreign key', () => {
    const base = ecommerceSnapshot();
    const users = tableNamed(base, 'users');
    const before = updateTable(base, 'users', {
      ...users,
      columns: [...users.columns, { name: 'referred_by', type: 'BIGINT', nullable: true, fk: { table: 'users', column: 'id', onDelete: 'SET NULL' } }],
    });

    const after = renameTable(before, 'users', 'customers');

    expect(tableNamed(after, 'customers').columns[5].fk).toEqual({ table: 'customers', column: 'id', onDelete: 'SET NULL' });
    expect(tableNamed(after, 'orders').columns[1].fk?.table).toBe('customers');
  });

  it('returns the same snapshot for an unknown table, a taken name or an unchanged name', () => {
    const before = ecommerceSnapshot();
    expect(renameTable(before, 'invoices', 'bills')).toBe(before);
    expect(renameTable(before, 'orders', 'users')).toBe(before);
    expect(renameTable(before, 'orders', 'orders')).toBe(before);
  });
});

describe('copyName', () => {
  it('appends _copy, then numbers further copies', () => {
    const first = ecommerceSnapshot();
    expect(copyName(first.tables, 'orders')).toBe('orders_copy');
    const second = duplicateTable(first, 'orders');
    expect(copyName(second.tables, 'orders')).toBe('orders_copy2');
    const third = duplicateTable(second, 'orders');
    expect(copyName(third.tables, 'orders')).toBe('orders_copy3');
    expect(copyName(third.tables, 'orders_copy')).toBe('orders_copy_copy');
  });
});

describe('duplicateTable', () => {
  it('appends a copy without foreign keys or indexes, offset from the original', () => {
    const before = ecommerceSnapshot();
    const after = duplicateTable(before, 'order_items');
    const source = tableNamed(before, 'order_items');
    const copy = tableNamed(after, 'order_items_copy');

    expect(names(after.tables)).toEqual(['users', 'orders', 'order_items', 'products', 'payments', 'order_items_copy']);
    expect(copy.columns.map((c) => [c.name, c.type, c.fk])).toEqual([
      ['id', 'BIGSERIAL', null],
      ['order_id', 'BIGINT', null],
      ['product_id', 'BIGINT', null],
      ['quantity', 'INTEGER', null],
      ['price', 'DECIMAL(12,2)', null],
    ]);
    expect(copy.columns[0].pk).toBe(true);
    expect(copy.columns[3].default).toBe('1');
    expect(copy.indexes).toEqual([]);
    expect(copy.schema).toBe(source.schema);
    expect(after.positions.order_items_copy).toEqual({ x: 616, y: 192 });
    expect(after.positions.order_items).toEqual({ x: 584, y: 160 });
    expect(tableNamed(after, 'order_items')).toBe(source);
  });

  it('gives a second copy its own name and position', () => {
    const after = duplicateTable(duplicateTable(ecommerceSnapshot(), 'users'), 'users');
    expect(names(after.tables).slice(5)).toEqual(['users_copy', 'users_copy2']);
    expect(after.positions.users_copy2).toEqual({ x: 56, y: 80 });
  });

  it('returns the same snapshot for an unknown table or a taken name', () => {
    const before = ecommerceSnapshot();
    expect(duplicateTable(before, 'invoices')).toBe(before);
    expect(duplicateTable(before, 'orders', 'users')).toBe(before);
  });

  it('handles a table named like an Object.prototype member', () => {
    const renamed = renameTable(ecommerceSnapshot(), 'users', 'constructor');
    expect(renamed.positions.constructor).toEqual({ x: 24, y: 48 });
    const after = duplicateTable({ tables: renamed.tables, positions: {} }, 'constructor');
    expect(Object.entries(after.positions)).toEqual([['constructor_copy', { x: 32, y: 32 }]]);
  });
});

describe('deleteTable', () => {
  it('removes the table and its position, and drops foreign keys that referenced it', () => {
    const before = ecommerceSnapshot();
    const after = deleteTable(before, 'orders');

    expect(names(after.tables)).toEqual(['users', 'order_items', 'products', 'payments']);
    expect(Object.keys(after.positions)).toEqual(['users', 'order_items', 'products', 'payments']);
    expect(tableNamed(after, 'order_items').columns[1]).toEqual({ name: 'order_id', type: 'BIGINT', nullable: false, fk: null });
    expect(tableNamed(after, 'order_items').columns[2].fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
    expect(tableNamed(after, 'payments').columns[1].fk).toBeNull();
    expect(tableNamed(after, 'users')).toBe(tableNamed(before, 'users'));
    expect(tableNamed(after, 'products')).toBe(tableNamed(before, 'products'));
  });

  it('returns the same snapshot for an unknown table', () => {
    const before = ecommerceSnapshot();
    expect(deleteTable(before, 'invoices')).toBe(before);
  });
});

describe('moveTable', () => {
  it('moves one table and leaves the tables untouched', () => {
    const before = ecommerceSnapshot();
    const after = moveTable(before, 'products', { x: 320, y: 400 });
    expect(after.positions.products).toEqual({ x: 320, y: 400 });
    expect(after.positions.users).toBe(before.positions.users);
    expect(after.tables).toBe(before.tables);
  });

  it('returns the same snapshot when the table is already there or does not exist', () => {
    const before = ecommerceSnapshot();
    expect(moveTable(before, 'products', { x: 304, y: 328 })).toBe(before);
    expect(moveTable(before, 'invoices', { x: 0, y: 0 })).toBe(before);
  });
});

describe('moveTables', () => {
  it('moves the tables it names and leaves the others where they are', () => {
    const before = ecommerceSnapshot();
    const after = moveTables(before, { users: { x: 40, y: 64 }, orders: { x: 320, y: 40 } });
    expect(after.positions).toEqual({ ...before.positions, users: { x: 40, y: 64 }, orders: { x: 320, y: 40 } });
    expect(after.positions.products).toBe(before.positions.products);
    expect(after.tables).toBe(before.tables);
  });

  it('returns the same snapshot when no table it knows goes anywhere', () => {
    const before = ecommerceSnapshot();
    expect(moveTables(before, { users: { x: 24, y: 48 }, invoices: { x: 0, y: 0 } })).toBe(before);
    expect(moveTables(before, {})).toBe(before);
  });

  it('places a table whose name is a property of every object', () => {
    const before = ecommerceSnapshot();
    const snapshot = { tables: [...before.tables, { name: '__proto__', columns: [] }], positions: before.positions };
    const after = moveTables(snapshot, Object.fromEntries([['__proto__', { x: 8, y: 16 }]]));
    expect(Object.keys(after.positions)).toEqual([...Object.keys(before.positions), '__proto__']);
  });
});

describe('newTableName', () => {
  it('counts up until the name is free', () => {
    const { tables } = ecommerceSnapshot();
    expect(newTableName(tables)).toBe('new_table');
    expect(newTableName([...tables, newTable('new_table')])).toBe('new_table2');
    expect(newTableName([...tables, newTable('new_table'), newTable('new_table2')])).toBe('new_table3');
    expect(newTableName([])).toBe('new_table');
  });
});

describe('newTable', () => {
  it('is a valid table with an id primary key', () => {
    const table = newTable('invoices');
    expect(table).toEqual({
      name: 'invoices',
      columns: [{ name: 'id', type: 'BIGSERIAL', nullable: false, pk: true }],
      indexes: [],
    });
    expect(validateColumns(table)).toEqual({});
    expect(validateTableName(table.name, names(ecommerceSnapshot().tables))).toBeNull();
  });
});

describe('addTable', () => {
  it('appends the table at the position and keeps the others as they were', () => {
    const before = ecommerceSnapshot();
    const invoices = newTable('invoices');

    const after = addTable(before, invoices, { x: 320, y: 400 });

    expect(names(after.tables)).toEqual(['users', 'orders', 'order_items', 'products', 'payments', 'invoices']);
    expect(tableNamed(after, 'invoices')).toBe(invoices);
    expect(after.positions.invoices).toEqual({ x: 320, y: 400 });
    for (const name of names(before.tables)) {
      expect(tableNamed(after, name)).toBe(tableNamed(before, name));
      expect(after.positions[name]).toBe(before.positions[name]);
    }
  });

  it('starts a schema that has no tables', () => {
    const after = addTable({ tables: [], positions: {} }, newTable('new_table'), { x: 0, y: 0 });
    expect(names(after.tables)).toEqual(['new_table']);
    expect(after.positions).toEqual({ new_table: { x: 0, y: 0 } });
  });

  it('returns the same snapshot when the name is taken', () => {
    const before = ecommerceSnapshot();
    expect(addTable(before, newTable('orders'), { x: 0, y: 0 })).toBe(before);
  });

  it('is undone by deleting the table', () => {
    const before = ecommerceSnapshot();
    const after = deleteTable(addTable(before, newTable('invoices'), { x: 8, y: 8 }), 'invoices');
    expect(after).toEqual(before);
  });
});

describe('the groups of an edited snapshot', () => {
  const grouped = () => {
    const snapshot = ecommerceSnapshot();
    return {
      ...snapshot,
      groups: [
        { name: 'sales', color: 'violet' as const, tables: ['orders', 'order_items'] },
        { name: 'people', color: 'orange' as const, tables: ['users'] },
      ],
    };
  };

  it('stay as they are when a table is edited, added or moved', () => {
    const snapshot = grouped();
    const orders = tableNamed(snapshot, 'orders');
    expect(updateTable(snapshot, 'orders', { ...orders, comment: 'One row per checkout.' }).groups).toBe(snapshot.groups);
    expect(addTable(snapshot, newTable('new_table'), { x: 0, y: 0 }).groups).toBe(snapshot.groups);
    expect(moveTable(snapshot, 'orders', { x: 8, y: 8 }).groups).toBe(snapshot.groups);
  });

  it('follow a table that is renamed, duplicated or deleted', () => {
    const snapshot = grouped();
    expect(renameTable(snapshot, 'orders', 'purchases').groups?.[0].tables).toEqual(['purchases', 'order_items']);
    expect(duplicateTable(snapshot, 'users').groups?.[1].tables).toEqual(['users', 'users_copy']);
    expect(deleteTable(snapshot, 'users').groups).toEqual([snapshot.groups[0], { name: 'people', color: 'orange', tables: [] }]);
    // A table that is in no group leaves them as they are.
    expect(renameTable(snapshot, 'payments', 'refunds').groups).toBe(snapshot.groups);
    expect(snapshot.groups[0].tables).toEqual(['orders', 'order_items']);
  });

  it('are not added to a snapshot that has none', () => {
    const snapshot = ecommerceSnapshot();
    expect('groups' in renameTable(snapshot, 'orders', 'purchases')).toBe(false);
    expect('groups' in deleteTable(snapshot, 'payments')).toBe(false);
    expect('groups' in duplicateTable(snapshot, 'users')).toBe(false);
  });
});
