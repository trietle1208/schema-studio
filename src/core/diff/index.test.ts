import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, previousSnapshot, tableNamed, withColumn, withTable } from '../fixtures/testing';
import type { DiffItem, Table } from '../model';
import { countChanges, describeColumn, diffGroups, diffSchemas, totalChanges } from './index';

const sample = () => ecommerceSnapshot().tables;
const previous = () => previousSnapshot().tables;

/** The rows of one group of the list, or none when the group is not there. */
function group(before: readonly Table[], after: readonly Table[], name: string): DiffItem[] {
  return diffGroups(diffSchemas(before, after)).find((g) => g.group === name)?.items ?? [];
}

const rows = (items: DiffItem[]) => items.map((i) => [i.op, i.path, i.detail]);

describe('diffSchemas', () => {
  it('finds nothing between a schema and itself', () => {
    const changes = diffSchemas(sample(), sample());
    expect(changes).toEqual({ tables: [], columns: [], indexes: [], relationships: [] });
    expect(diffGroups(changes)).toEqual([]);
    expect(totalChanges(countChanges(changes))).toBe(0);
  });

  it('finds the changes of the design: order line items normalized', () => {
    const changes = diffSchemas(previous(), sample());
    expect(changes.tables.map((c) => c.op)).toEqual(['add', 'del']);
    expect(changes.columns.map((c) => [c.op, c.table])).toEqual([
      ['add', 'users'],
      ['mod', 'orders'],
      ['add', 'products'],
    ]);
    expect(countChanges(changes)).toEqual({ added: 7, modified: 1, removed: 3 });
  });

  it('keeps both sides of what changed', () => {
    const total = diffSchemas(previous(), sample()).columns.find((c) => c.table === 'orders');
    expect(total).toMatchObject({ op: 'mod', before: { name: 'total', type: 'DECIMAL(10,2)' }, after: { name: 'total', type: 'DECIMAL(12,2)' } });
  });

  it('does not list the columns of a table that was added or removed', () => {
    const changes = diffSchemas(previous(), sample());
    expect(changes.columns.some((c) => c.table === 'order_items' || c.table === 'legacy_orders')).toBe(false);
  });

  it('ignores the order of tables and columns, and where the tables are on the canvas', () => {
    const shuffled = sample()
      .map((t) => ({ ...t, columns: [...t.columns].reverse() }))
      .reverse();
    expect(diffGroups(diffSchemas(sample(), shuffled))).toEqual([]);
  });

  it('reads the first version as everything added', () => {
    expect(countChanges(diffSchemas([], sample()))).toEqual({ added: 5 + 6 + 4, modified: 0, removed: 0 });
    expect(diffSchemas([], sample()).columns).toEqual([]);
  });
});

