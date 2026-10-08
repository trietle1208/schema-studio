import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, inferredTables, tableNamed } from './fixtures/testing';
import type { Table } from './model';
import {
  addForeignKey,
  countInferred,
  countRelations,
  declareInferred,
  declareReference,
  droppedRelations,
  freeColumns,
  incomingRelations,
  inferredRelations,
  outgoingRelations,
  qualifiedName,
  referenceColumnName,
  referenceProblem,
  referenceTargets,
  relatedTables,
  removeInferred,
  setOnDelete,
  setReference,
  type Relation,
} from './relations';

const arrows = (relations: Relation[]) =>
  relations.map((r) => `${qualifiedName(r.from)} -> ${qualifiedName(r.to)} ${r.onDelete}`);

describe('outgoingRelations', () => {
  it('lists the foreign keys declared on a table', () => {
    const { tables } = ecommerceSnapshot();
    expect(arrows(outgoingRelations(tables[2]))).toEqual([
      'order_items.order_id -> orders.id CASCADE',
      'order_items.product_id -> products.id RESTRICT',
    ]);
    expect(outgoingRelations(tables[0])).toEqual([]);
  });

  it('reads a foreign key without an action as RESTRICT', () => {
    const table: Table = { name: 'reviews', columns: [{ name: 'product_id', type: 'BIGINT', fk: { table: 'products', column: 'id' } }] };
    expect(arrows(outgoingRelations(table))).toEqual(['reviews.product_id -> products.id RESTRICT']);
  });
});

describe('countRelations', () => {
  it('counts the foreign keys of the ecommerce sample', () => {
    const { tables } = ecommerceSnapshot();
    expect(countRelations(tables)).toBe(4);
    expect(countRelations(tables.filter((t) => t.name !== 'order_items'))).toBe(2);
    expect(countRelations([])).toBe(0);
  });
});

describe('incomingRelations', () => {
  it('lists the foreign keys of other tables that reference a table', () => {
    const snapshot = ecommerceSnapshot();
    expect(arrows(incomingRelations(tableNamed(snapshot, 'orders'), snapshot.tables))).toEqual([
      'order_items.order_id -> orders.id CASCADE',
      'payments.order_id -> orders.id RESTRICT',
    ]);
    expect(arrows(incomingRelations(tableNamed(snapshot, 'users'), snapshot.tables))).toEqual(['orders.user_id -> users.id CASCADE']);
    expect(incomingRelations(tableNamed(snapshot, 'payments'), snapshot.tables)).toEqual([]);
  });

  it('counts a self-reference as both outgoing and incoming', () => {
    const categories: Table = {
      name: 'categories',
      columns: [
        { name: 'id', type: 'BIGSERIAL', pk: true },
        { name: 'parent_id', type: 'BIGINT', nullable: true, fk: { table: 'categories', column: 'id', onDelete: 'SET NULL' } },
      ],
    };
    const expected = ['categories.parent_id -> categories.id SET NULL'];
    expect(arrows(outgoingRelations(categories))).toEqual(expected);
    expect(arrows(incomingRelations(categories, [categories]))).toEqual(expected);
  });
});

describe('relatedTables', () => {
  const related = (tables: readonly Table[], name: string) => relatedTables(tables, name).map((t) => t.name);

  it('is the table with the tables it references and those that reference it, in the order of the schema', () => {
    const { tables } = ecommerceSnapshot();
    expect(related(tables, 'orders')).toEqual(['users', 'orders', 'order_items', 'payments']);
    expect(related(tables, 'order_items')).toEqual(['orders', 'order_items', 'products']);
    expect(related(tables, 'users')).toEqual(['users', 'orders']);
  });

  it('goes one foreign key away and no further', () => {
    // payments references orders, which references users: two steps from payments.
    expect(related(ecommerceSnapshot().tables, 'payments')).toEqual(['orders', 'payments']);
  });

  it('follows inferred foreign keys like declared ones', () => {
    expect(related(inferredTables(), 'products')).toEqual(['order_items', 'products']);
  });

  it('is the table alone when it has no relationship, or only one with itself', () => {
    const categories: Table = {
      name: 'categories',
      columns: [
        { name: 'id', type: 'BIGSERIAL', pk: true },
        { name: 'parent_id', type: 'BIGINT', fk: { table: 'categories', column: 'id' } },
      ],
    };
    expect(related([...ecommerceSnapshot().tables, categories], 'categories')).toEqual(['categories']);
    expect(related(removeInferred(inferredTables()), 'orders')).toEqual(['orders']);
  });

  it('is empty for a table the schema does not have', () => {
    expect(relatedTables(ecommerceSnapshot().tables, 'invoices')).toEqual([]);
  });
});

