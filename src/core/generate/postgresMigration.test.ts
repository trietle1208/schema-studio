import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, inferredTables, previousSnapshot, withColumn, withTable } from '../fixtures/testing';
import { declareReference, removeInferred } from '../relations';
import type { Column, Table } from '../model';
import { migratorFor } from './index';
import { postgresMigrator } from './postgresMigration';

const sample = () => ecommerceSnapshot().tables;
const previous = () => previousSnapshot().tables;
const migrate = postgresMigrator.migrate;

/** The statements of a migration, without BEGIN and COMMIT. */
function body(before: readonly Table[], after: readonly Table[]): string {
  const { sql } = migrate(before, after);
  expect(sql.startsWith('BEGIN;\n\n')).toBe(true);
  expect(sql.endsWith('\n\nCOMMIT;\n')).toBe(true);
  return sql.slice('BEGIN;\n\n'.length, -'\n\nCOMMIT;\n'.length);
}

/** The migration for `changes` made to one column of the sample. */
const change = (table: string, column: string, changes: Partial<Column>) =>
  body(sample(), withTable(sample(), table, (t) => withColumn(t, column, changes)));

describe('migrate', () => {
  it('writes the migration of the design in one transaction', () => {
    const migration = migrate(previous(), sample(), { header: ['ecommerce · migration v11 → v12 · PostgreSQL'] });
    expect(migration.sql).toBe(`-- ecommerce · migration v11 → v12 · PostgreSQL

BEGIN;

-- Destructive: Dropping legacy_orders deletes its data.
DROP TABLE legacy_orders;

CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL,
  product_id  BIGINT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  price       DECIMAL(12,2) NOT NULL
);

ALTER TABLE users
  ADD COLUMN avatar_url TEXT;

ALTER TABLE orders
  ALTER COLUMN total TYPE DECIMAL(12,2);

ALTER TABLE products
  ADD COLUMN sku VARCHAR(100) NOT NULL;

CREATE INDEX order_items_order_id_idx
  ON order_items (order_id);

CREATE UNIQUE INDEX products_sku_unique
  ON products (sku);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders (id)
  ON DELETE CASCADE;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products (id)
  ON DELETE RESTRICT;

COMMIT;
`);
    expect(migration.statements).toBe(9);
    expect(migration.destructive).toEqual([{ path: 'legacy_orders', message: 'Dropping legacy_orders deletes its data.' }]);
  });

  it('says so when the two versions come to the same database', () => {
    expect(migrate(sample(), sample())).toEqual({ sql: '-- No changes.\n', statements: 0, destructive: [], atomic: true });
    expect(migrate(sample(), sample(), { header: ['v1 → v2'] }).sql).toBe('-- v1 → v2\n\n-- No changes.\n');
    // Where the tables are on the canvas and the order of the columns are not the database's business.
    const shuffled = sample().map((t) => ({ ...t, columns: [...t.columns].reverse() }));
    expect(migrate(sample(), shuffled).statements).toBe(0);
  });

  it('is the migrator of PostgreSQL, and there is none for an engine that cannot be exported yet', () => {
    expect(migratorFor('PostgreSQL')).toBe(postgresMigrator);
    expect(migratorFor('SQLite')).toBeNull();
  });
});

