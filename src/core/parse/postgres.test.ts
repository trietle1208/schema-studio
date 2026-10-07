import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { ecommerceDump, ecommerceSql, missingCommaSql } from '../fixtures/sql';
import type { Table } from '../model';
import type { ParseError, ParseResult } from './index';
import { postgresParser } from './postgres';

function parsed(sql: string): ParseResult {
  const outcome = postgresParser.parse(sql);
  if (!outcome.ok) throw new Error(`${outcome.error.message} ${outcome.error.detail ?? ''}`);
  return outcome;
}

function failure(sql: string): ParseError {
  const outcome = postgresParser.parse(sql);
  if (outcome.ok) throw new Error('The SQL was expected not to parse.');
  return outcome.error;
}

const byName = (tables: Table[]) => [...tables].sort((a, b) => a.name.localeCompare(b.name));
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

describe('the ecommerce DDL', () => {
  it('reads back as the ecommerce sample', () => {
    const result = parsed(ecommerceSql);
    expect(byName(result.tables)).toEqual(byName(ecommerceTables));
    expect(result.warnings).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it('keeps the tables in the order they are created', () => {
    expect(parsed(ecommerceSql).tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
  });
});

describe('CREATE TABLE', () => {
  it('reads names, types and NOT NULL', () => {
    const result = parsed('CREATE TABLE audit.events (id uuid NOT NULL, note text NULL, at timestamptz)');
    expect(result.tables).toEqual([
      {
        name: 'events',
        schema: 'audit',
        comment: '',
        columns: [
          { name: 'id', type: 'UUID', nullable: false },
          { name: 'note', type: 'TEXT', nullable: true },
          { name: 'at', type: 'TIMESTAMPTZ', nullable: true },
        ],
        indexes: [],
      },
    ]);
  });

  it('lower-cases names unless they are quoted', () => {
    const result = parsed('CREATE TABLE Users (ID int, "Full Name" text, "select" int)');
    expect(table(result, 'users').columns.map((c) => c.name)).toEqual(['id', 'Full Name', 'select']);
  });

  it('writes types the short way, upper case and without spaces', () => {
    const result = parsed(`CREATE TABLE t (
      a character varying(64), b numeric(10, 2), c timestamp(3) without time zone, d timestamp with time zone,
      e int, f int8, g bool, h double precision, i text[], j character(2), k public.mood, l "Mood", m time with time zone
    )`);
    expect(table(result, 't').columns.map((c) => c.type)).toEqual([
      'VARCHAR(64)',
      'NUMERIC(10,2)',
      'TIMESTAMP(3)',
      'TIMESTAMPTZ',
      'INTEGER',
      'BIGINT',
      'BOOLEAN',
      'DOUBLE PRECISION',
      'TEXT[]',
      'CHAR(2)',
      'MOOD',
      '"Mood"',
      'TIMETZ',
    ]);
  });

  it('keeps a default as it is written', () => {
    const result = parsed(`CREATE TABLE t (
      a text DEFAULT 'it''s, ok' NOT NULL,
      b jsonb NOT NULL DEFAULT '{}'::jsonb,
      c int DEFAULT (1 + 2) * 3,
      d timestamptz DEFAULT (now() AT TIME ZONE 'utc'),
      e int[] DEFAULT ARRAY[1, 2] CHECK (e IS NOT NULL),
      f text DEFAULT NULL,
      g varchar(8) DEFAULT 'x'::character varying(8) UNIQUE,
      h int DEFAULT -1
    )`);
    expect(table(result, 't').columns.map((c) => c.default)).toEqual([
      "'it''s, ok'",
      "'{}'::jsonb",
      '(1 + 2) * 3',
      "(now() AT TIME ZONE 'utc')",
      'ARRAY[1, 2]',
      'NULL',
      "'x'::character varying(8)",
      '-1',
    ]);
    expect(column(result, 't.a').nullable).toBe(false);
    expect(column(result, 't.f').nullable).toBe(true);
  });

  it('makes a primary key NOT NULL and names its index as PostgreSQL does', () => {
    const result = parsed('CREATE TABLE t (id int PRIMARY KEY, code text UNIQUE)');
    expect(column(result, 't.id')).toEqual({ name: 'id', type: 'INTEGER', nullable: false, pk: true });
    expect(column(result, 't.code')).toEqual({ name: 'code', type: 'TEXT', nullable: true, unique: true });
    expect(table(result, 't').indexes).toEqual([
      { name: 't_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 't_code_key', type: 'UNIQUE', using: 'btree', columns: ['code'] },
    ]);
  });

  it('reads table constraints, composite ones too', () => {
    const result = parsed(`CREATE TABLE memberships (
      team_id bigint, user_id bigint, role text, slug text,
      CONSTRAINT memberships_pk PRIMARY KEY (team_id, user_id),
      UNIQUE (team_id, role),
      CONSTRAINT memberships_slug_unique UNIQUE (slug)
    )`);
    const memberships = table(result, 'memberships');
    expect(memberships.columns.map((c) => [c.name, c.pk ?? false, c.nullable, c.unique ?? false])).toEqual([
      ['team_id', true, false, false],
      ['user_id', true, false, false],
      ['role', false, true, false],
      ['slug', false, true, true],
    ]);
    expect(memberships.indexes).toEqual([
      { name: 'memberships_pk', type: 'PRIMARY KEY', using: 'btree', columns: ['team_id', 'user_id'] },
      { name: 'memberships_team_id_role_key', type: 'UNIQUE', using: 'btree', columns: ['team_id', 'role'] },
      { name: 'memberships_slug_unique', type: 'UNIQUE', using: 'btree', columns: ['slug'] },
    ]);
  });

  it('treats SERIAL, identity and a sequence default as auto-increment', () => {
    const result = parsed(`CREATE TABLE t (
      a serial, b bigint GENERATED ALWAYS AS IDENTITY, c smallint GENERATED BY DEFAULT AS IDENTITY (START WITH 10),
      d integer NOT NULL DEFAULT nextval('t_d_seq'::regclass), e text DEFAULT nextval('s')
    )`);
    expect(table(result, 't').columns).toEqual([
      { name: 'a', type: 'SERIAL', nullable: false },
      { name: 'b', type: 'BIGSERIAL', nullable: false },
      { name: 'c', type: 'SMALLSERIAL', nullable: false },
      { name: 'd', type: 'SERIAL', nullable: false },
      { name: 'e', type: 'TEXT', nullable: true, default: "nextval('s')" },
    ]);
  });

  it('reads a table without columns', () => {
    const result = parsed('CREATE TABLE "Audit"."Empty" (); CREATE TABLE IF NOT EXISTS blank ( ); CREATE TABLE IF NOT EXISTS blank ();');
    expect(result.tables).toEqual([
      { name: 'Empty', schema: 'Audit', comment: '', columns: [], indexes: [] },
      { name: 'blank', schema: 'public', comment: '', columns: [], indexes: [] },
    ]);
    expect(failure('CREATE TABLE t ();\nCREATE TABLE T ();')).toEqual({ message: 'Table "t" already exists.', line: 2 });
  });

  it('skips IF NOT EXISTS for a table that is already defined', () => {
    const result = parsed('CREATE TABLE t (a int); CREATE TABLE IF NOT EXISTS t (b int);');
    expect(table(result, 't').columns.map((c) => c.name)).toEqual(['a']);
  });

  it('imports a table without the clauses that say how it is stored', () => {
    const result = parsed(`CREATE UNLOGGED TABLE audit_log (id bigint PRIMARY KEY, at date) PARTITION BY RANGE (at);
      CREATE TABLE audit_2026 PARTITION OF audit_log FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
      CREATE TABLE cache (k text PRIMARY KEY) WITH (fillfactor=70) TABLESPACE fast;`);
    expect(result.tables.map((t) => t.name)).toEqual(['audit_log', 'cache']);
    expect(result.warnings).toEqual([
      '`audit_log` uses an unsupported PARTITION BY clause and will import without it.',
      'Line 2: this CREATE TABLE statement has no column list and was skipped.',
      '`cache` uses an unsupported WITH clause and will import without it.',
    ]);
  });

  it('counts the CHECK constraints it leaves out and names the generated columns', () => {
    const result = parsed(`CREATE TABLE t (
      id int PRIMARY KEY, a int CHECK (a > 0), b int GENERATED ALWAYS AS (a * 2) STORED, CONSTRAINT positive CHECK (id > 0) NOT VALID
    )`);
    expect(result.warnings).toEqual([
      '`t.b` is a generated column; its expression was not imported.',
      '2 CHECK constraints were not imported.',
    ]);
  });

  it('warns about a table without a primary key', () => {
    expect(parsed('CREATE TABLE legacy_orders (id int)').warnings).toEqual(['`legacy_orders` has no primary key.']);
  });
});

describe('foreign keys', () => {
  const people = 'CREATE TABLE people (id int PRIMARY KEY, code text UNIQUE);';

  it('reads a reference with its ON DELETE action', () => {
    const result = parsed(`${people} CREATE TABLE pets (
      id int PRIMARY KEY,
      owner_id int REFERENCES people (id) ON DELETE SET NULL ON UPDATE CASCADE,
      vet_id int REFERENCES public.people (id) MATCH FULL ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
      sitter_id int,
      breeder_id int,
      FOREIGN KEY (sitter_id) REFERENCES people (id) ON DELETE RESTRICT NOT VALID,
      CONSTRAINT breeder FOREIGN KEY (breeder_id) REFERENCES people (id)
    )`);
    expect(table(result, 'pets').columns.map((c) => c.fk)).toEqual([
      undefined,
      { table: 'people', column: 'id', onDelete: 'SET NULL' },
      { table: 'people', column: 'id', onDelete: 'CASCADE' },
      { table: 'people', column: 'id', onDelete: 'RESTRICT' },
      // Without the clause PostgreSQL takes no action.
      { table: 'people', column: 'id', onDelete: 'NO ACTION' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('points a reference without a column at the primary key', () => {
    const result = parsed(`CREATE TABLE pets (
      id int PRIMARY KEY, owner_id int REFERENCES people ON DELETE CASCADE, other int REFERENCES public.people
    ); ${people}`);
    expect(column(result, 'pets.owner_id').fk).toEqual({ table: 'people', column: 'id', onDelete: 'CASCADE' });
    expect(column(result, 'pets.other').fk).toEqual({ table: 'people', column: 'id', onDelete: 'NO ACTION' });
  });

  it('may reference a table that is created later, or itself', () => {
    const result = parsed(`CREATE TABLE nodes (id int PRIMARY KEY, parent_id int REFERENCES nodes (id), owner int REFERENCES people (id)); ${people}`);
    expect(column(result, 'nodes.parent_id').fk?.table).toBe('nodes');
    expect(column(result, 'nodes.owner').fk?.table).toBe('people');
  });

  it('skips a foreign key to a table or column the script does not define', () => {
    const result = parsed(`${people} CREATE TABLE pets (
      id int PRIMARY KEY, owner_id int REFERENCES owners (id), vet_id int REFERENCES people (nope), shop_id int REFERENCES shops
    ); CREATE TABLE shops (a int, b int, PRIMARY KEY (a, b));`);
    expect(table(result, 'pets').columns.every((c) => !c.fk)).toBe(true);
    expect(result.warnings).toEqual([
      'Foreign key `pets.owner_id` references `owners`, which is not defined, and was skipped.',
      'Foreign key `pets.vet_id` references `people.nope`, which is not defined, and was skipped.',
      'Foreign key `pets.shop_id` references `shops`, which has no single-column primary key, and was skipped.',
    ]);
  });

  it('skips a composite foreign key', () => {
    const result = parsed(`CREATE TABLE shops (a int, b int, PRIMARY KEY (a, b));
      CREATE TABLE tills (id int PRIMARY KEY, a int, b int, FOREIGN KEY (a, b) REFERENCES shops (a, b));`);
    expect(table(result, 'tills').columns.every((c) => !c.fk)).toBe(true);
    expect(result.warnings).toEqual(['The composite foreign key on `tills` (`a`, `b`) was skipped.']);
  });

  it('imports ON DELETE SET DEFAULT as NO ACTION and says so', () => {
    const result = parsed(`${people} CREATE TABLE pets (id int PRIMARY KEY, owner_id int REFERENCES people (id) ON DELETE SET DEFAULT);`);
    expect(column(result, 'pets.owner_id').fk?.onDelete).toBe('NO ACTION');
    expect(result.warnings).toEqual(['`pets.owner_id` uses ON DELETE SET DEFAULT, imported as NO ACTION.']);
  });
});

describe('ALTER TABLE', () => {
  const base = 'CREATE TABLE users (id bigint NOT NULL, email text, team_id bigint); CREATE TABLE teams (id bigint PRIMARY KEY);';

  it('adds constraints', () => {
    const result = parsed(`${base}
      ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
      ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email), ADD FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE;`);
    expect(table(result, 'users')).toEqual({
      name: 'users',
      schema: 'public',
      comment: '',
      columns: [
        { name: 'id', type: 'BIGINT', nullable: false, pk: true },
        { name: 'email', type: 'TEXT', nullable: true, unique: true },
        { name: 'team_id', type: 'BIGINT', nullable: true, fk: { table: 'teams', column: 'id', onDelete: 'CASCADE' } },
      ],
      indexes: [
        { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
        { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      ],
    });
  });

  it('adds and alters columns', () => {
    const result = parsed(`${base}
      ALTER TABLE users ADD COLUMN phone varchar(32) DEFAULT '' NOT NULL, ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE users ALTER COLUMN email SET NOT NULL, ALTER COLUMN email SET DEFAULT 'none'::text, ALTER COLUMN team_id TYPE integer;
      ALTER TABLE users ALTER COLUMN phone DROP DEFAULT, ALTER COLUMN phone DROP NOT NULL;
      ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);`);
    expect(table(result, 'users').columns).toEqual([
      { name: 'id', type: 'BIGSERIAL', nullable: false },
      { name: 'email', type: 'TEXT', nullable: false, default: "'none'::text" },
      { name: 'team_id', type: 'INTEGER', nullable: true },
      { name: 'phone', type: 'VARCHAR(32)', nullable: true },
    ]);
  });

  it('skips what it does not import and says where', () => {
    const result = parsed(`${base}
      ALTER TABLE users OWNER TO shop;
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE users RENAME COLUMN email TO mail;
      ALTER TABLE invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);`);
    expect(table(result, 'users').columns.map((c) => c.name)).toEqual(['id', 'email', 'team_id']);
    expect(result.warnings).toEqual([
      'Line 3: this ALTER TABLE statement is not supported and was skipped.',
      'Line 4: `ALTER TABLE users RENAME COLUMN` was not imported.',
      'Line 5: ALTER TABLE names `invoices`, which is not defined, and was skipped.',
      '`users` has no primary key.',
    ]);
  });
});

describe('CREATE INDEX', () => {
  const base = 'CREATE TABLE users (id bigint PRIMARY KEY, email text, name text, bio text);';

  it('reads the name, the method and the columns', () => {
    const result = parsed(`${base}
      CREATE INDEX users_name_idx ON users (name);
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_email_unique ON ONLY public.users USING btree (email text_pattern_ops) INCLUDE (name);
      CREATE INDEX users_bio_idx ON users USING GIN (bio, name DESC NULLS LAST) NULLS NOT DISTINCT WITH (fastupdate = off);
      CREATE INDEX ON users (name, email);
      CREATE INDEX ON users (name, email);`);
    expect(indexes(result, 'users').slice(1)).toEqual([
      { name: 'users_name_idx', type: 'INDEX', using: 'btree', columns: ['name'] },
      { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      { name: 'users_bio_idx', type: 'INDEX', using: 'gin', columns: ['bio', 'name'] },
      { name: 'users_name_email_idx', type: 'INDEX', using: 'btree', columns: ['name', 'email'] },
      { name: 'users_name_email_idx1', type: 'INDEX', using: 'btree', columns: ['name', 'email'] },
    ]);
    expect(column(result, 'users.email').unique).toBe(true);
    expect(column(result, 'users.name').unique).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('skips an index on an expression and imports a partial one without its WHERE', () => {
    const result = parsed(`${base}
      CREATE INDEX users_lower_idx ON users (lower(email));
      CREATE UNIQUE INDEX users_live_email ON users (email) WHERE bio IS NOT NULL;
      CREATE INDEX nope_idx ON nope (id);`);
    expect(indexes(result, 'users').map((i) => i.name)).toEqual(['users_pkey', 'users_live_email']);
    // A partial unique index does not make the column unique.
    expect(column(result, 'users.email').unique).toBeUndefined();
    expect(result.warnings).toEqual([
      'Index `users_lower_idx` on `users` uses an expression and was skipped.',
      'Index `users_live_email` on `users` has a WHERE clause, which was not imported.',
      'Line 4: CREATE INDEX names `nope`, which is not defined, and was skipped.',
    ]);
  });
});

describe('COMMENT ON and DROP TABLE', () => {
  it('reads table and column comments', () => {
    const result = parsed(`CREATE TABLE users (id int PRIMARY KEY, email text);
      COMMENT ON TABLE public.users IS 'People who can sign in.';
      COMMENT ON COLUMN users.email IS 'It''s the login.';
      COMMENT ON INDEX users_pkey IS 'ignored';
      COMMENT ON TABLE nope IS 'ignored';`);
    expect(table(result, 'users').comment).toBe('People who can sign in.');
    expect(column(result, 'users.email').comment).toBe("It's the login.");
    expect(result.warnings).toEqual(['Line 5: COMMENT ON TABLE names `nope`, which is not defined, and was skipped.']);
    expect(result.skipped).toBe(1);
  });

  it('drops a table that was created before', () => {
    const result = parsed(`DROP TABLE IF EXISTS users CASCADE;
      CREATE TABLE users (id int PRIMARY KEY); CREATE TABLE old (id int PRIMARY KEY);
      DROP TABLE old;
      CREATE TABLE old (id int CONSTRAINT old_pkey PRIMARY KEY);`);
    expect(result.tables.map((t) => t.name)).toEqual(['users', 'old']);
  });
});

describe('a pg_dump script', () => {
  const result = parsed(ecommerceDump);

  it('imports the tables and passes over everything else', () => {
    expect(result.tables.map((t) => t.name)).toEqual(['users', 'orders']);
    // SET ×4, SELECT, CREATE FUNCTION, CREATE SEQUENCE ×2, ALTER SEQUENCE, CREATE TRIGGER.
    expect(result.skipped).toBe(10);
  });

  it('reads the columns as the sample has them', () => {
    expect(table(result, 'users')).toEqual({
      name: 'users',
      schema: 'public',
      comment: 'Registered customers. One row per account.',
      columns: [
        { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true, comment: "Lower-cased; it's the login." },
        { name: 'name', type: 'VARCHAR(255)', nullable: true },
        { name: 'avatar_url', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'now()' },
      ],
      indexes: [
        { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
        { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      ],
    });
    expect(table(result, 'orders').columns).toEqual([
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'user_id', type: 'BIGINT', nullable: false, fk: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, default: "'pending'::character varying" },
      { name: 'total', type: 'NUMERIC(12,2)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, default: 'now()' },
    ]);
    expect(indexes(result, 'orders').map((i) => i.name)).toEqual(['orders_pkey', 'orders_status_created_idx', 'orders_user_id_idx']);
  });

  it('says what it left out', () => {
    expect(result.warnings).toEqual([
      '`orders` uses an unsupported WITH clause and will import without it.',
      'Index `users_email_lower_idx` on `users` uses an expression and was skipped.',
      'Line 89: this ALTER TABLE statement is not supported and was skipped.',
      '1 CHECK constraint was not imported.',
    ]);
  });
});

describe('errors', () => {
  it('names the line a comma is missing on, and the column', () => {
    expect(failure(missingCommaSql)).toEqual({
      message: 'Unable to parse SQL near line 4.',
      line: 4,
      detail: 'Expected `,` or `)` after column definition `product_id`. Fix the statement or remove it to import the rest.',
    });
  });

  it('counts lines from the top of the script', () => {
    const sql = `-- header\n${'SET a = 1;\n'.repeat(36)}\n${missingCommaSql}`;
    expect(failure(sql).line).toBe(42);
    expect(failure(sql).message).toBe('Unable to parse SQL near line 42.');
  });

  it('reports a comma that is missing after a constraint', () => {
    const error = failure('CREATE TABLE t (\n  id int,\n  CONSTRAINT t_pk PRIMARY KEY (id)\n  name text\n);');
    expect(error.line).toBe(3);
    expect(error.detail).toBe('Expected `,` or `)` after this constraint. Fix the statement or remove it to import the rest.');
  });

  it('reports a comma too many on the line it is on', () => {
    expect(failure('CREATE TABLE t (\n  id int,\n  name text,\n);')).toEqual({
      message: 'Unable to parse SQL near line 3.',
      line: 3,
      detail: 'Unexpected `)`. Remove the `,` before it. Fix the statement or remove it to import the rest.',
    });
  });

  it('says what was expected when that is short enough to say', () => {
    expect(failure('CREATE TABLE t (\n  id int PRIMARY,\n  name text\n)')).toEqual({
      message: 'Unable to parse SQL near line 2.',
      line: 2,
      detail: 'Unexpected `,`. Expected a name. Fix the statement or remove it to import the rest.',
    });
    expect(failure('CREATE TABLE t (id int,\n name varchar(10) NOT NUL)').detail).toBe(
      'Unexpected `NUL`. Expected `NULL`. Fix the statement or remove it to import the rest.',
    );
  });

  it('reports a character that SQL has no use for', () => {
    expect(failure('CREATE TABLE t (\n  id int,\n  a$b int\n)')).toEqual({
      message: 'Unable to parse SQL near line 3.',
      line: 3,
      detail: 'Unexpected `a$b`. Fix the statement or remove it to import the rest.',
    });
  });

  it('says what backticks are, as a script full of them is MySQL', () => {
    expect(failure('\nCREATE TABLE `da_attachment` (\n  `id` int(11) NOT NULL AUTO_INCREMENT\n);')).toEqual({
      message: 'Unable to parse SQL near line 2.',
      line: 2,
      detail: 'Backticks quote names in MySQL, not in PostgreSQL. Import the script as MySQL, or quote the names with `"`.',
    });
  });

  it('reports a statement that ends early on its last line', () => {
    expect(failure('CREATE TABLE a (id int);\nCREATE TABLE t (\n  id int,\n  name text')).toEqual({
      message: 'Unable to parse SQL near line 4.',
      line: 4,
      detail: 'The statement ends before it is complete. Check for a missing `)`. Fix the statement or remove it to import the rest.',
    });
  });

  it('reports a string that never ends where it starts', () => {
    expect(failure("CREATE TABLE t (\n  a text DEFAULT 'oops\n);\nCREATE TABLE u (id int);")).toEqual({
      message: 'Unable to parse SQL near line 2.',
      line: 2,
      detail: 'The string that starts here is never closed.',
    });
  });

  it('stops at the first error of the script', () => {
    expect(failure('CREATE TABLE t (id int,);\nCREATE TABLE u (id int,);').line).toBe(1);
  });

  it('reports a table without a name or a column list', () => {
    expect(failure('SELECT 1;\nCREATE TABLE (\n  id int\n);').line).toBe(2);
    expect(failure('CREATE TABLE t id int;').detail).toMatch(/^Unexpected `id`\./);
  });

  it('reports a broken index or constraint, on the line it is on', () => {
    expect(failure('CREATE TABLE t (id int);\n\nCREATE INDEX t_idx ON t id;').line).toBe(3);
    expect(failure('CREATE TABLE t (id int);\nALTER TABLE t\n  ADD CONSTRAINT t_pk PRIMARY (id);').line).toBe(3);
  });

  it('reports names that are defined twice or not at all', () => {
    expect(failure('CREATE TABLE t (id int);\nCREATE TABLE t (id int);')).toEqual({ message: 'Table "t" already exists.', line: 2 });
    expect(failure('CREATE TABLE t (\n  id int,\n  id text\n);')).toEqual({ message: 'Column "id" already exists in t.', line: 3 });
    expect(failure('CREATE TABLE t (\n  id int,\n  PRIMARY KEY (nope)\n);')).toEqual({ message: 'Column "nope" does not exist in t.', line: 3 });
    expect(failure('CREATE TABLE t (id int PRIMARY KEY);\nALTER TABLE t ADD PRIMARY KEY (id);')).toEqual({
      message: 'Table "t" already has a primary key.',
      line: 2,
    });
    expect(failure('CREATE TABLE t (id int);\nCREATE INDEX i ON t (id);\nCREATE INDEX i ON t (id);')).toEqual({
      message: 'Index "i" already exists.',
      line: 3,
    });
    expect(failure('CREATE TABLE t (id int);\nCREATE INDEX i ON t (nope);').message).toBe('Column "nope" does not exist in t.');
  });
});

describe('scripts without tables', () => {
  it('parse to nothing', () => {
    expect(parsed('')).toEqual({ ok: true, tables: [], warnings: [], skipped: 0 });
    expect(parsed('  -- nothing here\n')).toEqual({ ok: true, tables: [], warnings: [], skipped: 0 });
    expect(parsed('SELECT 1; INSERT INTO t VALUES (1);')).toEqual({ ok: true, tables: [], warnings: [], skipped: 2 });
  });
});