describe('droppedRelations', () => {
  it('lists the foreign keys other tables lose when a table is deleted', () => {
    const snapshot = ecommerceSnapshot();
    expect(arrows(droppedRelations(tableNamed(snapshot, 'orders'), snapshot.tables))).toEqual([
      'order_items.order_id -> orders.id CASCADE',
      'payments.order_id -> orders.id RESTRICT',
    ]);
    expect(arrows(droppedRelations(tableNamed(snapshot, 'users'), snapshot.tables))).toEqual(['orders.user_id -> users.id CASCADE']);
    expect(droppedRelations(tableNamed(snapshot, 'payments'), snapshot.tables)).toEqual([]);
  });

  it('leaves out a self-reference, which goes with the table itself', () => {
    const categories: Table = {
      name: 'categories',
      columns: [
        { name: 'id', type: 'BIGSERIAL', pk: true },
        { name: 'parent_id', type: 'BIGINT', nullable: true, fk: { table: 'categories', column: 'id', onDelete: 'SET NULL' } },
      ],
    };
    const products: Table = {
      name: 'products',
      columns: [{ name: 'category_id', type: 'BIGINT', fk: { table: 'categories', column: 'id' } }],
    };
    expect(arrows(droppedRelations(categories, [categories, products]))).toEqual([
      'products.category_id -> categories.id RESTRICT',
    ]);
  });
});

describe('referenceTargets', () => {
  it('offers the primary key of every other table', () => {
    const snapshot = ecommerceSnapshot();
    expect(referenceTargets(tableNamed(snapshot, 'orders'), snapshot.tables).map(qualifiedName)).toEqual([
      'users.id',
      'order_items.id',
      'products.id',
      'payments.id',
    ]);
  });

  it('skips tables without a primary key', () => {
    const snapshot = ecommerceSnapshot();
    const log: Table = { name: 'audit_log', columns: [{ name: 'message', type: 'TEXT' }] };
    const targets = referenceTargets(tableNamed(snapshot, 'users'), [...snapshot.tables, log]);
    expect(targets.map((r) => r.table)).toEqual(['orders', 'order_items', 'products', 'payments']);
  });
});