describe('order of the statements', () => {
  it('drops what goes before it changes the tables, and adds what is new after', () => {
    const sql = migrate(sample(), previous()).sql;
    const at = (statement: string) => {
      expect(sql).toContain(statement);
      return sql.indexOf(statement);
    };
    expect(at('DROP INDEX products_sku_unique;')).toBeLessThan(at('DROP TABLE order_items;'));
    expect(at('DROP TABLE order_items;')).toBeLessThan(at('CREATE TABLE legacy_orders ('));
    expect(at('CREATE TABLE legacy_orders (')).toBeLessThan(at('ALTER TABLE users\n  DROP COLUMN avatar_url;'));
    expect(at('ALTER TABLE products\n  DROP COLUMN sku;')).toBeLessThan(at('CREATE INDEX legacy_orders_user_id_idx'));
    expect(at('CREATE INDEX legacy_orders_user_id_idx')).toBeLessThan(at('ADD CONSTRAINT legacy_orders_user_id_fkey'));
  });

  it('drops the foreign key to a table before the table', () => {
    const after = withTable(
      sample().filter((t) => t.name !== 'products'),
      'order_items',
      (t) => withColumn(t, 'product_id', { fk: null }),
    );
    expect(body(sample(), after)).toBe(`ALTER TABLE order_items
  DROP CONSTRAINT order_items_product_id_fkey;

-- Destructive: Dropping products deletes its data.
DROP TABLE products;`);
  });

  it('drops the tables that go in one statement, whatever references they hold on each other', () => {
    const migration = migrate(sample(), []);
    expect(migration.sql).toContain('DROP TABLE users, orders, order_items, products, payments;');
    expect(migration.statements).toBe(1);
    expect(migration.destructive.map((d) => d.path)).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
  });

  it('leaves the foreign keys and indexes of a dropped table to the DROP TABLE', () => {
    const sql = body(sample(), sample().filter((t) => t.name !== 'payments'));
    expect(sql).toBe('-- Destructive: Dropping payments deletes its data.\nDROP TABLE payments;');
  });

  it('creates a schema from nothing as its DDL does', () => {
    const sql = migrate([], sample()).sql;
    expect(sql.match(/^CREATE TABLE/gm)).toHaveLength(5);
    expect(sql.match(/^CREATE (UNIQUE )?INDEX/gm)).toHaveLength(6);
    expect(sql.match(/ADD CONSTRAINT \w+_fkey/g)).toHaveLength(4);
    expect(sql).toContain("COMMENT ON TABLE users IS 'Registered customers. One row per account.';");
    expect(sql.indexOf('ALTER TABLE')).toBeGreaterThan(sql.lastIndexOf('CREATE'));
  });
});

describe('columns', () => {
  it('adds and drops columns, flagging the drop', () => {
    const renamed = withTable(sample(), 'users', (t) => withColumn(t, 'name', { name: 'full_name' }));
    const migration = migrate(sample(), renamed);
    // A rename reads as one column dropped and one added: the model has only names to go by.
    expect(migration.sql).toContain(`-- Destructive: Dropping users.name deletes its data.
ALTER TABLE users
  DROP COLUMN name,
  ADD COLUMN full_name VARCHAR(255);`);
    expect(migration.destructive).toEqual([{ path: 'users.name', message: 'Dropping users.name deletes its data.' }]);
  });

  it('writes NOT NULL and the default of an added column', () => {
    const after = withTable(sample(), 'orders', (t) => ({
      ...t,
      columns: [...t.columns, { name: 'currency', type: 'CHAR(3)', nullable: false, default: "'USD'", comment: 'ISO 4217.' }],
    }));
    expect(body(sample(), after)).toBe(`ALTER TABLE orders
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';

COMMENT ON COLUMN orders.currency IS 'ISO 4217.';`);
  });

  it('changes a type without a note when every value still fits', () => {
    expect(change('orders', 'status', { type: 'VARCHAR(80)' })).toBe('ALTER TABLE orders\n  ALTER COLUMN status TYPE VARCHAR(80);');
    expect(migrate(sample(), withTable(sample(), 'orders', (t) => withColumn(t, 'status', { type: 'TEXT' }))).destructive).toEqual([]);
  });

  it('flags a type change that can fail or lose data, and says how to convert', () => {
    const after = withTable(sample(), 'orders', (t) => withColumn(t, 'status', { type: 'VARCHAR(20)' }));
    const migration = migrate(sample(), after);
    expect(migration.sql).toContain(`-- Destructive: Changing orders.status from VARCHAR(50) to VARCHAR(20) can fail or lose data.
ALTER TABLE orders
  ALTER COLUMN status TYPE VARCHAR(20) USING status::VARCHAR(20);`);
    expect(migration.destructive).toEqual([
      { path: 'orders.status', message: 'Changing orders.status from VARCHAR(50) to VARCHAR(20) can fail or lose data.' },
    ]);
  });

  it('sets and drops NOT NULL and the default', () => {
    expect(change('users', 'name', { nullable: false, default: "''" })).toBe(
      "ALTER TABLE users\n  ALTER COLUMN name SET NOT NULL,\n  ALTER COLUMN name SET DEFAULT '';",
    );
    expect(change('users', 'created_at', { nullable: true, default: '' })).toBe(
      'ALTER TABLE users\n  ALTER COLUMN created_at DROP NOT NULL,\n  ALTER COLUMN created_at DROP DEFAULT;',
    );
  });

  it('puts every change of a table into one ALTER TABLE', () => {
    const after = withTable(sample(), 'users', (t) => ({
      ...withColumn(withColumn(t, 'name', { type: 'TEXT' }), 'email', { nullable: true }),
      columns: [...withColumn(withColumn(t, 'name', { type: 'TEXT' }), 'email', { nullable: true }).columns.filter((c) => c.name !== 'avatar_url'), { name: 'locale', type: 'VARCHAR(8)', nullable: true }],
    }));
    expect(body(sample(), after)).toBe(`-- Destructive: Dropping users.avatar_url deletes its data.
ALTER TABLE users
  DROP COLUMN avatar_url,
  ADD COLUMN locale VARCHAR(8),
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN name TYPE TEXT;`);
  });

  it('quotes the names that need it', () => {
    const after = withTable(sample(), 'orders', (t) => ({ ...t, columns: [...t.columns, { name: 'Order', type: 'INT', nullable: true }] }));
    expect(body(sample(), after)).toBe('ALTER TABLE orders\n  ADD COLUMN "Order" INT;');
  });
});

