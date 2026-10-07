import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import type { Table } from './model';
import {
  countRelations,
  droppedRelations,
  incomingRelations,
  outgoingRelations,
  qualifiedName,
  referenceTargets,
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
