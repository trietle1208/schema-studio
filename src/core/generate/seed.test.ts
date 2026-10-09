import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { blogMysqlDump, ecommerceMysqlDump, ecommerceSql, shopVietnameseDump } from '../fixtures/sql';
import { inferredTables } from '../fixtures/testing';
import type { Column, Table } from '../model';
import { parserFor } from '../parse';
import { clampRows, generateSeed, MAX_SEED_ROWS, type SeedData, type SeedValue } from './seed';
import { columnKind, randomFrom } from './seedValues';

const column = (name: string, type: string, extra: Partial<Column> = {}): Column => ({ name, type, nullable: false, ...extra });
const table = (name: string, columns: Column[], extra: Partial<Table> = {}): Table => ({ name, columns, ...extra });

function parse(engine: string, sql: string): Table[] {
  const outcome = parserFor(engine)!.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

const rowsOf = (data: SeedData, name: string) => data.tables.find((t) => t.table.name === name)!;
/** The values of a column of a seeded table. */
const values = (data: SeedData, name: string, columnName: string): SeedValue[] => {
  const seeded = rowsOf(data, name);
  const at = seeded.columns.findIndex((c) => c.name === columnName);
  return seeded.rows.map((row) => row[at]);
};

describe('columnKind', () => {
  it('tells what a type holds, in the words of either engine', () => {
    expect(columnKind('BIGSERIAL')).toEqual({ type: 'serial' });
    expect(columnKind('BIGINT AUTO_INCREMENT')).toEqual({ type: 'serial' });
    expect(columnKind('INT UNSIGNED AUTO_INCREMENT')).toEqual({ type: 'serial' });
    expect(columnKind('smallint')).toEqual({ type: 'int', max: 32767 });
    expect(columnKind('TINYINT(1)')).toEqual({ type: 'bool' });
    expect(columnKind('TINYINT UNSIGNED')).toEqual({ type: 'int', max: 255 });
    expect(columnKind('DECIMAL(12,2)')).toEqual({ type: 'decimal', precision: 12, scale: 2 });
    expect(columnKind('NUMERIC')).toEqual({ type: 'decimal', precision: 12, scale: 2 });
    expect(columnKind('DECIMAL(10)')).toEqual({ type: 'decimal', precision: 10, scale: 0 });
    expect(columnKind('DOUBLE PRECISION')).toEqual({ type: 'float' });
    expect(columnKind('CHARACTER VARYING(80)')).toEqual({ type: 'text', max: 80 });
    expect(columnKind('CHAR')).toEqual({ type: 'text', max: 1 });
    expect(columnKind('TEXT')).toEqual({ type: 'text', max: null });
    expect(columnKind('CHAR(36)')).toEqual({ type: 'uuid' });
    expect(columnKind('UUID')).toEqual({ type: 'uuid' });
    expect(columnKind('TIMESTAMP WITH TIME ZONE')).toEqual({ type: 'timestamp' });
    expect(columnKind('DATETIME')).toEqual({ type: 'timestamp' });
    expect(columnKind('JSONB')).toEqual({ type: 'json' });
    expect(columnKind('VARBINARY(16)')).toEqual({ type: 'binary', bytes: 16 });
    expect(columnKind("ENUM('draft','it''s live')")).toEqual({ type: 'enum', options: ['draft', "it's live"] });
    expect(columnKind('TEXT[]')).toEqual({ type: 'array' });
    expect(columnKind('GEOMETRY')).toEqual({ type: 'unknown' });
  });
});

describe('randomFrom', () => {
  it('gives the same numbers for the same seed, and others for another', () => {
    const a = randomFrom(7);
    const b = randomFrom(7);
    const c = randomFrom(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('clampRows', () => {
  it('keeps the count of rows to what a seed can hold', () => {
    expect(clampRows(25)).toBe(25);
    expect(clampRows(0)).toBe(1);
    expect(clampRows(-4)).toBe(1);
    expect(clampRows(2.9)).toBe(2);
    expect(clampRows(1e9)).toBe(MAX_SEED_ROWS);
    expect(clampRows(NaN)).toBe(10);
  });
});

describe('generateSeed', () => {
  it('gives each table of the sample the rows asked for, the tables that are referenced first', () => {
    const data = generateSeed(ecommerceTables, { rows: 12 });
    const order = data.tables.map((t) => t.table.name);
    expect(order).toEqual(['users', 'orders', 'products', 'payments', 'order_items']);
    expect(data.tables.map((t) => t.rows.length)).toEqual([12, 12, 12, 12, 12]);
    expect(data.notes).toEqual([]);
    // Counting columns are written, to be referenced, and their counters are to be moved.
    expect(values(data, 'users', 'id')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rowsOf(data, 'users').counters).toEqual(['id']);
  });

  it('is the same every time for one seed, and another for another seed', () => {
    const once = generateSeed(ecommerceTables, { rows: 8, seed: 3 });
    expect(generateSeed(ecommerceTables, { rows: 8, seed: 3 })).toEqual(once);
    expect(generateSeed(ecommerceTables, { rows: 8, seed: 4 })).not.toEqual(once);
  });

  it('does not change a table when another is added', () => {
    const alone = generateSeed([ecommerceTables[0]], { rows: 6 });
    const withOthers = generateSeed(ecommerceTables, { rows: 6 });
    expect(rowsOf(withOthers, 'users').rows).toEqual(rowsOf(alone, 'users').rows);
  });

  it('references rows that exist', () => {
    const data = generateSeed(ecommerceTables, { rows: 30 });
    const ids = (name: string) => new Set(values(data, name, 'id'));
    expect(values(data, 'orders', 'user_id').every((id) => ids('users').has(id as number))).toBe(true);
    expect(values(data, 'order_items', 'order_id').every((id) => ids('orders').has(id as number))).toBe(true);
    expect(values(data, 'order_items', 'product_id').every((id) => ids('products').has(id as number))).toBe(true);
    expect(values(data, 'payments', 'order_id').every((id) => ids('orders').has(id as number))).toBe(true);
    // Every parent is not left out: the rows spread over them.
    expect(new Set(values(data, 'orders', 'user_id')).size).toBeGreaterThan(5);
  });

  it('keeps unique columns unique, however many rows', () => {
    const data = generateSeed(ecommerceTables, { rows: 400 });
    for (const [name, columnName] of [['users', 'email'], ['products', 'sku'], ['users', 'id']] as const) {
      const all = values(data, name, columnName);
      expect(new Set(all).size).toBe(all.length);
    }
    expect(values(data, 'users', 'email').every((email) => /^[a-z.]+\d+(-\d+)?@example\.com$/.test(email as string))).toBe(true);
  });

  it('writes values that fit the types and read like their column names', () => {
    const data = generateSeed(ecommerceTables, { rows: 50 });
    const totals = values(data, 'orders', 'total') as number[];
    expect(totals.every((n) => n >= 5 && n <= 500 && Math.abs(Math.round(n * 100) - n * 100) < 1e-6)).toBe(true);
    expect(new Set(values(data, 'orders', 'status'))).toEqual(new Set(['active', 'pending', 'completed', 'cancelled']));
    expect((values(data, 'order_items', 'quantity') as number[]).every((n) => Number.isInteger(n) && n >= 1 && n <= 20)).toBe(true);
    expect(values(data, 'products', 'sku')[0]).toBe('SKU-0001');
    expect(values(data, 'products', 'name')[2]).toBe('Product 3');
    expect(values(data, 'users', 'created_at').every((v) => /^202[45]-\d\d-\d\d \d\d:\d\d:\d\d$/.test(v as string))).toBe(true);
    expect(values(data, 'users', 'avatar_url').filter((v) => v !== null).every((v) => /^https:\/\/example\.com\/avatar\/\d+$/.test(v as string))).toBe(true);
  });

  it('leaves columns that may be empty empty now and then, and the others never', () => {
    const data = generateSeed(ecommerceTables, { rows: 200 });
    expect(values(data, 'payments', 'paid_at').some((v) => v === null)).toBe(true);
    expect(values(data, 'payments', 'paid_at').some((v) => v !== null)).toBe(true);
    for (const { table: t, columns, rows } of data.tables) {
      columns.forEach((c, i) => {
        if (!c.nullable) expect(rows.every((row) => row[i] !== null), `${t.name}.${c.name}`).toBe(true);
      });
    }
  });

  it('cuts text to the length of its column', () => {
    const data = generateSeed([table('notes', [column('id', 'SERIAL', { pk: true }), column('title', 'VARCHAR(5)'), column('body', 'CHAR(2)'), column('code', 'VARCHAR(4)', { unique: true })])], { rows: 40 });
    expect((values(data, 'notes', 'title') as string[]).every((v) => v.length <= 5)).toBe(true);
    expect((values(data, 'notes', 'body') as string[]).every((v) => v.length <= 2)).toBe(true);
    const codes = values(data, 'notes', 'code') as string[];
    expect(codes.every((v) => v.length <= 4)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps decimals within their precision and scale', () => {
    const data = generateSeed([table('prices', [column('id', 'INT', { pk: true }), column('price', 'DECIMAL(4,1)'), column('weight', 'DECIMAL(3)'), column('ratio', 'DOUBLE')])], { rows: 200 });
    expect((values(data, 'prices', 'price') as number[]).every((n) => n < 1000 && Math.abs(n * 10 - Math.round(n * 10)) < 1e-6)).toBe(true);
    expect((values(data, 'prices', 'weight') as number[]).every((n) => Number.isInteger(n) && n < 1000)).toBe(true);
    expect((values(data, 'prices', 'ratio') as number[]).every((n) => Number.isFinite(n))).toBe(true);
  });

  it('writes the other types in the form the engines read', () => {
    const data = generateSeed(
      [
        table('misc', [
          column('id', 'UUID', { pk: true }),
          column('active', 'BOOLEAN'),
          column('flag', 'TINYINT(1)'),
          column('settings', 'JSONB'),
          column('birthday', 'DATE'),
          column('starts_at', 'TIME'),
          column('blob', 'BYTEA'),
          column('level', "ENUM('low','high')"),
          column('tags', 'TEXT[]'),
          column('ip', 'INET'),
          column('size', 'SMALLINT'),
        ]),
      ],
      { rows: 20 },
    );
    const row = (n: string) => values(data, 'misc', n);
    expect(row('id').every((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v as string))).toBe(true);
    expect(row('active').every((v) => typeof v === 'boolean')).toBe(true);
    expect(row('flag').every((v) => typeof v === 'boolean')).toBe(true);
    expect(JSON.parse(row('settings')[0] as string)).toEqual({ sample: true, n: 1 });
    expect(row('birthday').every((v) => /^(19[6-9]\d|200\d)-\d\d-\d\d$/.test(v as string))).toBe(true);
    expect(row('starts_at').every((v) => /^\d\d:\d\d:\d\d$/.test(v as string))).toBe(true);
    expect(row('blob')[0]).toEqual({ kind: 'binary', hex: expect.stringMatching(/^[0-9a-f]{16}$/) });
    expect(row('level').every((v) => v === 'low' || v === 'high')).toBe(true);
    expect(row('tags')[0]).toBe('{}');
    expect(row('ip').every((v) => /^10\.\d+\.\d+\.\d+$/.test(v as string))).toBe(true);
    expect((row('size') as number[]).every((n) => n >= 1 && n <= 1000)).toBe(true);
  });

  it('numbers the rows of a column that has to be unique, within what its type holds', () => {
    const data = generateSeed([table('tiny', [column('id', 'TINYINT UNSIGNED', { pk: true }), column('slot', 'SMALLINT', { unique: true })])], { rows: 300 });
    expect(values(data, 'tiny', 'id').slice(0, 3)).toEqual([1, 2, 3]);
    // 255 is the last number a TINYINT UNSIGNED holds: rows beyond it cannot be told apart, so they are not written.
    expect(rowsOf(data, 'tiny').rows.length).toBeLessThanOrEqual(300);
    const ids = values(data, 'tiny', 'id');
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...(ids as number[]))).toBeLessThanOrEqual(255);
  });

  it('keeps the pairs of a composite key unique', () => {
    const tables = [
      table('students', [column('id', 'INT', { pk: true })]),
      table('courses', [column('id', 'INT', { pk: true })]),
      table('enrolments', [
        column('student_id', 'INT', { pk: true, fk: { table: 'students', column: 'id' } }),
        column('course_id', 'INT', { pk: true, fk: { table: 'courses', column: 'id' } }),
        column('grade', 'SMALLINT', { nullable: true }),
      ]),
    ];
    const data = generateSeed(tables, { rows: 3 });
    expect(rowsOf(data, 'students').rows).toHaveLength(3);
    const pairs = rowsOf(data, 'enrolments').rows.map((r) => `${r[0]}-${r[1]}`);
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs).size).toBe(3);

    expect(data.notes).toEqual([]);
  });

  it('keeps a unique index of several columns unique', () => {
    const tables = [
      table(
        'memberships',
        [column('id', 'SERIAL', { pk: true }), column('team', 'SMALLINT'), column('slot', 'SMALLINT')],
        { indexes: [{ name: 'memberships_team_slot', type: 'UNIQUE', using: 'btree', columns: ['team', 'slot'] }] },
      ),
    ];
    const data = generateSeed(tables, { rows: 200 });
    const pairs = rowsOf(data, 'memberships').rows.map((r) => `${r[1]}-${r[2]}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('says so when a table gets fewer rows than asked', () => {
    const tables = [table('flags', [column('id', 'SERIAL', { pk: true }), column('on', 'BOOLEAN', { unique: true })])];
    const data = generateSeed(tables, { rows: 10 });
    expect(rowsOf(data, 'flags').rows.length).toBeLessThanOrEqual(2);
    expect(data.notes).toEqual([`Table flags got ${rowsOf(data, 'flags').rows.length} of 10 rows: no more values could be found that stay unique.`]);
  });

  it('lets a table reference itself: a tree whose first row is a root, or the row itself when it cannot be empty', () => {
    const optional = generateSeed([table('categories', [column('id', 'SERIAL', { pk: true }), column('parent_id', 'INT', { nullable: true, fk: { table: 'categories', column: 'id' } })])], { rows: 40 });
    const parents = values(optional, 'categories', 'parent_id');
    expect(parents[0]).toBeNull();
    expect(parents.some((v) => v === null)).toBe(true);
    // A row only references one made before it: the foreign keys can be created row by row.
    expect(parents.every((v, i) => v === null || (v as number) < i + 1)).toBe(true);

    const required = generateSeed([table('staff', [column('id', 'SERIAL', { pk: true }), column('boss_id', 'INT', { fk: { table: 'staff', column: 'id' } })])], { rows: 5 });
    expect(values(required, 'staff', 'boss_id')[0]).toBe(1);
    expect(values(required, 'staff', 'boss_id').every((v, i) => (v as number) <= i + 1)).toBe(true);
  });

  it('breaks a cycle where a column may be empty, and leaves out a table it cannot', () => {
    const optional = [
      table('authors', [column('id', 'SERIAL', { pk: true }), column('favourite_post', 'INT', { nullable: true, fk: { table: 'posts', column: 'id' } })]),
      table('posts', [column('id', 'SERIAL', { pk: true }), column('author_id', 'INT', { fk: { table: 'authors', column: 'id' } })]),
    ];
    const data = generateSeed(optional, { rows: 4 });
    expect(data.tables.map((t) => t.table.name)).toEqual(['authors', 'posts']);
    expect(values(data, 'authors', 'favourite_post')).toEqual([null, null, null, null]);

    const required = [
      table('a', [column('id', 'SERIAL', { pk: true }), column('b_id', 'INT', { fk: { table: 'b', column: 'id' } })]),
      table('b', [column('id', 'SERIAL', { pk: true }), column('a_id', 'INT', { fk: { table: 'a', column: 'id' } })]),
    ];
    const none = generateSeed(required, { rows: 4 });
    expect(none.tables).toEqual([]);
    expect(none.notes[0]).toBe('Table a was left without rows: a.b_id references b.id, which has no rows to reference.');
  });

  it('leaves out a table whose parent has no rows, and says why', () => {
    const tables = [
      table('empty_parent', [column('id', 'SERIAL', { pk: true }), column('a', 'INT', { fk: { table: 'empty_parent', column: 'id' } })]),
      table('child', [column('id', 'SERIAL', { pk: true }), column('parent_id', 'INT', { fk: { table: 'empty_parent', column: 'id' } })]),
      table('orphan', [column('id', 'SERIAL', { pk: true }), column('ghost_id', 'INT', { fk: { table: 'nowhere', column: 'id' } })]),
    ];
    const data = generateSeed(tables, { rows: 3 });
    expect(data.tables.map((t) => t.table.name)).toEqual(['empty_parent', 'child']);
    expect(data.notes).toEqual(["Table orphan was left without rows: orphan.ghost_id references nowhere.id, which has no rows to reference."]);
  });

  it('writes updated_at after created_at of the same row', () => {
    const data = generateSeed([table('posts', [column('id', 'SERIAL', { pk: true }), column('created_at', 'TIMESTAMP'), column('updated_at', 'TIMESTAMP')])], { rows: 60 });
    const created = values(data, 'posts', 'created_at') as string[];
    const updated = values(data, 'posts', 'updated_at') as string[];
    expect(updated.every((v, i) => v >= created[i])).toBe(true);
  });

  it('uses a deleted_at that may be empty as empty', () => {
    const data = generateSeed([table('docs', [column('id', 'SERIAL', { pk: true }), column('deleted_at', 'TIMESTAMP', { nullable: true })])], { rows: 30 });
    expect(values(data, 'docs', 'deleted_at').every((v) => v === null)).toBe(true);
  });

  it('says what it cannot make a value for', () => {
    const tables = [table('shapes', [column('id', 'SERIAL', { pk: true }), column('outline', 'GEOMETRY'), column('spare', 'GEOMETRY', { nullable: true }), column('area', 'GEOMETRY', { default: 'NULL' })])];
    const data = generateSeed(tables, { rows: 2 });
    expect(data.notes).toEqual(["shapes.outline has the type GEOMETRY, which has no sample value: it gets the text 'sample'."]);
  });

  it('leaves out the columns that have no name and the tables that have no column', () => {
    const data = generateSeed([table('half', [column('id', 'SERIAL', { pk: true }), column('', 'TEXT')]), table('bare', [])], { rows: 2 });
    expect(data.tables.map((t) => [t.table.name, t.columns.map((c) => c.name)])).toEqual([['half', ['id']]]);
  });

  it('uses the foreign keys that were only inferred, so the rows still match', () => {
    const data = generateSeed(inferredTables(), { rows: 20 });
    const users = new Set(values(data, 'users', 'id'));
    expect(values(data, 'orders', 'user_id').every((id) => users.has(id as number))).toBe(true);
  });

  it('seeds the tables of the dumps: names of people, no more rows than asked, parents first', () => {
    for (const [engine, sql] of [['PostgreSQL', ecommerceSql], ['MySQL', ecommerceMysqlDump], ['MySQL', blogMysqlDump], ['MySQL', shopVietnameseDump]] as const) {
      const tables = parse(engine, sql);
      const data = generateSeed(tables, { rows: 15 });
      expect(data.tables.length).toBeGreaterThan(0);
      const position = new Map(data.tables.map((t, i) => [t.table.name, i]));
      for (const { table: t, rows, columns } of data.tables) {
        expect(rows.length).toBeLessThanOrEqual(15);
        columns.forEach((c, i) => {
          if (!c.nullable) expect(rows.every((row) => row[i] !== null), `${t.name}.${c.name}`).toBe(true);
          if (c.fk && c.fk.table !== t.name && position.has(c.fk.table)) expect(position.get(c.fk.table)).toBeLessThan(position.get(t.name)!);
        });
      }
    }
    const blog = generateSeed(parse('MySQL', blogMysqlDump), { rows: 3 });
    expect(blog.notes).toEqual([]);
  });
});
