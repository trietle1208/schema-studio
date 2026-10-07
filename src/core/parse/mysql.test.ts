import { describe, expect, it } from 'vitest';
import { ecommerceMysqlDump, ecommercePhpMyAdmin, ecommerceSql } from '../fixtures/sql';
import type { ParseError, ParseResult } from './index';
import { mysqlParser } from './mysql';

function parsed(sql: string): ParseResult {
  const outcome = mysqlParser.parse(sql);
  if (!outcome.ok) throw new Error(`${outcome.error.message} ${outcome.error.detail ?? ''}`);
  return outcome;
}

function failure(sql: string): ParseError {
  const outcome = mysqlParser.parse(sql);
  if (outcome.ok) throw new Error('The SQL was expected not to parse.');
  return outcome.error;
}

const table = (result: ParseResult, name: string) => {
  const found = result.tables.find((t) => t.name === name);
  if (!found) throw new Error(`No table "${name}" was parsed.`);
  return found;
};
const indexes = (result: ParseResult, name: string) => table(result, name).indexes ?? [];
const column = (result: ParseResult, path: string) => {
  const [tableName, name] = path.split('.');
  const found = table(result, tableName).columns.find((c) => c.name === name);
  if (!found) throw new Error(`No column "${path}" was parsed.`);
  return found;
};
const types = (result: ParseResult, name: string) => table(result, name).columns.map((c) => c.type);

