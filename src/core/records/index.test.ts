import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { blogMysqlDump, ecommerceMysqlDump, ecommerceSql } from '../fixtures/sql';
import type { Table } from '../model';
import { parserFor } from '../parse';
import {
  DEFAULT_RECORD_ROWS,
  pageOf,
  searchRows,
  seedRecords,
  sortRows,
  textColumns,
  type RecordsByTable,
  type Row,
} from '.';

function parse(engine: string, sql: string): Table[] {
  const outcome = parserFor(engine)!.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

const named = (tables: readonly Table[], name: string) => tables.find((t) => t.name === name)!;

/** Every foreign key of `records` that points at a row that is not there. */
function brokenKeys(tables: readonly Table[], records: RecordsByTable): string[] {
  const broken: string[] = [];
  for (const table of tables) {
    for (const column of table.columns) {
      if (!column.fk || !records[column.fk.table]) continue;
      const target = column.fk.column;
      const ids = new Set(records[column.fk.table].map((r) => r[target]));
      for (const row of records[table.name]) {
        const value = row[column.name];
        if (value !== null && !ids.has(value)) broken.push(`${table.name}.${column.name} = ${value}`);
      }
    }
  }
  return broken;
}

describe('seedRecords', () => {
  it('fills every table of the ecommerce sample, rows keyed by column name', () => {
    const records = seedRecords(ecommerceTables, 1);

    expect(Object.keys(records)).toEqual(ecommerceTables.map((t) => t.name));
    for (const table of ecommerceTables) {
      expect(records[table.name]).toHaveLength(DEFAULT_RECORD_ROWS);
      for (const row of records[table.name]) expect(Object.keys(row)).toEqual(table.columns.map((c) => c.name));
    }
    expect(records.users[0]).toEqual({
      id: 1,
      email: expect.stringMatching(/@example\.com$/),
      name: expect.any(String),
      avatar_url: expect.any(String),
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
    });
  });

  it('makes foreign keys that point at rows that exist', () => {
    const records = seedRecords(ecommerceTables, 1);
    expect(brokenKeys(ecommerceTables, records)).toEqual([]);
    expect(new Set(records.orders.map((r) => r.user_id)).size).toBeGreaterThan(1);
  });

  it('gives the same rows for the same seed, and other rows for another', () => {
    expect(seedRecords(ecommerceTables, 7)).toEqual(seedRecords(ecommerceTables, 7));
    expect(seedRecords(ecommerceTables, 7).users).not.toEqual(seedRecords(ecommerceTables, 8).users);
  });

  it('takes the number of rows asked for', () => {
    const records = seedRecords(ecommerceTables, 1, 3);
    expect(Object.values(records).map((rows) => rows.length)).toEqual([3, 3, 3, 3, 3]);
  });

  it('keeps unique values apart and leaves NULL only where a column may be empty', () => {
    const records = seedRecords(ecommerceTables, 1, 50);
    expect(new Set(records.users.map((r) => r.email)).size).toBe(50);
    expect(new Set(records.products.map((r) => r.sku)).size).toBe(50);
    for (const table of ecommerceTables) {
      for (const column of table.columns.filter((c) => !c.nullable || c.pk)) {
        expect(records[table.name].filter((r) => r[column.name] === null), `${table.name}.${column.name}`).toEqual([]);
      }
    }
  });

  it.each([
    ['PostgreSQL', ecommerceSql, true],
    ['MySQL', ecommerceMysqlDump, true],
    ['MySQL', blogMysqlDump, false],
  ])('matches the foreign keys of a %s dump', (engine, sql, hasKeys) => {
    const tables = parse(engine, sql);
    const records = seedRecords(tables, 3, 40);
    expect(brokenKeys(tables, records)).toEqual([]);
    expect(tables.some((t) => t.columns.some((c) => c.fk))).toBe(hasKeys);
    for (const table of tables) expect(records[table.name].length, table.name).toBeGreaterThan(0);
  });

  it('gives a table that could not be filled an empty list, not a missing key', () => {
    const tables: Table[] = [
      { name: 'owners', columns: [{ name: 'id', type: 'INT', pk: true }] },
      { name: 'pets', columns: [{ name: 'id', type: 'INT', pk: true }, { name: 'owner_id', type: 'INT', fk: { table: 'owners', column: 'id' } }] },
    ];
    const records = seedRecords(tables, 1, 5);
    expect(records.owners).toHaveLength(5);
    expect(records.pets).toHaveLength(5);
    expect(Object.keys(seedRecords([], 1))).toEqual([]);
  });

  it('writes bytes as \\x hex', () => {
    const tables: Table[] = [{ name: 'blobs', columns: [{ name: 'id', type: 'INT', pk: true }, { name: 'data', type: 'BYTEA' }] }];
    const [row] = seedRecords(tables, 1, 1).blobs;
    expect(row.data).toMatch(/^\\x[0-9a-f]+$/);
  });
});

const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('pageOf', () => {
  it('cuts a page and says where it sits', () => {
    const page = pageOf(rows(120), { page: 2, size: 50 });
    expect(page).toMatchObject({ page: 2, size: 50, pages: 3, total: 120, from: 51, to: 100 });
    expect(page.rows.map((r) => r.id)).toEqual(Array.from({ length: 50 }, (_, i) => 51 + i));
  });

  it('has a last page that is shorter', () => {
    const page = pageOf(rows(120), { page: 3, size: 50 });
    expect(page).toMatchObject({ page: 3, pages: 3, from: 101, to: 120 });
    expect(page.rows).toHaveLength(20);
  });

  it('has a full last page when the rows divide evenly, and no page after it', () => {
    expect(pageOf(rows(100), { page: 2, size: 50 })).toMatchObject({ pages: 2, from: 51, to: 100 });
    expect(pageOf(rows(100), { page: 3, size: 50 })).toMatchObject({ page: 2, pages: 2, from: 51, to: 100 });
  });

  it('puts a page that is out of range on the nearest one', () => {
    expect(pageOf(rows(120), { page: 9, size: 50 })).toMatchObject({ page: 3, from: 101 });
    expect(pageOf(rows(120), { page: 0, size: 50 })).toMatchObject({ page: 1, from: 1 });
    expect(pageOf(rows(120), { page: -4, size: 50 }).page).toBe(1);
    expect(pageOf(rows(120), { page: Number.NaN, size: 50 }).page).toBe(1);
    expect(pageOf(rows(120), { page: 2.9, size: 50 }).page).toBe(2);
  });

  it('has one empty page for no rows', () => {
    expect(pageOf([], { page: 1, size: 50 })).toEqual({ rows: [], page: 1, size: 50, pages: 1, total: 0, from: 0, to: 0 });
    expect(pageOf([], { page: 5, size: 50 }).page).toBe(1);
  });

  it('holds a single row, and fewer rows than a page', () => {
    expect(pageOf(rows(1), { page: 1, size: 25 })).toMatchObject({ pages: 1, total: 1, from: 1, to: 1 });
    expect(pageOf(rows(24), { page: 1, size: 25 })).toMatchObject({ pages: 1, from: 1, to: 24 });
    expect(pageOf(rows(26), { page: 1, size: 25 })).toMatchObject({ pages: 2, to: 25 });
  });

  it('keeps a size that is no use at one row, or falls back to the default for one that is no number', () => {
    expect(pageOf(rows(3), { page: 2, size: 0 })).toMatchObject({ size: 1, pages: 3, rows: [{ id: 2 }] });
    expect(pageOf(rows(80), { page: 1, size: Number.NaN })).toMatchObject({ size: 50, pages: 2 });
  });

  it('does not change the rows it is given', () => {
    const all = rows(10);
    pageOf(all, { page: 1, size: 3 });
    expect(all).toEqual(rows(10));
  });
});

describe('sortRows', () => {
  const users = named(ecommerceTables, 'users');
  const people: Row[] = [
    { id: 1, email: 'c@x.com', name: 'Carol', avatar_url: null, created_at: '2025-03-01 10:00:00' },
    { id: 2, email: 'a@x.com', name: null, avatar_url: 'https://x/2', created_at: '2024-01-01 10:00:00' },
    { id: 3, email: 'b@x.com', name: 'Bob', avatar_url: null, created_at: '2025-03-01 09:00:00' },
    { id: 4, email: 'd@x.com', name: null, avatar_url: null, created_at: '2023-12-31 23:59:59' },
    { id: 5, email: 'e@x.com', name: 'alice', avatar_url: 'https://x/5', created_at: '2025-03-01 10:00:00' },
  ];
  const ids = (sorted: Row[]) => sorted.map((r) => r.id);

  it('puts NULL last going up and last going down', () => {
    expect(ids(sortRows(people, { column: 'name', dir: 'asc' }, users))).toEqual([3, 1, 5, 2, 4]);
    expect(ids(sortRows(people, { column: 'name', dir: 'desc' }, users))).toEqual([5, 1, 3, 2, 4]);
  });

  it('keeps rows with equal values in the order they had, in both directions', () => {
    // 1 and 5 share a created_at; 1 comes first in the input.
    expect(ids(sortRows(people, { column: 'created_at', dir: 'asc' }, users))).toEqual([4, 2, 3, 1, 5]);
    expect(ids(sortRows(people, { column: 'created_at', dir: 'desc' }, users))).toEqual([1, 5, 3, 2, 4]);
    expect(ids(sortRows(people, { column: 'avatar_url', dir: 'asc' }, users))).toEqual([2, 5, 1, 3, 4]);
    expect(ids(sortRows(people, { column: 'avatar_url', dir: 'desc' }, users))).toEqual([5, 2, 1, 3, 4]);
  });

  it('sorts numbers as numbers, not as text', () => {
    const many: Row[] = [{ id: 10 }, { id: 9 }, { id: 100 }, { id: 2 }];
    expect(ids(sortRows(many, { column: 'id', dir: 'asc' }, users))).toEqual([2, 9, 10, 100]);
    expect(ids(sortRows(many, { column: 'id', dir: 'desc' }, users))).toEqual([100, 10, 9, 2]);
  });

  it('reads a number kept as text in a numeric column as a number', () => {
    const decimals: Row[] = [{ total: '10.50' }, { total: '9.99' }, { total: null }, { total: '100.00' }];
    expect(sortRows(decimals, { column: 'total', dir: 'asc' }, named(ecommerceTables, 'orders')).map((r) => r.total)).toEqual(['9.99', '10.50', '100.00', null]);
  });

  it('puts text in code unit order, so that capitals come before lower case', () => {
    expect(sortRows(people, { column: 'name', dir: 'asc' }, users).map((r) => r.name).slice(0, 3)).toEqual(['Bob', 'Carol', 'alice']);
  });

  it('orders booleans false before true', () => {
    const flags: Row[] = [{ ok: true }, { ok: null }, { ok: false }];
    const table = { columns: [{ name: 'ok', type: 'BOOLEAN' }] };
    expect(sortRows(flags, { column: 'ok', dir: 'asc' }, table).map((r) => r.ok)).toEqual([false, true, null]);
  });

  it('returns a copy and keeps the order for no sort or an unknown column', () => {
    const copy = sortRows(people, null, users);
    expect(copy).toEqual(people);
    expect(copy).not.toBe(people);
    expect(ids(sortRows(people, { column: 'nope', dir: 'asc' }, users))).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not change the rows it is given', () => {
    const before = structuredClone(people);
    sortRows(people, { column: 'name', dir: 'desc' }, users);
    expect(people).toEqual(before);
  });

  it('sorts the seeded rows with NULLs at the end', () => {
    const records = seedRecords(ecommerceTables, 1, 200);
    const sorted = sortRows(records.payments, { column: 'paid_at', dir: 'asc' }, named(ecommerceTables, 'payments'));
    const values = sorted.map((r) => r.paid_at);
    expect(values.some((v) => v === null)).toBe(true);
    const firstNull = values.indexOf(null);
    expect(values.slice(firstNull).every((v) => v === null)).toBe(true);
    const filled = values.slice(0, firstNull) as string[];
    expect(filled).toEqual([...filled].sort());
  });
});

describe('searchRows', () => {
  const users = named(ecommerceTables, 'users');
  const people: Row[] = [
    { id: 12, email: 'an@example.com', name: 'Nguyễn Văn An', avatar_url: null, created_at: '2025-03-01 10:00:00' },
    { id: 2, email: 'bao@example.com', name: 'Đặng Bảo', avatar_url: 'https://cdn.example.com/avatars/an.png', created_at: '2024-01-01 10:00:00' },
    { id: 3, email: 'carol@example.org', name: null, avatar_url: null, created_at: '2025-12-24 08:00:00' },
  ];
  const ids = (found: Row[]) => found.map((r) => r.id);

  it('finds the query in any text column, ignoring case', () => {
    expect(ids(searchRows(people, 'EXAMPLE.ORG', users))).toEqual([3]);
    expect(ids(searchRows(people, 'an', users))).toEqual([12, 2]);
    expect(ids(searchRows(people, 'avatars/', users))).toEqual([2]);
  });

  it('ignores accents, in the query and in the rows', () => {
    expect(ids(searchRows(people, 'nguyen van', users))).toEqual([12]);
    expect(ids(searchRows(people, 'Nguyễn', users))).toEqual([12]);
    expect(ids(searchRows(people, 'dang bao', users))).toEqual([2]);
    expect(ids(searchRows(people, 'đặng', users))).toEqual([2]);
  });

  it('looks only at text columns: numbers and timestamps are not searched', () => {
    expect(textColumns(users).map((c) => c.name)).toEqual(['email', 'name', 'avatar_url']);
    expect(searchRows(people, '2025', users)).toEqual([]);
    expect(searchRows(people, '12', users)).toEqual([]);
  });

  it('does not take NULL for the text "null"', () => {
    expect(searchRows(people, 'null', users)).toEqual([]);
  });

  it('keeps every row for a blank query, as a copy', () => {
    for (const blank of ['', '   ']) {
      const found = searchRows(people, blank, users);
      expect(found).toEqual(people);
      expect(found).not.toBe(people);
    }
  });

  it('trims the query but keeps the spaces inside it', () => {
    expect(ids(searchRows(people, '  van an ', users))).toEqual([12]);
    expect(searchRows(people, 'van  an', users)).toEqual([]);
  });

  it('finds nothing in no rows, and nothing for a text that is nowhere', () => {
    expect(searchRows([], 'a', users)).toEqual([]);
    expect(searchRows(people, 'zzz', users)).toEqual([]);
  });

  it('searches uuid and enum columns too', () => {
    const table = {
      columns: [
        { name: 'id', type: 'UUID' },
        { name: 'kind', type: "ENUM('draft','live')" },
        { name: 'n', type: 'INT' },
      ],
    };
    const found = searchRows([{ id: 'ab12-cd', kind: 'draft', n: 1 }, { id: 'ff00', kind: 'live', n: 2 }], 'LIVE', table);
    expect(found.map((r) => r.n)).toEqual([2]);
    expect(searchRows([{ id: 'ab12-cd', kind: 'draft', n: 1 }], 'ab12', table)).toHaveLength(1);
  });

  it('searches the seeded users by their email', () => {
    const records = seedRecords(ecommerceTables, 1, 30);
    const email = records.users[4].email as string;
    expect(searchRows(records.users, email.toUpperCase(), users)).toEqual([records.users[4]]);
  });
});
