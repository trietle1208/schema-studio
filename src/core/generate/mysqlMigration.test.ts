import { describe, expect, it } from 'vitest';
import { ecommerceMysqlDump } from '../fixtures/sql';
import { withColumn, withTable } from '../fixtures/testing';
import type { Column, Index, Table } from '../model';
import { mysqlParser } from '../parse/mysql';
import { migratorFor } from './index';
import { mysqlMigrator } from './mysqlMigration';

const NOTE = '-- MySQL commits each statement as it runs: a migration that stops halfway is not rolled back.\n\n';
const migrate = mysqlMigrator.migrate;

/** The ecommerce sample as a MySQL database has it: the tables of its mysqldump script. */
function shop(): Table[] {
  const outcome = mysqlParser.parse(ecommerceMysqlDump);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

/** The version of the shop before its order lines were normalised: no `order_items`, no `users.avatar_url`, a narrower `orders.total`. */
function previous(): Table[] {
  const earlier = withTable(shop(), 'users', (t) => ({ ...t, columns: t.columns.filter((c) => c.name !== 'avatar_url') }));
  return withTable(earlier, 'orders', (t) => withColumn(t, 'total', { type: 'DECIMAL(10,2)' })).filter((t) => t.name !== 'order_items');
}

/** The statements of a migration, without the note they start with. */
function body(before: readonly Table[], after: readonly Table[]): string {
  const { sql } = migrate(before, after);
  expect(sql.startsWith(NOTE)).toBe(true);
  return sql.slice(NOTE.length, -1);
}

/** The migration for `changes` made to one column of the shop. */
const change = (table: string, column: string, changes: Partial<Column>) =>
  body(shop(), withTable(shop(), table, (t) => withColumn(t, column, changes)));

const withoutIndex = (tables: Table[], table: string, name: string) =>
  withTable(tables, table, (t) => ({ ...t, indexes: t.indexes?.filter((i) => i.name !== name) }));
const withIndex = (tables: Table[], table: string, index: Index) =>
  withTable(tables, table, (t) => ({ ...t, indexes: [...(t.indexes ?? []), index] }));

describe('migrate', () => {
  it('writes a migration statement by statement, and says that MySQL does not roll it back', () => {
    const migration = migrate(previous(), shop(), { header: ['shop · migration v1 → v2 · MySQL'] });
    expect(migration.sql).toBe(`-- shop · migration v1 → v2 · MySQL

-- MySQL commits each statement as it runs: a migration that stops halfway is not rolled back.

CREATE TABLE \`order_items\` (
  \`id\`          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  \`order_id\`    BIGINT UNSIGNED NOT NULL,
  \`product_id\`  BIGINT UNSIGNED NOT NULL,
  \`quantity\`    INT NOT NULL DEFAULT '1',
  \`price\`       DECIMAL(12,2) NOT NULL
);

ALTER TABLE \`users\`
  ADD COLUMN \`avatar_url\` TEXT;

ALTER TABLE \`orders\`
  MODIFY COLUMN \`total\` DECIMAL(12,2) NOT NULL;

CREATE INDEX \`order_items_order_id_idx\`
  ON \`order_items\` (\`order_id\`);

CREATE INDEX \`order_items_product_id_fk\`
  ON \`order_items\` (\`product_id\`);

ALTER TABLE \`order_items\`
  ADD CONSTRAINT \`order_items_order_id_fkey\`
  FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`)
  ON DELETE CASCADE;

ALTER TABLE \`order_items\`
  ADD CONSTRAINT \`order_items_product_id_fkey\`
  FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
  ON DELETE RESTRICT;
`);
    expect(migration.statements).toBe(7);
    expect(migration.destructive).toEqual([]);
    expect(migration.atomic).toBe(false);
    expect(migration.sql).not.toMatch(/BEGIN|COMMIT;/);
  });

  it('says so when the two versions come to the same database', () => {
    expect(migrate(shop(), shop())).toEqual({ sql: '-- No changes.\n', statements: 0, destructive: [], atomic: false });
    expect(migrate(shop(), shop(), { header: ['v1 → v2'] }).sql).toBe('-- v1 → v2\n\n-- No changes.\n');
    const shuffled = shop().map((t) => ({ ...t, columns: [...t.columns].reverse() }));
    expect(migrate(shop(), shuffled).statements).toBe(0);
  });

  it('is the migrator of MySQL', () => {
    expect(migratorFor('MySQL')).toBe(mysqlMigrator);
  });
});