describe('auto-increment columns', () => {
  const things = (type: string, rest: Partial<Column> = {}): Table[] => [
    { name: 'things', columns: [{ name: 'n', type, nullable: false, ...rest }] },
  ];

  it('gives an integer column a sequence that goes on from its largest value', () => {
    expect(body(things('INTEGER'), things('SERIAL'))).toBe(`CREATE SEQUENCE things_n_seq AS INTEGER OWNED BY things.n;

SELECT setval('things_n_seq', COALESCE(MAX(n), 0) + 1, false) FROM things;

ALTER TABLE things
  ALTER COLUMN n SET DEFAULT nextval('things_n_seq');`);
  });

  it('widens the column and its sequence together', () => {
    expect(body(things('SERIAL'), things('BIGSERIAL'))).toBe(
      'ALTER TABLE things\n  ALTER COLUMN n TYPE BIGINT;\n\nALTER SEQUENCE things_n_seq AS BIGINT;',
    );
  });

  it('takes the sequence away from a column that stops counting', () => {
    expect(body(things('BIGSERIAL'), things('BIGINT'))).toBe(
      'ALTER TABLE things\n  ALTER COLUMN n DROP DEFAULT;\n\nDROP SEQUENCE IF EXISTS things_n_seq;',
    );
    expect(body(things('BIGSERIAL'), things('BIGINT', { default: '0' }))).toContain('ALTER COLUMN n SET DEFAULT 0;');
  });
});

