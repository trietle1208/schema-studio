import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { ecommerceMysqlDump } from '../fixtures/sql';
import type { Column, Table } from '../model';
import { parserFor } from '../parse';
import { convertTables } from './convert';
import { generateSeed } from './seed';
import { generateSeedScript, generateSeedSql, SEED_ENGINES, seedBlocksOf } from './seedSql';

const column = (name: string, type: string, extra: Partial<Column> = {}): Column => ({ name, type, nullable: false, ...extra });
const table = (name: string, columns: Column[], extra: Partial<Table> = {}): Table => ({ name, columns, ...extra });

describe('generateSeedSql', () => {
  it('writes one INSERT for each table of the sample, parents first, in a transaction, and moves the counters', () => {
    const sql = generateSeedSql('PostgreSQL', ecommerceTables, { rows: 3, header: ['ecommerce · v2 · PostgreSQL', 'sample data'] });
    expect(sql.startsWith('-- ecommerce · v2 · PostgreSQL\n-- sample data\n\nBEGIN;\n\nINSERT INTO users (id, email, name, avatar_url, created_at) VALUES\n')).toBe(true);
    expect(sql.endsWith('\nCOMMIT;\n')).toBe(true);
    expect([...sql.matchAll(/^INSERT INTO (\w+)/gm)].map((m) => m[1])).toEqual(['users', 'orders', 'products', 'payments', 'order_items']);
    expect(sql).toContain("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));");
    expect(sql.match(/setval/g)).toHaveLength(5);
    // Three rows to a table: two commas and a semicolon at the end of the statement.
    const users = sql.slice(sql.indexOf('INSERT INTO users'), sql.indexOf('INSERT INTO orders'));
    expect(users.trimEnd().split('\n')).toHaveLength(4);
    expect(users.trimEnd().endsWith(');')).toBe(true);
    expect(users).toMatch(/\n {2}\(1, 'emma\.le1@example\.com'/);
  });

  it('is the same every time for one seed', () => {
    const once = generateSeedSql('PostgreSQL', ecommerceTables, { rows: 5, seed: 9 });
    expect(generateSeedSql('PostgreSQL', ecommerceTables, { rows: 5, seed: 9 })).toBe(once);
    expect(generateSeedSql('PostgreSQL', ecommerceTables, { rows: 5, seed: 10 })).not.toBe(once);
  });

  it('writes MySQL with backticks, and no transaction or counters', () => {
    const sql = generateSeedSql('MySQL', convertTables(ecommerceTables, 'PostgreSQL', 'MySQL'), { rows: 2 });
    expect(sql.startsWith('INSERT INTO `users` (`id`, `email`, `name`, `avatar_url`, `created_at`) VALUES\n')).toBe(true);
    expect(sql).not.toMatch(/BEGIN|COMMIT|setval/);
  });

  it('quotes the names and the text that SQL would take for something else', () => {
    const odd = table('Order Lines', [column('Id', 'SERIAL', { pk: true }), column('select', 'TEXT'), column('o\'brien', 'VARCHAR(40)', { nullable: true })], { schema: 'shop' });
    const pg = generateSeedSql('PostgreSQL', [odd], { rows: 1 });
    expect(pg).toContain('INSERT INTO shop."Order Lines" ("Id", "select", "o\'brien") VALUES');
    expect(pg).toContain(`SELECT setval(pg_get_serial_sequence('shop."Order Lines"', 'Id'), (SELECT MAX("Id") FROM shop."Order Lines"));`);
    const my = generateSeedSql('MySQL', [{ ...odd, columns: odd.columns.map((c) => (c.name === 'Id' ? { ...c, type: 'INT AUTO_INCREMENT' } : c)) }], { rows: 1 });
    expect(my).toContain('INSERT INTO `shop`.`Order Lines` (`Id`, `select`, `o\'brien`) VALUES');
  });

  it('doubles the quotes of text, and the backslashes of MySQL', () => {
    const { tables } = generateSeed([table('quotes', [column('id', 'INT', { pk: true }), column('note', 'TEXT')])], { rows: 1 });
    tables[0].rows[0][1] = "it's a \\ test";
    const data = { tables, notes: [] };
    expect(seedBlocksOf(data, 'PostgreSQL')[1].lines[1]).toBe("  (1, 'it''s a \\ test');");
    expect(seedBlocksOf(data, 'MySQL')[0].lines[1]).toBe("  (1, 'it''s a \\\\ test');");
  });

  it('writes booleans, empty values, defaults and bytes as each engine reads them', () => {
    const { tables } = generateSeed([table('mixed', [column('id', 'INT', { pk: true }), column('a', 'BOOLEAN'), column('b', 'TEXT', { nullable: true }), column('c', 'BYTEA'), column('d', 'TEXT')])], { rows: 1 });
    tables[0].rows[0] = [1, true, null, { kind: 'binary', hex: '0aff' }, { kind: 'default' }];
    const data = { tables, notes: [] };
    expect(seedBlocksOf(data, 'PostgreSQL')[1].lines[1]).toBe("  (1, TRUE, NULL, '\\x0aff', DEFAULT);");
    expect(seedBlocksOf(data, 'MySQL')[0].lines[1]).toBe("  (1, TRUE, NULL, X'0aff', DEFAULT);");
  });

  it('starts another INSERT after a hundred rows', () => {
    const sql = generateSeedSql('MySQL', [table('events', [column('id', 'INT', { pk: true }), column('name', 'VARCHAR(20)')])], { rows: 250 });
    expect(sql.match(/^INSERT INTO/gm)).toHaveLength(3);
    expect(sql.match(/^ {2}\(/gm)).toHaveLength(250);
    expect(sql.match(/\);$/gm)).toHaveLength(3);
  });

  it('puts the notes at the end as comments', () => {
    const tables = [table('flags', [column('id', 'INT', { pk: true }), column('on', 'BOOLEAN', { unique: true })])];
    const sql = generateSeedSql('MySQL', tables, { rows: 10 });
    expect(sql).toMatch(/\n-- Table flags got \d of 10 rows: no more values could be found that stay unique\.\n$/);
  });

  it('counts the notes it ends with', () => {
    const flags = [table('flags', [column('id', 'INT', { pk: true }), column('on', 'BOOLEAN', { unique: true })])];
    expect(generateSeedScript('MySQL', flags, { rows: 10 }).notes).toBe(1);
    expect(generateSeedScript('MySQL', ecommerceTables, { rows: 10 }).notes).toBe(0);
    expect(generateSeedScript('SQLite', flags)).toEqual({ sql: '', notes: 0 });
  });

  it('writes nothing for an engine it cannot write, or when there are no tables', () => {
    expect(generateSeedSql('SQLite', ecommerceTables)).toBe('');
    expect(generateSeedSql('PostgreSQL', [])).toBe('');
    expect(SEED_ENGINES).toEqual(['PostgreSQL', 'MySQL']);
  });

  it('seeds a MySQL dump that was read from its DDL', () => {
    const outcome = parserFor('MySQL')!.parse(ecommerceMysqlDump);
    if (!outcome.ok) throw new Error(outcome.error.message);
    const sql = generateSeedSql('MySQL', outcome.tables, { rows: 4 });
    expect([...sql.matchAll(/^INSERT INTO `(\w+)`/gm)].map((m) => m[1]).sort()).toEqual(outcome.tables.map((t) => t.name).sort());
  });
});