describe('diffGroups', () => {
  it('lists the changes as the design does, added first and removed last', () => {
    expect(diffGroups(diffSchemas(previous(), sample())).map((g) => [g.group, rows(g.items)])).toEqual([
      [
        'Tables',
        [
          ['add', 'order_items', '5 columns · 2 indexes · 2 foreign keys'],
          ['del', 'legacy_orders', '4 columns · 2 indexes · 1 foreign key'],
        ],
      ],
      [
        'Columns',
        [
          ['add', 'users.avatar_url', 'TEXT NULL'],
          ['add', 'products.sku', 'VARCHAR(100) NOT NULL UNIQUE'],
          ['mod', 'orders.total', 'DECIMAL(10,2) → DECIMAL(12,2)'],
        ],
      ],
      [
        'Indexes',
        [
          ['add', 'order_items_order_id_idx', 'btree (order_id)'],
          ['add', 'products_sku_unique', 'UNIQUE btree (sku)'],
          ['del', 'legacy_orders_user_id_idx', 'btree (user_id)'],
        ],
      ],
      [
        'Relationships',
        [
          ['add', 'order_items.order_id → orders.id', 'ON DELETE CASCADE'],
          ['add', 'order_items.product_id → products.id', 'ON DELETE RESTRICT'],
          ['del', 'legacy_orders.user_id → users.id', 'ON DELETE SET NULL'],
        ],
      ],
    ]);
  });

  it('says where each change shows in the DDL', () => {
    const anchors = diffGroups(diffSchemas(previous(), sample())).flatMap((g) => g.items.map((i) => i.anchor));
    expect(anchors).toEqual([
      'table:order_items',
      'table:legacy_orders',
      'table:users',
      'table:products',
      'table:orders',
      'index:order_items.order_items_order_id_idx',
      'index:products.products_sku_unique',
      'index:legacy_orders.legacy_orders_user_id_idx',
      'fk:order_items.order_id',
      'fk:order_items.product_id',
      'fk:legacy_orders.user_id',
    ]);
  });

  it('says what changed about a column', () => {
    const change = (changes: Partial<Table['columns'][number]>, column = 'name') =>
      rows(group(sample(), withTable(sample(), 'users', (t) => withColumn(t, column, changes)), 'Columns'));

    expect(change({ nullable: false })).toEqual([['mod', 'users.name', 'NULL → NOT NULL']]);
    expect(change({ nullable: true }, 'created_at')).toEqual([['mod', 'users.created_at', 'NOT NULL → NULL']]);
    expect(change({ unique: true })).toEqual([['mod', 'users.name', 'added UNIQUE']]);
    expect(change({ default: "''" })).toEqual([['mod', 'users.name', "added DEFAULT ''"]]);
    expect(change({ default: 'CURRENT_TIMESTAMP' }, 'created_at')).toEqual([
      ['mod', 'users.created_at', 'DEFAULT now() → CURRENT_TIMESTAMP'],
    ]);
    expect(change({ default: '' }, 'created_at')).toEqual([['mod', 'users.created_at', 'removed DEFAULT']]);
    expect(change({ comment: 'Shown on the profile.' })).toEqual([['mod', 'users.name', 'comment changed']]);
    expect(change({ type: 'TEXT', nullable: false, unique: true })).toEqual([
      ['mod', 'users.name', 'VARCHAR(255) → TEXT · NULL → NOT NULL · added UNIQUE'],
    ]);
    // Becoming the primary key says NOT NULL already.
    expect(change({ pk: true, nullable: false })).toEqual([['mod', 'users.name', 'added PRIMARY KEY']]);
  });

  it('lists a renamed column as one removed and one added', () => {
    const renamed = withTable(sample(), 'users', (t) => withColumn(t, 'name', { name: 'full_name' }));
    expect(rows(group(sample(), renamed, 'Columns'))).toEqual([
      ['add', 'users.full_name', 'VARCHAR(255) NULL'],
      ['del', 'users.name', 'VARCHAR(255) NULL'],
    ]);
  });

  it('lists a table whose comment or schema changed', () => {
    const moved = withTable(sample(), 'payments', (t) => ({ ...t, schema: 'billing', comment: 'One row per charge.' }));
    expect(rows(group(sample(), moved, 'Tables'))).toEqual([['mod', 'payments', 'schema public → billing · comment changed']]);
  });

  it('lists an index whose columns changed, and the unique index that goes with a flag', () => {
    const wider = withTable(sample(), 'orders', (t) => ({
      ...t,
      indexes: t.indexes?.map((i) => (i.name === 'orders_user_id_idx' ? { ...i, columns: ['user_id', 'status'] } : i)),
    }));
    expect(rows(group(sample(), wider, 'Indexes'))).toEqual([
      ['mod', 'orders_user_id_idx', 'btree (user_id) → btree (user_id, status)'],
    ]);

    // Clearing the flag takes the column's unique index with it.
    const plain = withTable(sample(), 'users', (t) => withColumn(t, 'email', { unique: false }));
    expect(rows(group(sample(), plain, 'Indexes'))).toEqual([['del', 'users_email_unique', 'UNIQUE btree (email)']]);
    expect(rows(group(sample(), plain, 'Columns'))).toEqual([['mod', 'users.email', 'removed UNIQUE']]);
  });

  it('lists a foreign key that changed as one change of its column', () => {
    const setNull = withTable(sample(), 'payments', (t) =>
      withColumn(t, 'order_id', { fk: { table: 'orders', column: 'id', onDelete: 'CASCADE' } }),
    );
    expect(rows(group(sample(), setNull, 'Relationships'))).toEqual([
      ['mod', 'payments.order_id → orders.id', 'ON DELETE RESTRICT → CASCADE'],
    ]);
    expect(group(sample(), setNull, 'Columns')).toEqual([]);

    const repointed = withTable(sample(), 'payments', (t) => withColumn(t, 'order_id', { fk: { table: 'users', column: 'id' } }));
    expect(rows(group(sample(), repointed, 'Relationships'))).toEqual([
      ['mod', 'payments.order_id → users.id', 'orders.id → users.id'],
    ]);
  });

  it('leaves out a foreign key that cannot be written', () => {
    const dangling = withTable(sample(), 'payments', (t) => withColumn(t, 'order_id', { fk: { table: 'refunds', column: 'id' } }));
    expect(rows(group(sample(), dangling, 'Relationships'))).toEqual([
      ['del', 'payments.order_id → orders.id', 'ON DELETE RESTRICT'],
    ]);
  });
});

describe('describeColumn', () => {
  it('reads like the column in SQL', () => {
    const users = tableNamed(ecommerceSnapshot(), 'users');
    expect(users.columns.map(describeColumn)).toEqual([
      'BIGSERIAL PRIMARY KEY',
      'VARCHAR(255) NOT NULL UNIQUE',
      'VARCHAR(255) NULL',
      'TEXT NULL',
      'TIMESTAMP NOT NULL DEFAULT now()',
    ]);
  });
});