describe('keys and constraints', () => {
  it('replaces the primary key when its columns or its name change', () => {
    const before: Table[] = [
      {
        name: 't',
        columns: [
          { name: 'id', type: 'INT', nullable: false, pk: true },
          { name: 'a', type: 'INT', nullable: false },
          { name: 'b', type: 'INT', nullable: false },
        ],
      },
    ];
    const after: Table[] = [
      {
        name: 't',
        columns: [
          { name: 'id', type: 'INT', nullable: false },
          { name: 'a', type: 'INT', nullable: false, pk: true },
          { name: 'b', type: 'INT', nullable: false, pk: true },
        ],
        indexes: [{ name: 't_pk', type: 'PRIMARY KEY', using: 'btree', columns: ['b', 'a'] }],
      },
    ];
    expect(body(before, after)).toBe('ALTER TABLE t\n  DROP CONSTRAINT t_pkey,\n  ADD CONSTRAINT t_pk PRIMARY KEY (b, a);');
    expect(body(after, before)).toBe('ALTER TABLE t\n  DROP CONSTRAINT t_pk,\n  ADD CONSTRAINT t_pkey PRIMARY KEY (id);');
  });

  it('adds and drops the constraint of a unique column that has no index', () => {
    expect(change('users', 'name', { unique: true })).toBe('ALTER TABLE users\n  ADD CONSTRAINT users_name_key UNIQUE (name);');
    const unique = withTable(sample(), 'users', (t) => withColumn(t, 'name', { unique: true }));
    expect(body(unique, sample())).toBe('ALTER TABLE users\n  DROP CONSTRAINT users_name_key;');
  });

  it('drops the unique index that goes with a flag', () => {
    expect(change('users', 'email', { unique: false })).toBe('DROP INDEX users_email_unique;');
  });

  it('replaces an index that changed', () => {
    const after = withTable(sample(), 'orders', (t) => ({
      ...t,
      indexes: t.indexes?.map((i) => (i.name === 'orders_user_id_idx' ? { ...i, using: 'hash' } : i)),
    }));
    expect(body(sample(), after)).toBe('DROP INDEX orders_user_id_idx;\n\nCREATE INDEX orders_user_id_idx\n  ON orders USING hash (user_id);');
  });

  it('replaces a foreign key that changed', () => {
    expect(change('payments', 'order_id', { fk: { table: 'orders', column: 'id', onDelete: 'CASCADE' } })).toBe(`ALTER TABLE payments
  DROP CONSTRAINT payments_order_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders (id)
  ON DELETE CASCADE;`);
  });

  it('does not write a foreign key to a table that is not there', () => {
    expect(change('payments', 'order_id', { fk: { table: 'refunds', column: 'id' } })).toBe(
      'ALTER TABLE payments\n  DROP CONSTRAINT payments_order_id_fkey;',
    );
  });
});

describe('tables', () => {
  it('sets and removes comments', () => {
    const after = withTable(withTable(sample(), 'users', (t) => ({ ...withColumn(t, 'email', { comment: "The user's login." }), comment: '' })), 'payments', (t) => ({ ...t, comment: 'One row per charge.' }));
    expect(body(sample(), after)).toBe(`COMMENT ON TABLE users IS NULL;
COMMENT ON TABLE payments IS 'One row per charge.';
COMMENT ON COLUMN users.email IS 'The user''s login.';`);
  });

  it('moves a table to another schema first, and finds it there afterwards', () => {
    const after = withTable(sample(), 'payments', (t) => ({
      ...withColumn(t, 'provider', { type: 'VARCHAR(64)' }),
      schema: 'billing',
      indexes: [...(t.indexes ?? []), { name: 'payments_paid_at_idx', type: 'INDEX' as const, using: 'btree', columns: ['paid_at'] }],
    }));
    expect(body(sample(), after)).toBe(`ALTER TABLE payments
  SET SCHEMA billing;

ALTER TABLE billing.payments
  ALTER COLUMN provider TYPE VARCHAR(64);

CREATE INDEX payments_paid_at_idx
  ON billing.payments (paid_at);`);
    const back = body(after, sample());
    expect(back.startsWith('ALTER TABLE billing.payments\n  SET SCHEMA public;\n\nDROP INDEX payments_paid_at_idx;')).toBe(true);
  });
});

describe('inferred foreign keys', () => {
  it('are no change to migrate', () => {
    const inferred = inferredTables();
    expect(migrate(removeInferred(inferred), inferred)).toMatchObject({ sql: '-- No changes.\n', statements: 0 });
  });

  it('are added by the migration that declares them', () => {
    const inferred = inferredTables();
    const declared = withTable(inferred, 'orders', (t) => ({ ...t, columns: t.columns.map(declareReference) }));
    expect(body(inferred, declared)).toBe(`ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id)
  ON DELETE RESTRICT;`);
  });
});