describe('order of the statements', () => {
  it('drops what goes before it changes the tables, and adds what is new after', () => {
    const sql = migrate(shop(), previous()).sql;
    const at = (statement: string) => {
      expect(sql).toContain(statement);
      return sql.indexOf(statement);
    };
    expect(at('DROP TABLE `order_items`;')).toBeLessThan(at('ALTER TABLE `users`\n  DROP COLUMN `avatar_url`;'));
    expect(at('ALTER TABLE `users`\n  DROP COLUMN `avatar_url`;')).toBeLessThan(at('MODIFY COLUMN `total` DECIMAL(10,2) NOT NULL;'));
  });

  it('drops the foreign key to a table before the table', () => {
    const after = withTable(
      shop().filter((t) => t.name !== 'products'),
      'order_items',
      (t) => withColumn(t, 'product_id', { fk: null }),
    );
    expect(body(shop(), after)).toBe(`ALTER TABLE \`order_items\`
  DROP FOREIGN KEY \`order_items_product_id_fkey\`;

-- Destructive: Dropping products deletes its data.
DROP TABLE \`products\`;`);
  });

  it('drops the tables that go in one statement, whatever references they hold on each other', () => {
    const migration = migrate(shop(), []);
    expect(migration.sql).toContain('DROP TABLE `users`, `orders`, `products`, `order_items`, `payments`;');
    expect(migration.statements).toBe(1);
    expect(migration.destructive.map((d) => d.path)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
  });

  it('creates a schema from nothing as its DDL does', () => {
    const sql = migrate([], shop()).sql;
    expect(sql.match(/^CREATE TABLE/gm)).toHaveLength(5);
    expect(sql.match(/^CREATE (UNIQUE |FULLTEXT )?INDEX/gm)).toHaveLength(9);
    expect(sql.match(/ADD CONSTRAINT `\w+_fkey`/g)).toHaveLength(4);
    expect(sql).toContain(") COMMENT = 'Registered customers. One row per account.';");
    expect(sql.indexOf('ALTER TABLE')).toBeGreaterThan(sql.lastIndexOf('CREATE'));
  });

  it('takes a table without columns for one that is not there, as the DDL leaves it out', () => {
    const blank: Table = { name: 'notes', columns: [] };
    const filled: Table = { name: 'notes', columns: [{ name: 'id', type: 'INT', nullable: false, pk: true }] };
    expect(migrate([...shop(), blank], shop()).statements).toBe(0);
    expect(body([...shop(), blank], [...shop(), filled])).toBe('CREATE TABLE `notes` (\n  `id`  INT PRIMARY KEY\n);');
    expect(body([...shop(), filled], [...shop(), blank])).toBe('-- Destructive: Dropping notes deletes its data.\nDROP TABLE `notes`;');
  });
});

describe('columns', () => {
  it('adds and drops columns, flagging the drop', () => {
    const after = withTable(shop(), 'users', (t) => ({
      ...t,
      columns: [...t.columns.filter((c) => c.name !== 'avatar_url'), { name: 'phone', type: 'VARCHAR(20)', nullable: true, comment: "The user's own." }],
    }));
    const migration = migrate(shop(), after);
    expect(migration.sql).toContain(`-- Destructive: Dropping users.avatar_url deletes its data.
ALTER TABLE \`users\`
  DROP COLUMN \`avatar_url\`,
  ADD COLUMN \`phone\` VARCHAR(20) COMMENT 'The user''s own.';`);
    expect(migration.destructive).toEqual([{ path: 'users.avatar_url', message: 'Dropping users.avatar_url deletes its data.' }]);
  });

  it('writes a column anew to change its type, NOT NULL, default or comment', () => {
    expect(change('payments', 'provider', { type: 'VARCHAR(64)' })).toBe('ALTER TABLE `payments`\n  MODIFY COLUMN `provider` VARCHAR(64) NOT NULL;');
    expect(change('payments', 'paid_at', { nullable: false, default: 'CURRENT_TIMESTAMP' })).toBe(
      'ALTER TABLE `payments`\n  MODIFY COLUMN `paid_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    );
    expect(change('users', 'email', { comment: '' })).toBe('ALTER TABLE `users`\n  MODIFY COLUMN `email` VARCHAR(255) NOT NULL;');
    expect(change('orders', 'status', { default: undefined })).toBe(
      "ALTER TABLE `orders`\n  MODIFY COLUMN `status` ENUM('pending','paid','shipped') NOT NULL;",
    );
  });

  it('changes a type without a note when every value still fits', () => {
    expect(migrate(shop(), withTable(shop(), 'order_items', (t) => withColumn(t, 'quantity', { type: 'BIGINT' }))).destructive).toEqual([]);
    expect(migrate(shop(), withTable(shop(), 'products', (t) => withColumn(t, 'description', { type: 'LONGTEXT' }))).destructive).toEqual([]);
  });

  it('flags a type change that can fail or lose data', () => {
    const migration = migrate(shop(), withTable(shop(), 'orders', (t) => withColumn(t, 'status', { type: 'VARCHAR(20)' })));
    expect(migration.sql).toContain(`-- Destructive: Changing orders.status from ENUM('pending','paid','shipped') to VARCHAR(20) can fail or lose data.
ALTER TABLE \`orders\`
  MODIFY COLUMN \`status\` VARCHAR(20) NOT NULL DEFAULT 'pending';`);
    expect(migration.destructive.map((d) => d.path)).toEqual(['orders.status']);
  });

  it('puts every change of a table into one ALTER TABLE, its comment included', () => {
    const after = withTable(shop(), 'payments', (t) => ({
      ...withColumn(withColumn(t, 'provider', { type: 'VARCHAR(64)' }), 'amount', { default: '0' }),
      comment: "One row per charge; it's final.",
    }));
    expect(body(shop(), after)).toBe(`ALTER TABLE \`payments\`
  MODIFY COLUMN \`provider\` VARCHAR(64) NOT NULL,
  MODIFY COLUMN \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
  COMMENT = 'One row per charge; it''s final.';`);
    expect(body(shop(), withTable(shop(), 'users', (t) => ({ ...t, comment: '' })))).toBe("ALTER TABLE `users`\n  COMMENT = '';");
  });
});

describe('keys and indexes', () => {
  const things = (key: string[], unique = false): Table[] => [
    {
      name: 't',
      columns: [
        { name: 'id', type: 'INT AUTO_INCREMENT', nullable: false, pk: key.includes('id') },
        { name: 'a', type: 'INT', nullable: false, pk: key.includes('a'), unique },
      ],
      indexes: [{ name: 't_pkey', type: 'PRIMARY KEY', using: 'btree', columns: key }],
    },
  ];

  it('replaces the primary key when its columns or their order change', () => {
    expect(body(things(['id']), things(['id', 'a']))).toBe('ALTER TABLE `t`\n  DROP PRIMARY KEY,\n  ADD PRIMARY KEY (`id`, `a`);');
    expect(body(things(['id', 'a']), things(['a', 'id']))).toBe('ALTER TABLE `t`\n  DROP PRIMARY KEY,\n  ADD PRIMARY KEY (`a`, `id`);');
  });

  it('adds and drops the key of a unique column that has no index', () => {
    expect(body(things(['id']), things(['id'], true))).toBe('ALTER TABLE `t`\n  ADD UNIQUE KEY `t_a_key` (`a`);');
    expect(body(things(['id'], true), things(['id']))).toBe('ALTER TABLE `t`\n  DROP INDEX `t_a_key`;');
  });

  it('drops the unique index that goes with a flag, on its table', () => {
    expect(change('users', 'email', { unique: false })).toBe('DROP INDEX `users_email_unique` ON `users`;');
  });

  it('replaces an index that changed', () => {
    const after = withIndex(withoutIndex(shop(), 'users', 'users_created_at_idx'), 'users', {
      name: 'users_created_at_idx',
      type: 'INDEX',
      using: 'btree',
      columns: ['created_at', 'email'],
    });
    expect(body(shop(), after)).toBe(
      'DROP INDEX `users_created_at_idx` ON `users`;\n\nCREATE INDEX `users_created_at_idx`\n  ON `users` (`created_at`, `email`);',
    );
  });
});

describe('foreign keys', () => {
  /** A table whose foreign key starts no index of the model, so MySQL made one for it. */
  const notes = (changes: Partial<Column> = {}, indexes: Index[] = []): Table[] => [
    ...shop(),
    {
      name: 'notes',
      columns: [
        { name: 'id', type: 'BIGINT UNSIGNED AUTO_INCREMENT', nullable: false, pk: true },
        { name: 'order_id', type: 'BIGINT UNSIGNED', nullable: false, fk: { table: 'orders', column: 'id', onDelete: 'CASCADE' }, ...changes },
      ],
      indexes: [{ name: 'notes_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] }, ...indexes],
    },
  ];
  const ADD = 'ALTER TABLE `notes`\n  ADD CONSTRAINT `notes_order_id_fkey`\n  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)';

  it('drops the index MySQL made for a foreign key together with the key', () => {
    expect(body(notes(), notes({ fk: null }))).toBe('ALTER TABLE `notes`\n  DROP FOREIGN KEY `notes_order_id_fkey`,\n  DROP INDEX `notes_order_id_fkey`;');
  });

  it('leaves the index of the model that a dropped foreign key used', () => {
    expect(change('orders', 'user_id', { fk: null })).toBe('ALTER TABLE `orders`\n  DROP FOREIGN KEY `orders_user_id_fkey`;');
  });

  it('replaces a foreign key that changed', () => {
    expect(body(notes(), notes({ fk: { table: 'orders', column: 'id', onDelete: 'RESTRICT' } }))).toBe(`ALTER TABLE \`notes\`
  DROP FOREIGN KEY \`notes_order_id_fkey\`,
  DROP INDEX \`notes_order_id_fkey\`;

${ADD}
  ON DELETE RESTRICT;`);
  });

  it('does not write a foreign key to a table that is not there', () => {
    expect(change('payments', 'order_id', { fk: { table: 'refunds', column: 'id' } })).toBe(
      'ALTER TABLE `payments`\n  DROP FOREIGN KEY `payments_order_id_fkey`;',
    );
  });

  it('takes a foreign key off while the index it uses goes, and puts it back', () => {
    expect(body(shop(), withoutIndex(shop(), 'orders', 'orders_user_id_idx'))).toBe(`ALTER TABLE \`orders\`
  DROP FOREIGN KEY \`orders_user_id_fkey\`;

DROP INDEX \`orders_user_id_idx\` ON \`orders\`;

ALTER TABLE \`orders\`
  ADD CONSTRAINT \`orders_user_id_fkey\`
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
  ON DELETE CASCADE;`);
  });

  it('leaves a foreign key alone when an index is added that it can use', () => {
    const index: Index = { name: 'notes_order_id_idx', type: 'INDEX', using: 'btree', columns: ['order_id'] };
    // MySQL drops the index it made by itself once another one starts with the column.
    expect(body(notes(), notes({}, [index]))).toBe('CREATE INDEX `notes_order_id_idx`\n  ON `notes` (`order_id`);');
  });

  it('takes the foreign keys off a column while its type changes, on either side', () => {
    const wider = (tables: Table[]) =>
      withTable(withTable(tables, 'products', (t) => withColumn(t, 'id', { type: 'BIGINT AUTO_INCREMENT' })), 'order_items', (t) =>
        withColumn(t, 'product_id', { type: 'BIGINT' }),
      );
    const migration = migrate(shop(), wider(shop()));
    expect(migration.sql.slice(NOTE.length)).toBe(`ALTER TABLE \`order_items\`
  DROP FOREIGN KEY \`order_items_product_id_fkey\`;

-- Destructive: Changing products.id from BIGINT UNSIGNED AUTO_INCREMENT to BIGINT AUTO_INCREMENT can fail or lose data.
ALTER TABLE \`products\`
  MODIFY COLUMN \`id\` BIGINT AUTO_INCREMENT NOT NULL;

-- Destructive: Changing order_items.product_id from BIGINT UNSIGNED to BIGINT can fail or lose data.
ALTER TABLE \`order_items\`
  MODIFY COLUMN \`product_id\` BIGINT NOT NULL;

ALTER TABLE \`order_items\`
  ADD CONSTRAINT \`order_items_product_id_fkey\`
  FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
  ON DELETE RESTRICT;
`);
    // A change that is not of the type goes through under the key.
    expect(change('orders', 'user_id', { comment: 'Who ordered.' })).toBe(
      "ALTER TABLE `orders`\n  MODIFY COLUMN `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Who ordered.';",
    );
  });

  it('takes the foreign keys to a column off while the key they reference changes', () => {
    const after = withTable(shop(), 'products', (t) => ({
      ...withColumn(t, 'sku', { pk: true }),
      indexes: t.indexes?.map((i) => (i.type === 'PRIMARY KEY' ? { ...i, columns: ['id', 'sku'] } : i)),
    }));
    const sql = body(shop(), after);
    expect(sql.startsWith('ALTER TABLE `order_items`\n  DROP FOREIGN KEY `order_items_product_id_fkey`;\n\nALTER TABLE `products`\n  DROP PRIMARY KEY,')).toBe(true);
    expect(sql.endsWith('FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)\n  ON DELETE RESTRICT;')).toBe(true);
  });
});

describe('tables', () => {
  it('moves a table to another database first, and finds it there afterwards', () => {
    const after = withTable(shop(), 'payments', (t) => ({ ...withColumn(t, 'provider', { type: 'VARCHAR(64)' }), schema: 'billing' }));
    expect(body(shop(), after)).toBe(`RENAME TABLE \`payments\`
  TO \`billing\`.\`payments\`;

ALTER TABLE \`billing\`.\`payments\`
  MODIFY COLUMN \`provider\` VARCHAR(64) NOT NULL;`);
    expect(body(after, shop()).startsWith('RENAME TABLE `billing`.`payments`\n  TO `payments`;')).toBe(true);
  });
});