describe('setReference', () => {
  it('adds a foreign key with ON DELETE RESTRICT', () => {
    const total = tableNamed(ecommerceSnapshot(), 'orders').columns[3];
    expect(setReference(total, { table: 'products', column: 'id' }).fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
  });

  it('keeps the ON DELETE action when the target changes', () => {
    const userId = tableNamed(ecommerceSnapshot(), 'orders').columns[1];
    expect(setReference(userId, { table: 'products', column: 'id' }).fk).toEqual({ table: 'products', column: 'id', onDelete: 'CASCADE' });
  });

  it('removes the foreign key for null and leaves the rest of the column alone', () => {
    const userId = tableNamed(ecommerceSnapshot(), 'orders').columns[1];
    expect(setReference(userId, null)).toEqual({ ...userId, fk: null });
  });
});

describe('freeColumns', () => {
  it('lists the columns a foreign key can be added to: those without one, or with an inferred one', () => {
    const snapshot = ecommerceSnapshot();
    expect(freeColumns(tableNamed(snapshot, 'order_items')).map((c) => c.name)).toEqual(['id', 'quantity', 'price']);
    expect(freeColumns(inferredTables()[2]).map((c) => c.name)).toEqual(['id', 'order_id', 'product_id', 'quantity', 'price']);
  });
});

describe('referenceColumnName', () => {
  const named = (reference: string) => {
    const [table, column] = reference.split('.');
    return referenceColumnName({ table, column });
  };

  it('calls the column after one row of the table and its key', () => {
    expect(named('users.id')).toBe('user_id');
    expect(named('order_items.id')).toBe('order_item_id');
    expect(named('categories.id')).toBe('category_id');
    expect(named('addresses.id')).toBe('address_id');
    expect(named('boxes.id')).toBe('box_id');
  });

  it('leaves alone a name that is no plural', () => {
    expect(named('status.id')).toBe('status_id');
    expect(named('de_xuat.ma')).toBe('de_xuat_ma');
  });

  it('keeps the name of a key that is called after its table', () => {
    expect(named('orders.order_no')).toBe('order_no');
    expect(named('wp_terms.term_id')).toBe('wp_term_term_id');
  });
});

describe('addForeignKey', () => {
  const column = (tables: readonly Table[], table: string, name: string) => tables.find((t) => t.name === table)?.columns.find((c) => c.name === name);

  it('declares a foreign key on a column the table has', () => {
    const { tables } = ecommerceSnapshot();
    const next = addForeignKey(tables, { table: 'payments', column: 'provider' }, { table: 'users', column: 'id' }, 'SET NULL');
    expect(column(next, 'payments', 'provider')).toEqual({
      name: 'provider',
      type: 'VARCHAR(32)',
      nullable: false,
      fk: { table: 'users', column: 'id', onDelete: 'SET NULL' },
    });
    expect(arrows(outgoingRelations(next[4]))).toEqual(['payments.order_id -> orders.id RESTRICT', 'payments.provider -> users.id SET NULL']);
    // The other tables are the ones that were passed in.
    expect(next.slice(0, 4)).toEqual(tables.slice(0, 4));
    expect(next[0]).toBe(tables[0]);
  });

  it('adds a column the table does not have, nullable and with the type that references the key', () => {
    const { tables } = ecommerceSnapshot();
    const next = addForeignKey(tables, { table: 'products', column: 'user_id' }, { table: 'users', column: 'id' });
    expect(next[3].columns.map((c) => c.name)).toEqual(['id', 'name', 'sku', 'price', 'user_id']);
    // users.id is a BIGSERIAL: the column that references it holds its numbers, not a sequence of its own.
    expect(column(next, 'products', 'user_id')).toEqual({
      name: 'user_id',
      type: 'BIGINT',
      nullable: true,
      fk: { table: 'users', column: 'id', onDelete: 'RESTRICT' },
    });
  });

  it('declares an inferred foreign key that is added by hand, and replaces a declared one', () => {
    const inferred = addForeignKey(inferredTables(), { table: 'orders', column: 'user_id' }, { table: 'users', column: 'id' }, 'CASCADE');
    expect(column(inferred, 'orders', 'user_id')?.fk).toEqual({ table: 'users', column: 'id', onDelete: 'CASCADE' });
    expect(countInferred(inferred)).toBe(3);

    const moved = addForeignKey(ecommerceSnapshot().tables, { table: 'orders', column: 'user_id' }, { table: 'products', column: 'id' });
    expect(arrows(outgoingRelations(moved[1]))).toEqual(['orders.user_id -> products.id RESTRICT']);
  });

  it('gives back the same tables when there is nothing to add it to, or nothing to reference', () => {
    const { tables } = ecommerceSnapshot();
    expect(addForeignKey(tables, { table: 'invoices', column: 'user_id' }, { table: 'users', column: 'id' })).toBe(tables);
    expect(addForeignKey(tables, { table: 'products', column: 'user_id' }, { table: 'users', column: 'uuid' })).toBe(tables);
    expect(addForeignKey(tables, { table: 'products', column: 'user_id' }, { table: 'customers', column: 'id' })).toBe(tables);
    expect(addForeignKey(tables, { table: 'products', column: ' ' }, { table: 'users', column: 'id' })).toBe(tables);
  });
});

describe('setOnDelete', () => {
  it('changes the action of an existing foreign key', () => {
    const userId = tableNamed(ecommerceSnapshot(), 'orders').columns[1];
    expect(setOnDelete(userId, 'SET NULL').fk).toEqual({ table: 'users', column: 'id', onDelete: 'SET NULL' });
    expect(userId.fk?.onDelete).toBe('CASCADE');
  });

  it('does nothing to a column without a foreign key', () => {
    const total = tableNamed(ecommerceSnapshot(), 'orders').columns[3];
    expect(setOnDelete(total, 'CASCADE')).toBe(total);
  });
});

describe('inferred foreign keys', () => {
  it('are relationships like the declared ones, and say that they were inferred', () => {
    const tables = inferredTables();
    expect(countRelations(tables)).toBe(4);
    expect(countInferred(tables)).toBe(4);
    expect(countInferred(ecommerceSnapshot().tables)).toBe(0);
    expect(outgoingRelations(tables[1])).toEqual([
      { from: { table: 'orders', column: 'user_id' }, to: { table: 'users', column: 'id' }, onDelete: 'RESTRICT', inferred: true },
    ]);
    expect(incomingRelations(tables[0], tables)[0].inferred).toBe(true);
    expect(outgoingRelations(ecommerceSnapshot().tables[1])[0]).not.toHaveProperty('inferred');
  });

  it('become declared when they are made a foreign key, or pointed somewhere by hand', () => {
    const userId = inferredTables()[1].columns[1];
    expect(declareReference(userId).fk).toEqual({ table: 'users', column: 'id', onDelete: 'RESTRICT' });
    expect(setReference(userId, { table: 'products', column: 'id' }).fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
    const declared = ecommerceSnapshot().tables[1].columns[1];
    expect(declareReference(declared)).toBe(declared);
  });

  it('are all declared at once for a script that is to create them', () => {
    const tables = inferredTables();
    const declared = declareInferred(tables);
    expect(countInferred(declared)).toBe(0);
    expect(countRelations(declared)).toBe(4);
    // users and products have no foreign key to declare.
    expect(declared[0]).toBe(tables[0]);
    expect(declared[3]).toBe(tables[3]);
  });

  it('are removed without touching the declared ones', () => {
    const { tables } = ecommerceSnapshot();
    const mixed = [...tables.slice(0, 2), ...inferredTables().slice(2)];
    const left = removeInferred(mixed);
    expect(countInferred(left)).toBe(0);
    expect(countRelations(left)).toBe(1);
    expect(left[1]).toBe(tables[1]);
    expect(left[2].columns[1].fk).toBeNull();
  });

  it('are listed in the order of the tables and their columns', () => {
    expect(arrows(inferredRelations(inferredTables()))).toEqual([
      'orders.user_id -> users.id RESTRICT',
      'order_items.order_id -> orders.id RESTRICT',
      'order_items.product_id -> products.id RESTRICT',
      'payments.order_id -> orders.id RESTRICT',
    ]);
    expect(inferredRelations(ecommerceSnapshot().tables)).toEqual([]);
  });

  it('are declared or removed one at a time, by the column that holds them', () => {
    const tables = inferredTables();
    const only = { table: 'order_items', column: 'product_id' };

    const declared = declareInferred(tables, only);
    expect(tableNamed({ tables: declared, positions: {} }, 'order_items').columns.map((c) => c.fk ?? null)).toEqual([
      null,
      { table: 'orders', column: 'id', inferred: true },
      { table: 'products', column: 'id', onDelete: 'RESTRICT' },
      null,
      null,
    ]);
    expect(countInferred(declared)).toBe(3);
    expect(declared[1]).toBe(tables[1]);

    const left = removeInferred(tables, only);
    expect(arrows(inferredRelations(left))).toEqual([
      'orders.user_id -> users.id RESTRICT',
      'order_items.order_id -> orders.id RESTRICT',
      'payments.order_id -> orders.id RESTRICT',
    ]);
    expect(countRelations(left)).toBe(3);
  });

  it('are left alone when the column named has none, or a declared one', () => {
    const tables = inferredTables();
    expect(declareInferred(tables, { table: 'orders', column: 'status' })).toEqual(tables);
    const { tables: declared } = ecommerceSnapshot();
    expect(removeInferred(declared, { table: 'orders', column: 'user_id' })).toEqual(declared);
    expect(countRelations(removeInferred(declared, { table: 'orders', column: 'user_id' }))).toBe(4);
  });
});

describe('referenceProblem', () => {
  it('has nothing against a foreign key to the primary key or a unique column of another table', () => {
    const { tables } = ecommerceSnapshot();
    expect(referenceProblem(tables, { table: 'payments', column: 'provider' }, { table: 'users', column: 'id' })).toBeNull();
    expect(referenceProblem(tables, { table: 'order_items', column: 'price' }, { table: 'products', column: 'sku' })).toBeNull();
    // A column that references another column can be made to reference this one.
    expect(referenceProblem(tables, { table: 'orders', column: 'user_id' }, { table: 'products', column: 'id' })).toBeNull();
  });

  it('says that a column which is no key cannot be referenced', () => {
    const { tables } = ecommerceSnapshot();
    expect(referenceProblem(tables, { table: 'orders', column: 'status' }, { table: 'users', column: 'name' })).toBe(
      'users.name is not a primary key or a unique column.',
    );
  });

  it('says that a foreign key ends in another table', () => {
    const { tables } = ecommerceSnapshot();
    expect(referenceProblem(tables, { table: 'users', column: 'name' }, { table: 'users', column: 'id' })).toBe(
      'A foreign key references a column of another table.',
    );
  });

  it('says that a column already references the column, unless that was only inferred', () => {
    const from = { table: 'orders', column: 'user_id' };
    const to = { table: 'users', column: 'id' };
    expect(referenceProblem(ecommerceSnapshot().tables, from, to)).toBe('orders.user_id already references users.id.');
    expect(referenceProblem(inferredTables(), from, to)).toBeNull();
  });

  it('wants a column with a name, and both columns to be there', () => {
    const { tables } = ecommerceSnapshot();
    const drafted = tables.map((t) => (t.name === 'orders' ? { ...t, columns: [...t.columns, { name: '', type: 'TEXT' }] } : t));
    expect(referenceProblem(drafted, { table: 'orders', column: '' }, { table: 'users', column: 'id' })).toBe('Column name cannot be empty.');
    expect(referenceProblem(tables, { table: 'orders', column: 'buyer_id' }, { table: 'users', column: 'id' })).toBe(
      'Column "buyer_id" does not exist in orders.',
    );
    expect(referenceProblem(tables, { table: 'orders', column: 'status' }, { table: 'users', column: 'uuid' })).toBe(
      'Column "uuid" does not exist in users.',
    );
    expect(referenceProblem(tables, { table: 'orders', column: 'status' }, { table: 'customers', column: 'id' })).toBe(
      'Column "id" does not exist in customers.',
    );
  });
});
