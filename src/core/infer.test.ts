import { describe, expect, it } from 'vitest';
import { writtenRelations } from './constraints';
import { blogMysqlDump, shopVietnameseDump } from './fixtures/sql';
import { ecommerceSnapshot, inferredTables } from './fixtures/testing';
import { addInferred, inferRelations, suggestForeignKey, type InferredRelation } from './infer';
import type { Column, Table } from './model';
import { mysqlParser } from './parse/mysql';
import { countInferred, countRelations, qualifiedName } from './relations';

const arrows = (relations: readonly InferredRelation[]) => relations.map((r) => `${qualifiedName(r.from)} -> ${qualifiedName(r.to)}`);

/** A table from columns written as `name TYPE`, the primary key with `pk` after it. */
function table(name: string, ...columns: string[]): Table {
  return {
    name,
    columns: columns.map((text): Column => {
      const [column, type, flag] = text.split(' ');
      return { name: column, type, nullable: false, ...(flag === 'pk' ? { pk: true } : {}) };
    }),
  };
}

/** The ecommerce sample as a database that declares no foreign keys has it. */
function undeclared(): Table[] {
  return ecommerceSnapshot().tables.map((t) => ({ ...t, columns: t.columns.map((c) => ({ ...c, fk: null })) }));
}

/** The tables of a MySQL dump. */
function dumped(sql: string): Table[] {
  const outcome = mysqlParser.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

describe('inferRelations', () => {
  it('finds every foreign key of the ecommerce sample from the names of its columns', () => {
    const { tables } = ecommerceSnapshot();
    expect(arrows(inferRelations(undeclared()))).toEqual(arrows(writtenRelations(tables)));
  });

  it('leaves the columns that have a foreign key alone', () => {
    expect(inferRelations(ecommerceSnapshot().tables)).toEqual([]);
  });

  it('reads a dump without foreign keys, looking past the prefix of its tables', () => {
    const tables = dumped(blogMysqlDump);
    expect(countRelations(tables)).toBe(0);
    expect(arrows(inferRelations(tables))).toEqual([
      'wp_usermeta.user_id -> wp_users.ID',
      'wp_postmeta.post_id -> wp_posts.ID',
      'wp_comments.comment_post_ID -> wp_posts.ID',
      'wp_comments.user_id -> wp_users.ID',
      'wp_term_taxonomy.term_id -> wp_terms.term_id',
      'wp_term_relationships.term_taxonomy_id -> wp_term_taxonomy.term_taxonomy_id',
    ]);
  });

  it('reads a dump whose columns put the word for a key first, and reference a code where the id does not fit', () => {
    const tables = dumped(shopVietnameseDump);
    expect(countRelations(tables)).toBe(0);
    expect(arrows(inferRelations(tables))).toEqual([
      // The categories of the products, not a table called danh_muc.
      'tb_san_pham.danh_muc_id -> tb_san_pham_danh_muc.id',
      // A code in a CHAR column cannot be the numeric id: it is the customer's own code.
      'tb_don_hang.ma_khach_hang -> tb_khach_hang.ma_khach_hang',
      'tb_don_hang_chi_tiet.ma_don_hang -> tb_don_hang.id',
      'tb_don_hang_chi_tiet.ma_san_pham -> tb_san_pham.ma_san_pham',
      'tb_don_hang_lich_su.ma_don_hang -> tb_don_hang.id',
    ]);
  });

  it('takes a word for a key before the name of the table, which must then be the whole name', () => {
    const tables = [
      table('usuarios', 'id INT pk'),
      table('pedidos', 'id INT pk', 'id_usuario INT', 'id_tipo_usuario INT', 'ma_usuario INT', 'no_usuario INT'),
    ];
    expect(arrows(inferRelations(tables))).toEqual(['pedidos.id_usuario -> usuarios.id', 'pedidos.ma_usuario -> usuarios.id']);
  });

  it('takes the end of the name of a table when only one table ends that way', () => {
    const one = [table('product_categories', 'id INT pk'), table('products', 'id INT pk', 'category_id INT')];
    expect(arrows(inferRelations(one))).toEqual(['products.category_id -> product_categories.id']);

    const two = [...one, table('post_categories', 'id INT pk'), table('posts', 'id INT pk', 'category_id INT')];
    // Each table has its own categories; a table with neither cannot tell them apart.
    expect(arrows(inferRelations([...two, table('banners', 'id INT pk', 'category_id INT')]))).toEqual([
      'products.category_id -> product_categories.id',
      'posts.category_id -> post_categories.id',
    ]);
  });

  it('does not read a column that is called after its own table as a reference to it', () => {
    const tables = [
      table('users', 'id INT pk', 'user_id INT', 'id_user INT', 'manager_user_id INT'),
      table('user_roles', 'id INT pk', 'role_id INT'),
    ];
    // Words before the name make it another row of the table: the manager is a user too.
    expect(arrows(inferRelations(tables))).toEqual(['users.manager_user_id -> users.id']);
  });

  it('only references a code the table is looked up by', () => {
    const customers = (index: boolean): Table => ({
      ...table('customers', 'id INT pk', 'customer_code CHAR(8)', 'customer_name TEXT'),
      indexes: index ? [{ name: 'customers_code_idx', type: 'INDEX', using: 'btree', columns: ['customer_code'] }] : [],
    });
    const orders = table('orders', 'id INT pk', 'customer_code CHAR(8)', 'customer_name TEXT');
    expect(arrows(inferRelations([customers(true), orders]))).toEqual(['orders.customer_code -> customers.customer_code']);
    expect(inferRelations([customers(false), orders])).toEqual([]);
  });

  it('matches plurals both ways', () => {
    const tables = [
      table('categories', 'id BIGINT pk'),
      table('statuses', 'id BIGINT pk'),
      table('addresses', 'id BIGINT pk'),
      table('person', 'id BIGINT pk'),
      table('products', 'id BIGINT pk', 'category_id BIGINT', 'status_id BIGINT', 'address_id BIGINT', 'persons_id BIGINT'),
    ];
    expect(arrows(inferRelations(tables))).toEqual([
      'products.category_id -> categories.id',
      'products.status_id -> statuses.id',
      'products.address_id -> addresses.id',
      'products.persons_id -> person.id',
    ]);
  });

  it('reads names in camel case and names that are run together', () => {
    const tables = [
      table('Users', 'Id INT pk'),
      table('OrderItems', 'Id INT pk'),
      table('Shipments', 'Id INT pk', 'UserId INT', 'OrderItemID INT', 'userid INT', 'paid INT'),
    ];
    expect(arrows(inferRelations(tables))).toEqual([
      'Shipments.UserId -> Users.Id',
      'Shipments.OrderItemID -> OrderItems.Id',
      'Shipments.userid -> Users.Id',
    ]);
  });

  it('lets words go before the name of the table, and takes the longest name', () => {
    const tables = [
      table('users', 'id BIGINT pk'),
      table('items', 'id BIGINT pk'),
      table('order_items', 'id BIGINT pk'),
      table('refunds', 'id BIGINT pk', 'created_by_user_id BIGINT', 'order_item_id BIGINT', 'item_id BIGINT'),
    ];
    expect(arrows(inferRelations(tables))).toEqual([
      'refunds.created_by_user_id -> users.id',
      'refunds.order_item_id -> order_items.id',
      'refunds.item_id -> items.id',
    ]);
  });

  it('follows a key that is called after its table, but not one any table could have', () => {
    const tables = [
      table('orders', 'order_no VARCHAR(20) pk'),
      table('countries', 'code CHAR(2) pk'),
      table('order_lines', 'id BIGINT pk', 'order_no VARCHAR(20)', 'code CHAR(2)', 'country_code CHAR(2)'),
    ];
    expect(arrows(inferRelations(tables))).toEqual([
      'order_lines.order_no -> orders.order_no',
      'order_lines.country_code -> countries.code',
    ]);
  });

  it('points a table that shares the key of another at the table the key is called after', () => {
    const tables = [
      table('orders', 'order_id BIGINT pk', 'total DECIMAL(12,2)'),
      table('order_details', 'order_id BIGINT pk', 'note TEXT'),
      table('order_items', 'id BIGINT pk', 'order_id BIGINT'),
    ];
    expect(arrows(inferRelations(tables))).toEqual([
      'order_details.order_id -> orders.order_id',
      'order_items.order_id -> orders.order_id',
    ]);
  });

  it('reads parent_id as a reference to the table itself', () => {
    const tables = [table('categories', 'id BIGINT pk', 'parent_id BIGINT', 'name TEXT')];
    expect(arrows(inferRelations(tables))).toEqual(['categories.parent_id -> categories.id']);
  });

  it('leaves alone an id that goes with a type, which can point at any table', () => {
    const tables = [
      table('images', 'id BIGINT pk'),
      table('comments', 'id BIGINT pk', 'image_id BIGINT', 'image_type VARCHAR(40)', 'parent_id BIGINT', 'parent_type VARCHAR(40)'),
    ];
    expect(inferRelations(tables)).toEqual([]);
  });

  it('leaves alone a column that fits two tables equally well', () => {
    const tables = [
      table('user', 'id BIGINT pk'),
      table('users', 'id BIGINT pk'),
      table('posts', 'id BIGINT pk', 'user_id BIGINT'),
    ];
    expect(inferRelations(tables)).toEqual([]);
  });

  it('needs the two columns to hold the same kind of value, whatever its size', () => {
    const tables = [
      table('users', 'id BIGSERIAL pk'),
      table('accounts', 'id UUID pk'),
      table('sessions', 'id UUID pk', 'user_id INTEGER', 'account_id VARCHAR(36)'),
    ];
    expect(arrows(inferRelations(tables))).toEqual(['sessions.user_id -> users.id']);
  });

  it('only references a primary key of one column', () => {
    const tables = [
      table('tenants', 'id BIGINT'),
      table('memberships', 'user_id BIGINT pk', 'team_id BIGINT pk'),
      table('invites', 'id BIGINT pk', 'tenant_id BIGINT', 'membership_id BIGINT'),
    ];
    expect(inferRelations(tables)).toEqual([]);
  });
});

describe('addInferred', () => {
  it('marks the foreign keys it adds as inferred, and declares none', () => {
    const tables = addInferred(undeclared());
    expect(countRelations(tables)).toBe(4);
    expect(countInferred(tables)).toBe(4);
    expect(tables[1].columns[1].fk).toEqual({ table: 'users', column: 'id', inferred: true });
    expect(writtenRelations(tables)).toEqual([]);
  });

  it('keeps the tables that get no foreign key as they are', () => {
    const before = undeclared();
    const after = addInferred(before);
    // users and products reference nothing.
    expect(after[0]).toBe(before[0]);
    expect(after[3]).toBe(before[3]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('gives back the same tables when there is nothing to add', () => {
    const { tables } = ecommerceSnapshot();
    expect(addInferred(tables)).toBe(tables);
    const inferred = addInferred(undeclared());
    expect(addInferred(inferred)).toBe(inferred);
  });
});

describe('suggestForeignKey', () => {
  const suggested = (tables: readonly Table[], name: string) => {
    const found = tables.find((t) => t.name === name);
    if (!found) throw new Error(`No table "${name}".`);
    return arrows([suggestForeignKey(found, tables)].flatMap((r) => (r ? [r] : [])));
  };

  it('is the first inferred foreign key of the table, which is yet to be declared', () => {
    expect(suggested(inferredTables(), 'order_items')).toEqual(['order_items.order_id -> orders.id']);
    expect(suggested(inferredTables(), 'payments')).toEqual(['payments.order_id -> orders.id']);
  });

  it('is what the names of the columns point to in a table that declares none', () => {
    expect(suggested(undeclared(), 'orders')).toEqual(['orders.user_id -> users.id']);
    expect(suggested(dumped(shopVietnameseDump), 'tb_san_pham')).toEqual(['tb_san_pham.danh_muc_id -> tb_san_pham_danh_muc.id']);
  });

  it('is nothing when every such column has its foreign key, or no name says anything', () => {
    const { tables } = ecommerceSnapshot();
    expect(suggested(tables, 'order_items')).toEqual([]);
    expect(suggested(tables, 'users')).toEqual([]);
  });

  it('leaves out what cannot be declared: a reference to the table itself', () => {
    const categories = table('categories', 'id BIGINT pk', 'parent_id BIGINT');
    expect(arrows(inferRelations([categories]))).toEqual(['categories.parent_id -> categories.id']);
    expect(suggested([categories], 'categories')).toEqual([]);
  });
});
