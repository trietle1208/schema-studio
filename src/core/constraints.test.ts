import { describe, expect, it } from 'vitest';
import { primaryKey, uniqueColumns, writtenIndexes, writtenRelations } from './constraints';
import { ecommerceSnapshot, tableNamed, withColumn } from './fixtures/testing';
import type { Table } from './model';

const sample = () => ecommerceSnapshot().tables;
const users = () => tableNamed(ecommerceSnapshot(), 'users');

describe('primaryKey', () => {
  it('is the flagged column, written on the column when it has the name the database gives it', () => {
    expect(primaryKey(users())).toEqual({ name: 'users_pkey', columns: ['id'], inline: true });
  });

  it('takes its name and the order of its columns from the primary-key index', () => {
    const table: Table = {
      name: 't',
      columns: [
        { name: 'a', type: 'INT', pk: true },
        { name: 'b', type: 'INT', pk: true },
      ],
      indexes: [{ name: 't_pk', type: 'PRIMARY KEY', using: 'btree', columns: ['b', 'a'] }],
    };
    expect(primaryKey(table)).toEqual({ name: 't_pk', columns: ['b', 'a'], inline: false });
  });

  it('goes by the flags when the index no longer matches them', () => {
    const table = withColumn(withColumn(users(), 'id', { pk: false }), 'email', { pk: true });
    expect(primaryKey(table)).toEqual({ name: 'users_pkey', columns: ['email'], inline: true });
    expect(primaryKey(withColumn(users(), 'id', { pk: false }))).toBeNull();
  });
});

describe('writtenIndexes', () => {
  it('lists the indexes but for the primary key', () => {
    expect(writtenIndexes(users()).indexes.map((i) => i.name)).toEqual(['users_email_unique', 'users_created_at_idx']);
    expect(writtenIndexes(users()).left).toEqual([]);
  });

  it('drops the unique index of a column that is no longer unique', () => {
    const table = withColumn(users(), 'email', { unique: false });
    expect(writtenIndexes(table).indexes.map((i) => i.name)).toEqual(['users_created_at_idx']);
  });

  it('says why an index cannot be written', () => {
    const table: Table = {
      ...users(),
      indexes: [
        { name: 'users_mail_idx', type: 'INDEX', using: 'btree', columns: ['mail'] },
        { name: 'users_none_idx', type: 'INDEX', using: 'btree', columns: [] },
      ],
    };
    expect(writtenIndexes(table)).toEqual({
      indexes: [],
      left: [
        'Index users_mail_idx was left out: column mail does not exist in users.',
        'Index users_none_idx was left out: it has no columns.',
      ],
    });
  });
});

describe('uniqueColumns', () => {
  it('leaves out a column that a unique index already covers', () => {
    expect(uniqueColumns(users())).toEqual([]);
  });

  it('lists the unique columns without an index, and never the primary key', () => {
    const table = withColumn(withColumn(users(), 'name', { unique: true }), 'id', { unique: true });
    expect(uniqueColumns(table)).toEqual(['name']);
    // With no indexes written, every unique column carries its own constraint.
    expect(uniqueColumns(table, [])).toEqual(['email', 'name']);
  });
});

describe('writtenRelations', () => {
  it('lists the foreign keys of every table', () => {
    expect(writtenRelations(sample()).map((r) => `${r.from.table}.${r.from.column}`)).toEqual([
      'orders.user_id',
      'order_items.order_id',
      'order_items.product_id',
      'payments.order_id',
    ]);
  });

  it('leaves out a foreign key to a table or column that does not exist', () => {
    const tables = sample().filter((t) => t.name !== 'products');
    expect(writtenRelations(tables).map((r) => r.from.column)).toEqual(['user_id', 'order_id', 'order_id']);
    const renamed = tables.map((t) => (t.name === 'users' ? withColumn(t, 'id', { name: 'uid' }) : t));
    expect(writtenRelations(renamed).map((r) => r.from.table)).toEqual(['order_items', 'payments']);
  });
});