describe('a mysqldump script', () => {
  const result = parsed(ecommerceMysqlDump);

  it('imports the tables of the ecommerce sample and passes over everything else', () => {
    expect(result.tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
    // The DROP TABLEs are read; LOCK, INSERT, UNLOCK and the trigger are not. The `/*!…*/` lines are comments.
    expect(result.skipped).toBe(4);
  });

  it('reads a table with its columns, keys and comments', () => {
    expect(table(result, 'users')).toEqual({
      name: 'users',
      schema: 'public',
      comment: 'Registered customers. One row per account.',
      columns: [
        { name: 'id', type: 'BIGINT UNSIGNED AUTO_INCREMENT', nullable: false, pk: true },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true, comment: "Lower-cased; it's the login." },
        { name: 'name', type: 'VARCHAR(255)', nullable: true },
        { name: 'avatar_url', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP' },
      ],
      indexes: [
        { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
        { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
        { name: 'users_created_at_idx', type: 'INDEX', using: 'btree', columns: ['created_at'] },
      ],
    });
  });

  it('reads the foreign keys with their ON DELETE actions', () => {
    expect(column(result, 'orders.user_id').fk).toEqual({ table: 'users', column: 'id', onDelete: 'CASCADE' });
    expect(column(result, 'order_items.order_id').fk).toEqual({ table: 'orders', column: 'id', onDelete: 'CASCADE' });
    expect(column(result, 'order_items.product_id').fk).toEqual({ table: 'products', column: 'id', onDelete: 'RESTRICT' });
    expect(column(result, 'payments.order_id').fk).toEqual({ table: 'orders', column: 'id', onDelete: 'RESTRICT' });
  });

  it('keeps the types and defaults as MySQL writes them', () => {
    expect(types(result, 'orders')).toEqual([
      'BIGINT UNSIGNED AUTO_INCREMENT',
      'BIGINT UNSIGNED',
      "ENUM('pending','paid','shipped')",
      'DECIMAL(12,2)',
      'TIMESTAMP',
      'TIMESTAMP',
    ]);
    expect(column(result, 'orders.status').default).toBe("'pending'");
    expect(column(result, 'order_items.quantity').default).toBe("'1'");
    // DEFAULT NULL is what a column that may be NULL has anyway.
    expect(column(result, 'orders.updated_at')).toEqual({ name: 'updated_at', type: 'TIMESTAMP', nullable: true });
    expect(column(result, 'payments.paid_at')).toEqual({ name: 'paid_at', type: 'DATETIME', nullable: true });
  });

  it('reads a full-text index as an index of that kind', () => {
    expect(indexes(result, 'products')).toContainEqual({
      name: 'products_search',
      type: 'INDEX',
      using: 'fulltext',
      columns: ['name', 'description'],
    });
  });

  it('says what it left out', () => {
    expect(result.warnings).toEqual(['1 CHECK constraint was not imported.', '1 ON UPDATE clause was not imported.']);
  });
});

describe('a phpMyAdmin export', () => {
  const result = parsed(ecommercePhpMyAdmin);

  it('puts the keys of the ALTER TABLE statements on the tables', () => {
    expect(table(result, 'users')).toEqual({
      name: 'users',
      schema: 'public',
      comment: '',
      columns: [
        { name: 'id', type: 'INT(11) AUTO_INCREMENT', nullable: false, pk: true },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
        { name: 'name', type: 'VARCHAR(255)', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'current_timestamp()' },
      ],
      indexes: [
        { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
        { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      ],
    });
    expect(column(result, 'orders.id')).toEqual({ name: 'id', type: 'INT(11) AUTO_INCREMENT', nullable: false, pk: true });
    expect(column(result, 'orders.user_id').fk).toEqual({ table: 'users', column: 'id', onDelete: 'CASCADE' });
  });

  it('has nothing to warn about', () => {
    expect(result.warnings).toEqual([]);
    // SET, START TRANSACTION, SET and COMMIT.
    expect(result.skipped).toBe(4);
  });
});

describe('CREATE TABLE', () => {
  it('reads names, types and NOT NULL', () => {
    const result = parsed('CREATE TABLE audit.events (id char(36) NOT NULL, note text NULL, at datetime)');
    expect(result.tables).toEqual([
      {
        name: 'events',
        schema: 'audit',
        comment: '',
        columns: [
          { name: 'id', type: 'CHAR(36)', nullable: false },
          { name: 'note', type: 'TEXT', nullable: true },
          { name: 'at', type: 'DATETIME', nullable: true },
        ],
        indexes: [],
      },
    ]);
  });

  it('keeps names as they are written, whatever they are quoted with', () => {
    const result = parsed('CREATE TABLE Users (ID int, `Full Name` text, `key` int, `a``b` int, "ansi" int)');
    expect(table(result, 'Users').columns.map((c) => c.name)).toEqual(['ID', 'Full Name', 'key', 'a`b', 'ansi']);
  });

  it('writes types in upper case and without spaces, with what makes them another type', () => {
    const result = parsed(`CREATE TABLE t (
      a int(10) unsigned, b decimal(10, 2), c double precision, d tinyint(1), e set('x', 'y z'),
      f int unsigned zerofill, g character varying(8), h bigint signed, i national varchar(4), j timestamp(6),
      k varchar(20) CHARACTER SET latin1 COLLATE latin1_bin, l json, m serial
    )`);
    expect(types(result, 't')).toEqual([
      'INT(10) UNSIGNED',
      'DECIMAL(10,2)',
      'DOUBLE PRECISION',
      'TINYINT(1)',
      "SET('x','y z')",
      'INT UNSIGNED ZEROFILL',
      'CHARACTER VARYING(8)',
      'BIGINT',
      'NATIONAL VARCHAR(4)',
      'TIMESTAMP(6)',
      'VARCHAR(20)',
      'JSON',
      'SERIAL',
    ]);
    expect(column(result, 't.m').nullable).toBe(false);
  });

  it('keeps a default as it is written', () => {
    const result = parsed(`CREATE TABLE t (
      a varchar(20) DEFAULT 'it''s, ok' NOT NULL,
      b varchar(20) NOT NULL DEFAULT "it\\'s",
      c int DEFAULT -1,
      d datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      e bit(1) DEFAULT b'0',
      f json DEFAULT (JSON_ARRAY(1, 2)),
      g decimal(4,2) DEFAULT 0.50 COMMENT 'half',
      h text DEFAULT NULL,
      i tinyint(1) DEFAULT TRUE
    )`);
    expect(table(result, 't').columns.map((c) => c.default)).toEqual([
      "'it''s, ok'",
      `"it\\'s"`,
      '-1',
      'CURRENT_TIMESTAMP(6)',
      "b'0'",
      '(JSON_ARRAY(1, 2))',
      '0.50',
      undefined,
      'TRUE',
    ]);
    expect(column(result, 't.a').nullable).toBe(false);
    expect(column(result, 't.g').comment).toBe('half');
  });

  it('takes the escapes out of a comment', () => {
    const result = parsed(`CREATE TABLE t (a int COMMENT 'it\\'s "a"\\nb, it''s', b int COMMENT "say ""hi""") COMMENT 'the \\\\ table'`);
    expect(column(result, 't.a').comment).toBe('it\'s "a"\nb, it\'s');
    expect(column(result, 't.b').comment).toBe('say "hi"');
    expect(table(result, 't').comment).toBe('the \\ table');
  });

  it('makes a primary key NOT NULL and gives it the name the model has for it', () => {
    const result = parsed('CREATE TABLE t (id int PRIMARY KEY, code varchar(8) UNIQUE)');
    expect(column(result, 't.id')).toEqual({ name: 'id', type: 'INT', nullable: false, pk: true });
    expect(column(result, 't.code')).toEqual({ name: 'code', type: 'VARCHAR(8)', nullable: true, unique: true });
    expect(indexes(result, 't')).toEqual([
      { name: 't_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'code', type: 'UNIQUE', using: 'btree', columns: ['code'] },
    ]);
    expect(column(parsed('CREATE TABLE u (id int AUTO_INCREMENT KEY)'), 'u.id')).toEqual({
      name: 'id',
      type: 'INT AUTO_INCREMENT',
      nullable: false,
      pk: true,
    });
  });

  it('reads the keys of a table, wherever they are written and whatever case they name the columns in', () => {
    const result = parsed(`CREATE TABLE t (
      PRIMARY KEY (A, b),
      a int, b int, c int, d int,
      UNIQUE (c),
      UNIQUE KEY (C, d),
      INDEX by_d USING HASH (d DESC),
      KEY (d) USING BTREE COMMENT 'again' INVISIBLE,
      CONSTRAINT c_key UNIQUE INDEX (b, c)
    )`);
    expect(indexes(result, 't')).toEqual([
      { name: 't_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['a', 'b'] },
      { name: 'c', type: 'UNIQUE', using: 'btree', columns: ['c'] },
      { name: 'c_2', type: 'UNIQUE', using: 'btree', columns: ['c', 'd'] },
      { name: 'by_d', type: 'INDEX', using: 'hash', columns: ['d'] },
      { name: 'd', type: 'INDEX', using: 'btree', columns: ['d'] },
      { name: 'c_key', type: 'UNIQUE', using: 'btree', columns: ['b', 'c'] },
    ]);
    expect(table(result, 't').columns.map((c) => [c.name, !!c.pk, !!c.unique, c.nullable])).toEqual([
      ['a', true, false, false],
      ['b', true, false, false],
      ['c', false, true, true],
      ['d', false, false, true],
    ]);
  });

  it('imports an index on the start of a column without its length, and skips one on an expression', () => {
    const result = parsed('CREATE TABLE t (id int PRIMARY KEY, title text, UNIQUE KEY title_start (title(64)), KEY lowered ((lower(title))))');
    expect(indexes(result, 't').map((i) => i.name)).toEqual(['t_pkey', 'title_start']);
    expect(column(result, 't.title').unique).toBeUndefined();
    expect(result.warnings).toEqual([
      'Index `title_start` on `t` has a prefix length, which was not imported.',
      'Index `lowered` on `t` uses an expression and was skipped.',
    ]);
  });

  it('skips IF NOT EXISTS for a table that is already defined', () => {
    const result = parsed('CREATE TABLE t (id int PRIMARY KEY); CREATE TABLE IF NOT EXISTS t (other int);');
    expect(table(result, 't').columns.map((c) => c.name)).toEqual(['id']);
  });

  it('imports a table without the clauses that say how it is stored', () => {
    const result = parsed(`CREATE TEMPORARY TABLE t (id int PRIMARY KEY, day date)
      ENGINE = InnoDB ROW_FORMAT=DYNAMIC COMMENT = 'by day'
      PARTITION BY RANGE (YEAR(day)) (PARTITION p0 VALUES LESS THAN (2020) COMMENT = 'old');`);
    expect(table(result, 't').comment).toBe('by day');
    expect(result.warnings).toEqual(['`t` uses an unsupported PARTITION BY clause and will import without it.']);
  });

  it('skips a table that takes its columns from elsewhere', () => {
    const result = parsed('CREATE TABLE a (id int PRIMARY KEY);\nCREATE TABLE b LIKE a;\nCREATE TABLE c AS SELECT * FROM a;');
    expect(result.tables.map((t) => t.name)).toEqual(['a']);
    expect(result.warnings).toEqual([
      'Line 2: this CREATE TABLE statement has no column list and was skipped.',
      'Line 3: this CREATE TABLE statement has no column list and was skipped.',
    ]);
  });

  it('counts the CHECK constraints it leaves out and names the generated columns', () => {
    const result = parsed(`CREATE TABLE t (
      id int PRIMARY KEY CHECK (id > 0) NOT ENFORCED,
      qty int
        UNIQUE CHECK (qty > 0) NOT NULL,
      max int CONSTRAINT max_positive CHECK (max > 0),
      total int GENERATED ALWAYS AS (qty * 2) STORED NOT NULL,
      half int AS (qty / 2),
      CHECK (qty < 100)
    )`);
    expect(column(result, 't.qty').nullable).toBe(false);
    expect(column(result, 't.total')).toEqual({ name: 'total', type: 'INT', nullable: false });
    expect(result.warnings).toEqual([
      '`t.total` is a generated column; its expression was not imported.',
      '`t.half` is a generated column; its expression was not imported.',
      '4 CHECK constraints were not imported.',
    ]);
  });

  it('warns about a table without a primary key', () => {
    expect(parsed('CREATE TABLE t (id int)').warnings).toEqual(['`t` has no primary key.']);
  });

  it('reads DDL that is not MySQL only in its types', () => {
    const result = parsed(ecommerceSql);
    expect(result.tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
    expect(column(result, 'orders.user_id').fk).toEqual({ table: 'users', column: 'id', onDelete: 'CASCADE' });
  });
});

describe('foreign keys', () => {
  const users = 'CREATE TABLE users (id int PRIMARY KEY, email varchar(64));\n';

  it('reads a reference with its ON DELETE action', () => {
    const result = parsed(`${users}CREATE TABLE t (
      a int REFERENCES users (id),
      b int REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL,
      c int,
      d int,
      FOREIGN KEY (c) REFERENCES users (ID) MATCH SIMPLE ON DELETE NO ACTION,
      CONSTRAINT t_d_fk FOREIGN KEY d_idx (d) REFERENCES shop.users (id) ON DELETE RESTRICT ON UPDATE NO ACTION
    )`);
    expect(table(result, 't').columns.map((c) => c.fk)).toEqual([
      { table: 'users', column: 'id', onDelete: 'NO ACTION' },
      { table: 'users', column: 'id', onDelete: 'SET NULL' },
      { table: 'users', column: 'id', onDelete: 'NO ACTION' },
      { table: 'users', column: 'id', onDelete: 'RESTRICT' },
    ]);
  });

  it('may reference a table that is created later, or itself', () => {
    const result = parsed(`CREATE TABLE t (id int PRIMARY KEY, parent int REFERENCES t (id), user_id int REFERENCES users (id));\n${users}`);
    expect(column(result, 't.parent').fk?.table).toBe('t');
    expect(column(result, 't.user_id').fk?.table).toBe('users');
  });

  it('skips a foreign key to a table or column the script does not define', () => {
    const result = parsed(`${users}CREATE TABLE t (id int PRIMARY KEY, a int REFERENCES nope (id), b int REFERENCES users (nope))`);
    expect(column(result, 't.a').fk).toBeUndefined();
    expect(column(result, 't.b').fk).toBeUndefined();
    expect(result.warnings).toEqual([
      'Foreign key `t.a` references `nope`, which is not defined, and was skipped.',
      'Foreign key `t.b` references `users.nope`, which is not defined, and was skipped.',
    ]);
  });

  it('skips a composite foreign key', () => {
    const result = parsed(`${users}CREATE TABLE t (id int PRIMARY KEY, a int, b varchar(64), FOREIGN KEY (a, b) REFERENCES users (id, email))`);
    expect(result.warnings).toEqual(['The composite foreign key on `t` (`a`, `b`) was skipped.']);
  });

  it('imports ON DELETE SET DEFAULT as NO ACTION and says so', () => {
    const result = parsed(`${users}CREATE TABLE t (id int PRIMARY KEY, a int, FOREIGN KEY (a) REFERENCES users (id) ON DELETE SET DEFAULT)`);
    expect(column(result, 't.a').fk?.onDelete).toBe('NO ACTION');
    expect(result.warnings).toEqual(['`t.a` uses ON DELETE SET DEFAULT, imported as NO ACTION.']);
  });
});

describe('ALTER TABLE', () => {
  const t = 'CREATE TABLE t (id int NOT NULL, a int DEFAULT 1 COMMENT \'one\');\n';

  it('adds keys, constraints and columns', () => {
    const result = parsed(`${t}CREATE TABLE u (id int PRIMARY KEY);
      ALTER TABLE t ADD PRIMARY KEY (id), ADD COLUMN b varchar(8) NOT NULL AFTER id, ADD c int UNIQUE FIRST,
        ADD FULLTEXT INDEX b_text (b), ADD CONSTRAINT t_a_fk FOREIGN KEY (a) REFERENCES u (id) ON DELETE CASCADE;`);
    expect(table(result, 't').columns).toEqual([
      { name: 'id', type: 'INT', nullable: false, pk: true },
      { name: 'a', type: 'INT', nullable: true, default: '1', comment: 'one', fk: { table: 'u', column: 'id', onDelete: 'CASCADE' } },
      { name: 'b', type: 'VARCHAR(8)', nullable: false },
      { name: 'c', type: 'INT', nullable: true, unique: true },
    ]);
    expect(indexes(result, 't').map((i) => [i.name, i.type, i.using])).toEqual([
      ['t_pkey', 'PRIMARY KEY', 'btree'],
      ['c', 'UNIQUE', 'btree'],
      ['b_text', 'INDEX', 'fulltext'],
    ]);
  });

  it('writes a column anew with MODIFY and leaves its keys', () => {
    const result = parsed(`${t}ALTER TABLE t ADD PRIMARY KEY (id), ADD UNIQUE KEY (a);
      ALTER TABLE t MODIFY COLUMN ID bigint NULL AUTO_INCREMENT, MODIFY a varchar(4), COMMENT = 'altered', ENGINE=InnoDB;`);
    expect(table(result, 't').columns).toEqual([
      { name: 'id', type: 'BIGINT AUTO_INCREMENT', nullable: false, pk: true },
      { name: 'a', type: 'VARCHAR(4)', nullable: true, unique: true },
    ]);
    expect(table(result, 't').comment).toBe('altered');
    expect(result.warnings).toEqual([]);
  });

  it('skips what it does not import and says where', () => {
    const result = parsed(`${t}ALTER TABLE nope ADD PRIMARY KEY (id);
ALTER TABLE t DROP COLUMN a,
  RENAME TO s, ALGORITHM=INPLACE;
ALTER TABLE t;`);
    expect(table(result, 't').columns.map((c) => c.name)).toEqual(['id', 'a']);
    expect(result.warnings).toEqual([
      'Line 2: ALTER TABLE names `nope`, which is not defined, and was skipped.',
      'Line 3: `ALTER TABLE t DROP` was not imported.',
      'Line 4: `ALTER TABLE t RENAME` was not imported.',
      '`t` has no primary key.',
    ]);
  });
});

describe('CREATE INDEX and DROP TABLE', () => {
  const t = 'CREATE TABLE t (id int PRIMARY KEY, a int, b text);\n';

  it('reads the name, the kind and the columns', () => {
    const result = parsed(`${t}CREATE INDEX a_idx ON t (a);
      CREATE UNIQUE INDEX a_b USING BTREE ON t (a, b(10)) ALGORITHM = INPLACE LOCK = NONE;
      CREATE FULLTEXT INDEX b_text ON shop.t (b) WITH PARSER ngram;
      CREATE INDEX elsewhere ON nope (a);`);
    expect(indexes(result, 't').slice(1)).toEqual([
      { name: 'a_idx', type: 'INDEX', using: 'btree', columns: ['a'] },
      { name: 'a_b', type: 'UNIQUE', using: 'btree', columns: ['a', 'b'] },
      { name: 'b_text', type: 'INDEX', using: 'fulltext', columns: ['b'] },
    ]);
    expect(result.warnings).toEqual([
      'Index `a_b` on `t` has a prefix length, which was not imported.',
      'Line 5: CREATE INDEX names `nope`, which is not defined, and was skipped.',
    ]);
  });

  it('lets two tables have an index of the same name', () => {
    const result = parsed(`${t}CREATE TABLE u (id int PRIMARY KEY, a int, KEY a (a));\nCREATE INDEX a ON t (a);`);
    expect(indexes(result, 't')[1].name).toBe('a');
    expect(indexes(result, 'u')[1].name).toBe('a');
  });

  it('drops a table that was created before', () => {
    const result = parsed(`${t}CREATE TABLE u (id int PRIMARY KEY);\nDROP TABLE IF EXISTS t, nope CASCADE;\n${t}`);
    expect(result.tables.map((x) => x.name)).toEqual(['u', 't']);
  });
});

describe('errors', () => {
  const rest = 'Fix the statement or remove it to import the rest.';

  it('names the line a comma is missing on, and the column', () => {
    const sql = 'CREATE TABLE `order_items` (\n  `id` bigint NOT NULL AUTO_INCREMENT,\n  `order_id` bigint NOT NULL\n  `quantity` int NOT NULL,\n  PRIMARY KEY (`id`)';
    expect(failure(sql)).toEqual({
      message: 'Unable to parse SQL near line 3.',
      line: 3,
      detail: `Expected \`,\` or \`)\` after column definition \`order_id\`. ${rest}`,
    });
  });

  it('reports a comma that is missing before or after a key', () => {
    const before = failure('CREATE TABLE t (\n  id int,\n  a int\n  UNIQUE KEY a_key (a)\n);');
    expect(before.line).toBe(3);
    expect(before.detail).toBe(`Expected \`,\` or \`)\` after column definition \`a\`. ${rest}`);
    const after = failure('CREATE TABLE t (\n  id int,\n  PRIMARY KEY (id)\n  KEY a (id)\n);');
    expect(after.line).toBe(3);
    expect(after.detail).toBe(`Expected \`,\` or \`)\` after this constraint. ${rest}`);
  });

  it('reports a comma too many on the line it is on', () => {
    expect(failure('CREATE TABLE t (\n  id int,\n  name text,\n);')).toEqual({
      message: 'Unable to parse SQL near line 3.',
      line: 3,
      detail: `Unexpected \`)\`. Remove the \`,\` before it. ${rest}`,
    });
  });

  it('says what was expected', () => {
    expect(failure('CREATE TABLE t (\n  id int PRIMARY,\n  name text\n)')).toEqual({
      message: 'Unable to parse SQL near line 2.',
      line: 2,
      detail: `Unexpected \`,\`. Expected \`KEY\`. ${rest}`,
    });
    expect(failure('CREATE TABLE t (id int,\n name varchar(10) NOT NUL)').detail).toBe(`Unexpected \`NUL\`. Expected \`NULL\`. ${rest}`);
    expect(failure('CREATE TABLE t (id int REFERENCES u (id) ON DELETE REMOVE)').detail).toBe(
      `Unexpected \`REMOVE\`. Expected \`CASCADE\`, \`RESTRICT\`, \`SET NULL\` or \`NO ACTION\`. ${rest}`,
    );
  });

  it('shows a quoted name without its backticks', () => {
    expect(failure('CREATE TABLE t (id int `oops`)').detail).toBe(`Unexpected \`oops\`. Expected \`,\` or \`)\`. ${rest}`);
  });

  it('reports a statement that ends early on its last line', () => {
    expect(failure('CREATE TABLE a (id int);\nCREATE TABLE t (\n  id int,\n  name text')).toEqual({
      message: 'Unable to parse SQL near line 4.',
      line: 4,
      detail: `The statement ends before it is complete. Check for a missing \`)\`. ${rest}`,
    });
  });

  it('reports a string or a name that never ends where it starts', () => {
    expect(failure("CREATE TABLE t (\n  a text COMMENT 'oops\n);\nCREATE TABLE u (id int);")).toEqual({
      message: 'Unable to parse SQL near line 2.',
      line: 2,
      detail: 'The string that starts here is never closed.',
    });
    expect(failure('CREATE TABLE t (\n  id int,\n  `a int\n);').detail).toBe('The quoted name that starts here is never closed.');
  });

  it('stops at the first error of the script', () => {
    expect(failure('CREATE TABLE t (id int,);\nCREATE TABLE u (id int,);').line).toBe(1);
  });

  it('reports a table without a name or a column list', () => {
    expect(failure('SELECT 1;\nCREATE TABLE (\n  id int\n);').line).toBe(2);
    expect(failure('CREATE TABLE t id int;').detail).toBe(`Unexpected \`id\`. Expected \`(\`. ${rest}`);
  });

  it('reports a broken index or constraint, on the line it is on', () => {
    expect(failure('CREATE TABLE t (id int);\n\nCREATE INDEX t_idx ON t id;').line).toBe(3);
    expect(failure('CREATE TABLE t (id int);\nALTER TABLE t\n  ADD CONSTRAINT t_pk PRIMARY (id);').line).toBe(3);
    expect(failure('CREATE TABLE t (id int);\nALTER TABLE t ADD KEY (id),;').detail).toMatch(/^The statement ends before it is complete\./);
  });

  it('reports names that are defined twice or not at all', () => {
    expect(failure('CREATE TABLE t (id int);\nCREATE TABLE t (id int);')).toEqual({ message: 'Table "t" already exists.', line: 2 });
    expect(failure('CREATE TABLE t (\n  id int,\n  ID text\n);')).toEqual({ message: 'Column "ID" already exists in t.', line: 3 });
    expect(failure('CREATE TABLE t (\n  id int,\n  PRIMARY KEY (nope)\n);')).toEqual({ message: 'Column "nope" does not exist in t.', line: 3 });
    expect(failure('CREATE TABLE t (id int PRIMARY KEY);\nALTER TABLE t ADD PRIMARY KEY (id);')).toEqual({
      message: 'Table "t" already has a primary key.',
      line: 2,
    });
    expect(failure('CREATE TABLE t (id int);\nCREATE INDEX i ON t (id);\nCREATE INDEX I ON t (id);')).toEqual({
      message: 'Index "I" already exists in t.',
      line: 3,
    });
    expect(failure('CREATE TABLE t (id int);\nALTER TABLE t MODIFY nope int;').message).toBe('Column "nope" does not exist in t.');
  });
});

describe('scripts without tables', () => {
  it('parse to nothing', () => {
    expect(parsed('')).toEqual({ ok: true, tables: [], warnings: [], skipped: 0 });
    expect(parsed('  # nothing here\n/*!40101 SET NAMES utf8 */;')).toEqual({ ok: true, tables: [], warnings: [], skipped: 0 });
    expect(parsed('SELECT 1; INSERT INTO t VALUES (1);')).toEqual({ ok: true, tables: [], warnings: [], skipped: 2 });
  });
});
