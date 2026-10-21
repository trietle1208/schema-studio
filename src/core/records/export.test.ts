import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import type { Column, Table } from '../model';
import { seedRecords } from '.';
import { recordFile, rowsInsert } from './export';

const column = (name: string, type: string, extra: Partial<Column> = {}): Column => ({ name, type, nullable: true, ...extra });
const table = (name: string, columns: Column[], extra: Partial<Table> = {}): Table => ({ name, columns, ...extra });

describe('rowsInsert', () => {
  it('writes the ecommerce users as one INSERT, with NULL and quoted text', () => {
    const users = ecommerceTables.find((t) => t.name === 'users')!;
    const rows = seedRecords(ecommerceTables, 1, 3).users.map((row, i) => (i === 0 ? { ...row, name: "O'Brien \\ path" } : row));
    const sql = rowsInsert('PostgreSQL', users, rows);
    expect(sql.startsWith('INSERT INTO users (id, email, name, avatar_url, created_at) VALUES\n')).toBe(true);
    expect(sql).toContain(`(${rows[0].id}, '${rows[0].email}', 'O''Brien \\ path'`);
    expect(sql.match(/^INSERT INTO/gm)).toHaveLength(1);
    expect(sql.endsWith(';\n')).toBe(true);
  });

  it('writes MySQL with backticks and a doubled backslash', () => {
    const users = ecommerceTables.find((t) => t.name === 'users')!;
    const rows = [{ ...seedRecords(ecommerceTables, 1, 1).users[0], name: "O'Brien \\ path" }];
    const sql = rowsInsert('MySQL', users, rows);
    expect(sql.startsWith('INSERT INTO `users` (`id`, `email`, `name`, `avatar_url`, `created_at`) VALUES\n')).toBe(true);
    expect(sql).toContain("'O''Brien \\\\ path'");
  });

  it('quotes names SQL would take for something else, and writes booleans, bytes and JSON', () => {
    const odd = table(
      'Order Lines',
      [
        column('Id', 'INT', { nullable: false, pk: true }),
        column('select', 'TEXT'),
        column('blob', 'BYTEA'),
        column('on', 'BOOLEAN', { nullable: false }),
        column('meta', 'JSONB'),
        column('n', 'BIGINT'),
      ],
      { schema: 'shop' },
    );
    const row = { Id: 1, select: "it's", blob: '\\x0AfF', on: false, meta: '{"a":1}', n: '9007199254740993' };
    const pg = rowsInsert('PostgreSQL', odd, [row]);
    expect(pg).toBe(
      'INSERT INTO shop."Order Lines" ("Id", "select", blob, "on", meta, n) VALUES\n  (1, \'it\'\'s\', \'\\x0aff\', FALSE, \'{"a":1}\', 9007199254740993);\n',
    );
    const my = rowsInsert('MySQL', { ...odd, columns: odd.columns.map((c) => (c.name === 'blob' ? { ...c, type: 'LONGBLOB' } : c)) }, [row]);
    expect(my).toBe(
      "INSERT INTO `shop`.`Order Lines` (`Id`, `select`, `blob`, `on`, `meta`, `n`) VALUES\n  (1, 'it''s', X'0aff', FALSE, '{\"a\":1}', 9007199254740993);\n",
    );
  });

  it('writes NULL for a missing value and for an empty export writes nothing', () => {
    const flags = table('flags', [column('id', 'INT', { nullable: false, pk: true }), column('note', 'TEXT')]);
    expect(rowsInsert('PostgreSQL', flags, [{ id: 1 }])).toBe('INSERT INTO flags (id, note) VALUES\n  (1, NULL);\n');
    expect(rowsInsert('PostgreSQL', flags, [])).toBe('');
  });

  it('starts another INSERT after a hundred rows', () => {
    const events = table('events', [column('id', 'INT', { nullable: false, pk: true })]);
    const rows = Array.from({ length: 101 }, (_, i) => ({ id: i + 1 }));
    const sql = rowsInsert('MySQL', events, rows);
    expect(sql.match(/^INSERT INTO/gm)).toHaveLength(2);
    expect(sql).toContain('  (100);\nINSERT INTO');
    expect(sql.endsWith('  (101);\n')).toBe(true);
  });
});

describe('recordFile', () => {
  it('writes the ecommerce users as CSV, as a JSON list, and as INSERT', () => {
    const users = ecommerceTables.find((t) => t.name === 'users')!;
    const rows = seedRecords(ecommerceTables, 4, 2).users;
    expect(recordFile('csv', 'PostgreSQL', users, rows).startsWith('id,email,name,avatar_url,created_at\n')).toBe(true);
    expect(JSON.parse(recordFile('json', 'PostgreSQL', users, rows))).toEqual(rows);
    expect(recordFile('sql', 'PostgreSQL', users, rows)).toBe(rowsInsert('PostgreSQL', users, rows));
  });
});
