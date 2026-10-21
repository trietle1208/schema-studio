import { afterEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../../fixtures/ecommerce';
import { blogMysqlDump, ecommerceMysqlDump } from '../../fixtures/sql';
import { parserFor } from '../../parse';
import { DEFAULT_LOCALE, setLocale } from '../../i18n';
import type { Table } from '../../model';
import { seedRecords, type Row } from '..';
import {
  buildQuery,
  countConditions,
  csvCell,
  defaultQuery,
  formatQuery,
  mapAt,
  newCondition,
  parseQuery,
  queryOps,
  queryPlan,
  queryProblems,
  QUERY_MAX_ROWS,
  removeAt,
  resultCsv,
  resultJson,
  runQuery,
  valueHint,
  wherePreview,
  withColumn,
  type QueryResult,
  type QueryRun,
  type QuerySpec,
} from '.';

afterEach(() => setLocale(DEFAULT_LOCALE));

const table = (name: string): Table => ecommerceTables.find((t) => t.name === name)!;
const users = table('users');
const orders = table('orders');

// A few users written out, with the NULLs that SQL has its own rules for.
const USERS: Row[] = [
  { id: 1, email: 'an@example.com', name: 'An Nguyen', avatar_url: null, created_at: '2026-01-14 09:00:00' },
  { id: 2, email: 'binh@example.org', name: 'Binh Tran', avatar_url: 'https://cdn.example.com/2.png', created_at: '2026-03-02 10:30:00' },
  { id: 3, email: 'chi@example.com', name: null, avatar_url: null, created_at: '2026-03-20 18:45:10' },
  { id: 4, email: 'dung_100%@example.com', name: 'Dung 100% Le', avatar_url: null, created_at: '2026-03-20 18:45:10' },
  { id: 5, email: 'em@example.com', name: null, avatar_url: null, created_at: '2025-12-31 23:59:59' },
  { id: 6, email: 'phuc@example.net', name: 'Phuc Do', avatar_url: null, created_at: '2026-04-08 07:15:00' },
];
const DATA = { users: USERS, orders: [] as Row[] };

function run(sql: string, data: Record<string, readonly Row[]> = DATA): QueryRun {
  const r = runQuery(sql, ecommerceTables, data);
  if (!r.ok) throw new Error(`${r.message} (line ${r.line})`);
  return r;
}
const ids = (r: QueryRun) => r.rows.map((x) => x.id);
const failure = (sql: string) => {
  const r: QueryResult = runQuery(sql, ecommerceTables, DATA);
  if (r.ok) throw new Error('the query ran');
  return r;
};

// The Builder of Screen17: three conditions and a group inside them.
const SPEC: QuerySpec = {
  table: 'users',
  columns: null,
  sort: { column: 'created_at', dir: 'desc' },
  limit: 100,
  where: {
    op: 'AND',
    items: [
      { column: 'name', op: 'notnull', value: '', value2: '' },
      { column: 'created_at', op: 'after', value: '2026-03-01', value2: '' },
      { column: 'email', op: 'contains', value: 'example.com', value2: '' },
      {
        op: 'OR',
        items: [
          { column: 'id', op: 'lt', value: '600', value2: '' },
          { column: 'id', op: 'between', value: '900', value2: '1100' },
        ],
      },
    ],
  },
};

describe('buildQuery', () => {
  it('writes an empty query as every row, the first 100', () => {
    expect(buildQuery(defaultQuery(users), users)).toBe('SELECT *\nFROM users\nLIMIT 100;');
  });

  it('writes conditions, a nested group, the sort and the limit one clause to a line', () => {
    expect(buildQuery(SPEC, users)).toBe(
      [
        'SELECT *',
        'FROM users',
        'WHERE name IS NOT NULL',
        "  AND created_at > '2026-03-01'",
        "  AND email ILIKE '%example.com%'",
        '  AND (id < 600 OR id BETWEEN 900 AND 1100)',
        'ORDER BY created_at DESC',
        'LIMIT 100;',
      ].join('\n'),
    );
  });

  it('lists the chosen columns, and says * when they are all chosen', () => {
    const some = { ...defaultQuery(users), columns: ['id', 'email'], limit: null };
    expect(buildQuery(some, users)).toBe('SELECT id, email\nFROM users;');
    expect(buildQuery({ ...some, columns: users.columns.map((c) => c.name) }, users)).toBe('SELECT *\nFROM users;');
  });

  it('puts the column list on lines of its own when it is long', () => {
    const wide: Table = { name: 'wide', columns: Array.from({ length: 9 }, (_, i) => ({ name: `a_long_column_name_${i}`, type: 'INT' })) };
    const sql = buildQuery({ ...defaultQuery(wide), columns: wide.columns.slice(0, 5).map((c) => c.name) }, wide);
    expect(sql.split('\n').slice(0, 3)).toEqual(['SELECT', '  a_long_column_name_0,', '  a_long_column_name_1,']);
  });

  it('leaves out a condition that is not complete', () => {
    const spec: QuerySpec = {
      ...defaultQuery(users),
      where: { op: 'AND', items: [{ column: 'email', op: 'eq', value: '', value2: '' }, { column: 'id', op: 'gt', value: '3', value2: '' }] },
    };
    expect(buildQuery(spec, users)).toBe('SELECT *\nFROM users\nWHERE id > 3\nLIMIT 100;');
  });

  it('makes `contains` and `starts with` plain about % and _', () => {
    const sql = (op: 'contains' | 'starts', value: string) =>
      buildQuery({ ...defaultQuery(users), limit: null, where: { op: 'AND', items: [{ column: 'name', op, value, value2: '' }] } }, users);
    expect(sql('contains', '100%_')).toBe("SELECT *\nFROM users\nWHERE name ILIKE '%100\\%\\_%';");
    expect(sql('starts', "O'Neil")).toBe("SELECT *\nFROM users\nWHERE name ILIKE 'O''Neil%';");
  });

  it('quotes a name that SQL would not take bare', () => {
    const odd: Table = { name: 'Order', columns: [{ name: 'select', type: 'INT' }, { name: 'userId', type: 'INT' }] };
    const spec = { ...defaultQuery(odd), limit: null, sort: { column: 'userId', dir: 'asc' as const } };
    expect(buildQuery(spec, odd)).toBe('SELECT *\nFROM "Order"\nORDER BY "userId";');
    const mine = runQuery('SELECT "select" FROM "Order" ORDER BY "userId"', [odd], { Order: [{ select: 1, userId: 2 }] });
    expect(mine.ok && mine.rows).toEqual([{ select: 1 }]);
  });

  it('writes a query that parses back to the same SQL', () => {
    for (const spec of [defaultQuery(users), SPEC]) {
      const sql = buildQuery(spec, users);
      expect(formatQuery(sql)).toEqual({ ok: true, sql });
    }
  });
});

describe('queryProblems', () => {
  it('finds the conditions that cannot be written, wherever they are', () => {
    const spec: QuerySpec = {
      ...defaultQuery(users),
      where: {
        op: 'AND',
        items: [
          { column: 'id', op: 'eq', value: 'abc', value2: '' },
          { column: 'email', op: 'contains', value: '  ', value2: '' },
          { op: 'OR', items: [{ column: 'created_at', op: 'after', value: '2026-02-30', value2: '' }, { column: 'id', op: 'null', value: '', value2: '' }] },
          { column: 'id', op: 'between', value: '1', value2: '', },
          { column: 'gone', op: 'eq', value: 'x', value2: '' },
        ],
      },
    };
    expect(queryProblems(spec, users)).toEqual([
      { path: [0], message: 'Value must be a number.' },
      { path: [1], message: 'Value cannot be empty.' },
      { path: [2, 0], message: 'Invalid timestamp format.' },
      { path: [3], message: 'Value cannot be empty.' },
      { path: [4], message: 'Choose a column.' },
    ]);
  });

  it('finds nothing in a query that is complete', () => {
    expect(queryProblems(SPEC, users)).toEqual([]);
    expect(queryProblems(defaultQuery(users), users)).toEqual([]);
  });

  it('knows a date from a moment from a time', () => {
    const t: Table = {
      name: 't',
      columns: [
        { name: 'd', type: 'DATE' },
        { name: 'ts', type: 'TIMESTAMPTZ' },
        { name: 'tm', type: 'TIME' },
      ],
    };
    const problem = (column: string, value: string) =>
      queryProblems({ ...defaultQuery(t), where: { op: 'AND', items: [{ column, op: column === 'tm' ? 'between' : 'after', value, value2: value }] } }, t)[0]?.message ?? null;
    expect(problem('d', '2026-03-01')).toBeNull();
    expect(problem('d', '2026-03-01 08:00')).toBe('Invalid date format.');
    expect(problem('ts', '2026-03-01 08:30')).toBeNull();
    expect(problem('ts', '2026-03-01 25:00')).toBe('Invalid timestamp format.');
    expect(problem('ts', '03/01/2026')).toBe('Invalid timestamp format.');
    expect(problem('tm', '08:30:00')).toBeNull();
    expect(problem('tm', '24:00:00')).toBe('Invalid time format.');
  });
});

describe('the operators', () => {
  const labels = (name: string, table: Table) => queryOps(table.columns.find((c) => c.name === name)!).map((o) => o.label);

  it('follow what the column holds', () => {
    expect(labels('email', users)).toEqual(['=', '!=', 'contains', 'starts with', 'in', 'IS NULL', 'IS NOT NULL']);
    expect(labels('id', users)).toEqual(['=', '!=', '>', '>=', '<', '<=', 'between', 'IS NULL', 'IS NOT NULL']);
    expect(labels('created_at', users)).toEqual(['before', 'after', 'within last', 'IS NULL', 'IS NOT NULL']);
    expect(queryOps({ type: 'BOOLEAN' }).map((o) => o.value)).toEqual(['eq', 'null', 'notnull']);
  });

  it('are in the language of the app, built each time they are asked for', () => {
    setLocale('vi');
    expect(labels('created_at', users).slice(0, 3)).toEqual(['trước', 'sau', 'trong vòng']);
    setLocale('en');
    expect(labels('created_at', users)[0]).toBe('before');
  });

  it('start a new condition on the first column, with the first operator', () => {
    expect(newCondition(users)).toEqual({ column: 'id', op: 'eq', value: '', value2: '' });
    expect(newCondition({ columns: [{ name: 'on', type: 'BOOLEAN' }] })).toEqual({ column: 'on', op: 'eq', value: 'true', value2: '' });
  });

  it('stay with a condition that changes column when the new column has them', () => {
    const column = (name: string) => users.columns.find((c) => c.name === name)!;
    const cond = { column: 'name', op: 'contains' as const, value: 'an', value2: '' };
    // Text to text: the operator and the value stay.
    expect(withColumn(cond, column('name'), column('email'))).toEqual({ ...cond, column: 'email' });
    // Text to a number: `contains` is gone, so is the text.
    expect(withColumn(cond, column('name'), column('id'))).toEqual({ column: 'id', op: 'eq', value: '', value2: '' });
    // NULL tests stay whatever the column.
    expect(withColumn({ ...cond, op: 'notnull' }, column('name'), column('created_at')).op).toBe('notnull');
  });

  it('writes >=, IN and within last into the preview', () => {
    const where = {
      op: 'AND' as const,
      items: [
        { column: 'id', op: 'gte' as const, value: '10', value2: '' },
        { column: 'name', op: 'in' as const, value: 'An Nguyen, Phuc Do', value2: '' },
        {
          op: 'OR' as const,
          items: [{ column: 'created_at', op: 'within' as const, value: '30', value2: '' }],
        },
      ],
    };
    expect(wherePreview(where, users)).toBe(
      "WHERE id >= 10 AND name IN ('An Nguyen', 'Phuc Do') AND (created_at >= NOW() - INTERVAL '30 days')",
    );
    expect(buildQuery({ ...defaultQuery(users), limit: null, where }, users)).toMatch(
      /WHERE id >= 10\n {2}AND name IN \('An Nguyen', 'Phuc Do'\)\n {2}AND created_at >= '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'/,
    );
  });

  it('give a value box the hint of its column', () => {
    expect(valueHint(users.columns[0])).toBe('Number');
    expect(valueHint(users.columns[4])).toBe('YYYY-MM-DD');
    expect(valueHint(users.columns[1])).toBe('Value');
  });
});

describe('editing a group', () => {
  it('changes the group at the end of a path and nothing else', () => {
    const changed = mapAt(SPEC.where, [3], (g) => ({ ...g, op: 'AND' }));
    expect(changed.items[3]).toMatchObject({ op: 'AND' });
    expect(changed.items.slice(0, 3)).toEqual(SPEC.where.items.slice(0, 3));
    expect(SPEC.where.items[3]).toMatchObject({ op: 'OR' });
  });

  it('removes a condition, or a group with its conditions, and counts what is left', () => {
    expect(countConditions(SPEC.where)).toBe(5);
    expect(countConditions(removeAt(SPEC.where, [3, 0]))).toBe(4);
    expect(countConditions(removeAt(SPEC.where, [3]))).toBe(3);
    expect(countConditions(removeAt(SPEC.where, [0]))).toBe(4);
  });
});

describe('parseQuery', () => {
  it('reads the clauses of a SELECT', () => {
    const r = parseQuery("SELECT id, email AS mail FROM public.users WHERE id > 1 AND NOT name IS NULL ORDER BY id DESC, email LIMIT 5 OFFSET 2;");
    expect(r.ok && r.query).toMatchObject({
      cols: [{ name: 'id' }, { name: 'email', alias: 'mail' }],
      table: 'users',
      schema: 'public',
      order: [{ col: { name: 'id' }, dir: 'DESC' }, { col: { name: 'email' }, dir: 'ASC' }],
      limit: 5,
      offset: 2,
    });
  });

  it('folds bare names to lower case and keeps quoted ones as written', () => {
    const r = parseQuery('SELECT ID, "Mixed Case", `back` FROM Users');
    expect(r.ok && r.query.cols?.map((c) => c.name)).toEqual(['id', 'Mixed Case', 'back']);
    expect(r.ok && r.query.table).toBe('users');
  });

  it('gives AND more weight than OR, and parentheses more than both', () => {
    const sql = (q: string) => {
      const r = parseQuery(`SELECT * FROM users WHERE ${q}`);
      return r.ok ? formatQuery(`SELECT * FROM users WHERE ${q}`) : r;
    };
    expect(sql('a = 1 OR b = 2 AND c = 3')).toEqual({ ok: true, sql: 'SELECT *\nFROM users\nWHERE a = 1\n  OR b = 2 AND c = 3;' });
    expect(sql('(a = 1 OR b = 2) AND c = 3')).toEqual({ ok: true, sql: 'SELECT *\nFROM users\nWHERE (a = 1 OR b = 2)\n  AND c = 3;' });
  });

  it('reads strings with doubled quotes, signed numbers and the operators', () => {
    const r = parseQuery("SELECT * FROM users WHERE name = 'O''Neil' AND id >= -3 AND id != 4 AND id <> 5");
    expect(r.ok).toBe(true);
    expect(formatQuery("SELECT * FROM users WHERE name = 'O''Neil' AND id >= -3 AND id != 4")).toEqual({
      ok: true,
      sql: "SELECT *\nFROM users\nWHERE name = 'O''Neil'\n  AND id >= -3\n  AND id <> 4;",
    });
  });

  it('says what is wrong with a query that is not a SELECT', () => {
    expect(parseQuery('DELETE FROM users')).toEqual({ ok: false, line: 1, message: 'Only SELECT statements can be run in Query mode.' });
    expect(parseQuery('\n\nDROP TABLE users;')).toMatchObject({ line: 3, message: 'Only SELECT statements can be run in Query mode.' });
    expect(parseQuery('  \n ')).toEqual({ ok: false, line: 1, message: 'Write a query to run.' });
  });

  it('says the line of the word it could not read', () => {
    expect(parseQuery('SELECT id\nFROM users\nWHERE id = ')).toEqual({ ok: false, line: 3, message: 'Unable to parse SQL near line 3.' });
    expect(parseQuery('SELECT id FROM users WHERE id = 1 GROUP BY id')).toMatchObject({ line: 1, message: 'Unable to parse SQL near line 1.' });
    expect(parseQuery("SELECT 'open FROM users")).toMatchObject({ line: 1 });
    expect(parseQuery('SELECT id FROM users LIMIT 1.5')).toMatchObject({ ok: false });
    expect(parseQuery('SELECT id FROM users /* never closed')).toMatchObject({ ok: false });
    expect(parseQuery('SELECT id FROM users WHERE id = 1; SELECT 2')).toMatchObject({ ok: false });
  });

  it('says it in the language of the app', () => {
    setLocale('vi');
    expect(parseQuery('SELECT id\nFROM')).toEqual({ ok: false, line: 2, message: 'Không thể phân tích SQL gần dòng 2.' });
  });

  it('skips comments, and tells that there were some', () => {
    const r = parseQuery('-- all of them\nSELECT * /* really */ FROM users');
    expect(r.ok && r.comments).toBe(true);
    expect(parseQuery('SELECT * FROM users')).toMatchObject({ ok: true, comments: false });
  });
});

describe('formatQuery', () => {
  it('writes a query as the Builder does, whatever it was typed as', () => {
    expect(formatQuery("select   id,email from users where name is not null and created_at >= '2026-03-01' order by created_at desc limit 100")).toEqual({
      ok: true,
      sql: ['SELECT id, email', 'FROM users', 'WHERE name IS NOT NULL', "  AND created_at >= '2026-03-01'", 'ORDER BY created_at DESC', 'LIMIT 100;'].join('\n'),
    });
  });

  it('keeps NOT and IN, LIKE and BETWEEN in their negated forms', () => {
    const r = formatQuery("SELECT * FROM users WHERE id NOT IN (1, 2) AND name NOT LIKE 'A%' AND id NOT BETWEEN 3 AND 4 AND NOT (id = 9 OR id = 10)");
    expect(r).toEqual({
      ok: true,
      sql: ['SELECT *', 'FROM users', 'WHERE id NOT IN (1, 2)', "  AND name NOT LIKE 'A%'", '  AND id NOT BETWEEN 3 AND 4', '  AND NOT (id = 9 OR id = 10);'].join('\n'),
    });
  });

  it('is the same the second time', () => {
    const once = formatQuery('select * from orders where status in (\'paid\',\'shipped\') or total > 100 order by total desc offset 5');
    expect(once.ok && formatQuery(once.sql)).toEqual(once);
  });

  it('leaves a query with comments alone, and says so', () => {
    expect(formatQuery('SELECT * FROM users -- keep me')).toEqual({ ok: false, line: 1, message: 'Unable to format a query that has comments.' });
  });

  it('leaves a query it cannot read alone', () => {
    expect(formatQuery('SELECT FROM')).toMatchObject({ ok: false, line: 1 });
  });
});

describe('runQuery', () => {
  it('selects every row and column of a table', () => {
    const r = run('SELECT * FROM users');
    expect(r.columns.map((c) => c.name)).toEqual(users.columns.map((c) => c.name));
    expect(r.rows).toEqual(USERS);
    expect(r).toMatchObject({ total: 6, shown: 6, all: 6, removed: 0, capped: false });
    // A row of the result is the row of the table, so that it opens in the record editor.
    expect(r.sources[0]).toBe(USERS[0]);
  });

  it('selects columns, and renames them with AS', () => {
    const r = run('SELECT email AS mail, id FROM users WHERE id = 2');
    expect(r.rows).toEqual([{ mail: 'binh@example.org', id: 2 }]);
    expect(r.columns.map((c) => [c.name, c.type, !!c.pk])).toEqual([['mail', 'VARCHAR(255)', false], ['id', 'BIGSERIAL', true]]);
    expect(r.sources).toEqual([USERS[1]]);
  });

  it('compares numbers as numbers and text as text', () => {
    expect(ids(run('SELECT * FROM users WHERE id > 4'))).toEqual([5, 6]);
    expect(ids(run("SELECT * FROM users WHERE id = '3'"))).toEqual([3]);
    expect(ids(run("SELECT * FROM users WHERE email < 'c'"))).toEqual([1, 2]);
    expect(ids(run("SELECT * FROM users WHERE created_at >= '2026-03-20'"))).toEqual([3, 4, 6]);
    expect(ids(run("SELECT * FROM users WHERE created_at BETWEEN '2026-03-01' AND '2026-03-31'"))).toEqual([2, 3, 4]);
  });

  it('leaves out a NULL that a comparison cannot say anything about', () => {
    // 3 and 5 have no name: neither `name = x` nor `name <> x` is true for them.
    expect(ids(run("SELECT * FROM users WHERE name <> 'An Nguyen'"))).toEqual([2, 4, 6]);
    expect(ids(run('SELECT * FROM users WHERE name IS NULL'))).toEqual([3, 5]);
    expect(ids(run('SELECT * FROM users WHERE name IS NOT NULL'))).toEqual([1, 2, 4, 6]);
    expect(ids(run("SELECT * FROM users WHERE NOT name = 'An Nguyen'"))).toEqual([2, 4, 6]);
    expect(ids(run("SELECT * FROM users WHERE name NOT IN ('An Nguyen', 'Binh Tran')"))).toEqual([4, 6]);
    expect(ids(run('SELECT * FROM users WHERE name = NULL'))).toEqual([]);
  });

  it('follows three-valued logic in AND and OR', () => {
    // NULL OR true is true; NULL AND true is not true.
    expect(ids(run("SELECT * FROM users WHERE name = 'x' OR id = 3"))).toEqual([3]);
    expect(ids(run('SELECT * FROM users WHERE name = name AND id = 3'))).toEqual([]);
  });

  it('knows LIKE from ILIKE, and % and _ in a pattern from characters', () => {
    expect(ids(run("SELECT * FROM users WHERE name LIKE 'an%'"))).toEqual([]);
    expect(ids(run("SELECT * FROM users WHERE name ILIKE 'an%'"))).toEqual([1]);
    expect(ids(run("SELECT * FROM users WHERE name ILIKE '_inh%'"))).toEqual([2]);
    expect(ids(run("SELECT * FROM users WHERE email ILIKE '%\\_100\\%@%'"))).toEqual([4]);
    expect(ids(run("SELECT * FROM users WHERE email NOT LIKE '%.com'"))).toEqual([2, 6]);
    // What the Builder writes for `contains "100%"` finds the name that has it.
    expect(ids(run(buildQuery({ ...defaultQuery(users), where: { op: 'AND', items: [{ column: 'name', op: 'contains', value: '100%', value2: '' }] } }, users)))).toEqual([4]);
  });

  it('runs IN and BETWEEN', () => {
    expect(ids(run('SELECT * FROM users WHERE id IN (1, 3, 99)'))).toEqual([1, 3]);
    expect(ids(run('SELECT * FROM users WHERE id BETWEEN 2 AND 4'))).toEqual([2, 3, 4]);
    expect(ids(run('SELECT * FROM users WHERE id NOT BETWEEN 2 AND 5'))).toEqual([1, 6]);
  });

  it('orders by columns, ties in the order they had', () => {
    expect(ids(run('SELECT * FROM users ORDER BY created_at'))).toEqual([5, 1, 2, 3, 4, 6]);
    expect(ids(run('SELECT * FROM users ORDER BY created_at DESC'))).toEqual([6, 3, 4, 2, 1, 5]);
    expect(ids(run('SELECT * FROM users ORDER BY created_at DESC, id DESC'))).toEqual([6, 4, 3, 2, 1, 5]);
    expect(ids(run('SELECT * FROM users ORDER BY id DESC'))).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('puts NULL last when ascending and first when descending', () => {
    expect(ids(run('SELECT * FROM users ORDER BY name'))).toEqual([1, 2, 4, 6, 3, 5]);
    expect(ids(run('SELECT * FROM users ORDER BY name DESC'))).toEqual([3, 5, 6, 4, 2, 1]);
  });

  it('orders numbers as numbers: 10 comes after 9', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
    const r = runQuery('SELECT id FROM products ORDER BY id DESC LIMIT 3', ecommerceTables, { products: many });
    expect(r.ok && r.rows.map((x) => x.id)).toEqual([12, 11, 10]);
  });

  it('orders by a name the query gave a column', () => {
    expect(ids(run('SELECT id, name AS n FROM users WHERE name IS NOT NULL ORDER BY n DESC LIMIT 2') as QueryRun)).toEqual([6, 4]);
  });

  it('cuts with LIMIT and OFFSET, and says how many matched', () => {
    const r = run('SELECT * FROM users ORDER BY id LIMIT 2 OFFSET 1');
    expect(ids(r)).toEqual([2, 3]);
    expect(r).toMatchObject({ total: 6, shown: 2, capped: false });
    expect(run('SELECT * FROM users LIMIT ALL').shown).toBe(6);
    expect(run('SELECT * FROM users OFFSET 10').rows).toEqual([]);
    expect(run('SELECT * FROM users LIMIT 0').shown).toBe(0);
  });

  it('shows at most 1,000 rows, and tells when that cut them', () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1, email: `u${i}@example.com`, name: null, avatar_url: null, created_at: '2026-01-01 00:00:00' }));
    const all = run('SELECT * FROM users', { users: rows });
    expect(all).toMatchObject({ shown: QUERY_MAX_ROWS, total: 1500, capped: true });
    expect(run('SELECT * FROM users LIMIT 1200', { users: rows })).toMatchObject({ shown: QUERY_MAX_ROWS, capped: true });
    // A LIMIT under the maximum is not the maximum's doing.
    expect(run('SELECT * FROM users LIMIT 10', { users: rows })).toMatchObject({ shown: 10, capped: false });
    expect(run('SELECT * FROM users OFFSET 1400', { users: rows })).toMatchObject({ shown: 100, capped: false });
  });

  it('is a result, not an error, when nothing matches', () => {
    const r = run("SELECT * FROM users WHERE email = 'nobody@example.com'");
    expect(r).toMatchObject({ rows: [], total: 0, removed: 6, all: 6 });
    expect(r.columns).toHaveLength(5);
  });

  it('reads a table that has no rows, or that the data does not have', () => {
    expect(run('SELECT * FROM orders').rows).toEqual([]);
    expect(run('SELECT * FROM payments', {}).all).toBe(0);
  });

  it('runs the query the Builder wrote over the sample rows of the schema', () => {
    const data = seedRecords(ecommerceTables, 0, 20);
    const spec: QuerySpec = { ...defaultQuery(orders), limit: null, sort: { column: 'total', dir: 'desc' }, where: { op: 'AND', items: [{ column: 'total', op: 'gt', value: '100', value2: '' }] } };
    const r = run(buildQuery(spec, orders), data);
    const expected = data.orders.filter((o) => Number(o.total) > 100).sort((a, b) => Number(b.total) - Number(a.total));
    expect(expected.length).toBeGreaterThan(0);
    expect(r.rows.map((o) => o.id)).toEqual(expected.map((o) => o.id));
    expect(r.total).toBe(expected.length);
  });
});

describe('what runQuery refuses', () => {
  it('says which column is not there, and on which line', () => {
    const sql = ['SELECT', '  id,', '  email,', '  name,', '  created_at', 'FROM users', "WHERE countr = 'VN'", '  AND name IS NOT NULL', 'ORDER BY created_at DESC', 'LIMIT 100;'].join('\n');
    expect(failure(sql)).toEqual({ ok: false, line: 7, message: 'column "countr" does not exist.' });
    expect(failure('SELECT nope FROM users')).toMatchObject({ line: 1, message: 'column "nope" does not exist.' });
    expect(failure('SELECT id FROM users\nORDER BY nope')).toMatchObject({ line: 2, message: 'column "nope" does not exist.' });
    expect(failure('SELECT users.nope FROM users')).toMatchObject({ message: 'column users.nope does not exist.' });
  });

  it('says which table is not there', () => {
    expect(failure('SELECT *\nFROM usres')).toEqual({ ok: false, line: 2, message: 'relation "usres" does not exist.' });
    expect(failure('SELECT orders.id FROM users')).toMatchObject({ message: 'missing FROM-clause entry for table "orders".' });
  });

  it('refuses a value that the column cannot take, before anything is read', () => {
    expect(failure("SELECT * FROM users WHERE id = 'abc'")).toEqual({ ok: false, line: 1, message: 'invalid input syntax for type bigint: "abc".' });
    expect(failure('SELECT * FROM users WHERE id BETWEEN 1 AND TRUE')).toMatchObject({ message: 'invalid input syntax for type bigint: "true".' });
    expect(failure("SELECT * FROM users WHERE created_at > 'yesterday'")).toMatchObject({ message: 'invalid input syntax for type timestamp: "yesterday".' });
    expect(failure('SELECT * FROM users WHERE id IN (1, 2, \'x\')')).toMatchObject({ message: 'invalid input syntax for type bigint: "x".' });
    expect(failure('SELECT * FROM orders WHERE total = 3\n  AND created_at = 5')).toMatchObject({ line: 2, message: 'invalid input syntax for type timestamp: "5".' });
  });

  it('does not run what changes data', () => {
    expect(failure('UPDATE users SET name = NULL')).toMatchObject({ message: 'Only SELECT statements can be run in Query mode.' });
    expect(failure("INSERT INTO users VALUES (1)")).toMatchObject({ line: 1 });
  });

  it('says it in the language of the app', () => {
    setLocale('vi');
    expect(failure('SELECT nope FROM users')).toMatchObject({ message: 'cột "nope" không tồn tại.' });
  });
});

describe('queryPlan', () => {
  it('lists the scan, the filter, the sort and the cut, innermost last', () => {
    const r = run("SELECT * FROM users WHERE name IS NOT NULL AND created_at > '2026-02-01' ORDER BY created_at DESC LIMIT 2");
    expect(queryPlan(r, 12)).toEqual([
      'Limit  (rows=2)',
      '  ->  Sort  (rows=3)',
      '        Sort Key: created_at DESC',
      "        ->  Seq Scan on users  (rows=3)",
      "              Filter: (name IS NOT NULL AND created_at > '2026-02-01')",
      '              Rows Removed by Filter: 3',
      'Execution time: 12 ms',
    ]);
  });

  it('is only a scan for a query with no clauses, and has no time until it is given one', () => {
    expect(queryPlan(run('SELECT * FROM users'))).toEqual(['Seq Scan on users  (rows=6)']);
  });

  it('writes its numbers the way the app does', () => {
    const rows = Array.from({ length: 1248 }, (_, i) => ({ id: i + 1 }));
    const r = run('SELECT * FROM users WHERE id > 0', { users: rows });
    expect(queryPlan(r)[0]).toBe('Seq Scan on users  (rows=1,248)');
    setLocale('vi');
    expect(queryPlan(r)[0]).toBe('Seq Scan on users  (rows=1.248)');
  });
});

describe('the result as a file', () => {
  it('writes CSV with a header, quotes where it has to, and an empty cell for NULL', () => {
    const r = run("SELECT id, name, email FROM users WHERE id IN (1, 3, 4) ORDER BY id");
    expect(resultCsv(r.columns, r.rows)).toBe(['id,name,email', '1,An Nguyen,an@example.com', '3,,chi@example.com', '4,Dung 100% Le,dung_100%@example.com'].join('\n') + '\n');
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(false)).toBe('false');
  });

  it('writes the columns as the query named them', () => {
    const r = run('SELECT id, name AS who FROM users WHERE id = 1');
    expect(resultCsv(r.columns, r.rows)).toBe('id,who\n1,An Nguyen\n');
  });

  it('writes JSON as a list, even for one row, with NULL as null', () => {
    const r = run('SELECT id, name FROM users WHERE id = 3');
    expect(JSON.parse(resultJson(r.columns, r.rows))).toEqual([{ id: 3, name: null }]);
    expect(JSON.parse(resultJson(run('SELECT id FROM users LIMIT 2').columns, run('SELECT id FROM users LIMIT 2').rows))).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('writes a JSON column as the JSON it holds', () => {
    const t: Table = { name: 'events', columns: [{ name: 'payload', type: 'JSONB' }, { name: 'bad', type: 'JSON' }] };
    const r = runQuery('SELECT * FROM events', [t], { events: [{ payload: '{"a":[1,2]}', bad: '{nope' }] });
    expect(r.ok && JSON.parse(resultJson(r.columns, r.rows))).toEqual([{ payload: { a: [1, 2] }, bad: '{nope' }]);
  });
});

describe('the Builder over every column of the fixtures', () => {
  const parse = (engine: string, sql: string): Table[] => {
    const outcome = parserFor(engine)!.parse(sql);
    if (!outcome.ok) throw new Error(outcome.error.message);
    return outcome.tables;
  };
  const schemas: [string, Table[]][] = [
    ['ecommerce (PostgreSQL)', ecommerceTables],
    ['ecommerce (MySQL)', parse('MySQL', ecommerceMysqlDump)],
    ['blog (MySQL)', parse('MySQL', blogMysqlDump)],
  ];

  it.each(schemas)('finds the row a condition on each column was made from: %s', (_name, tables) => {
    const data = seedRecords(tables, 7, 12);
    let checked = 0;
    for (const t of tables) {
      // Every table can be read with the Builder's defaults.
      const all = runQuery(buildQuery(defaultQuery(t), t), tables, data);
      expect(all.ok, `${t.name}: ${!all.ok && all.message}`).toBe(true);
      for (const column of t.columns) {
        const source = data[t.name].find((r) => r[column.name] !== null);
        if (!source) continue;
        // The column's first operator on the value of one of its rows: `=`, or `before` for a moment (which that row is not before, so only that it runs is checked).
        const op = queryOps(column)[0].value;
        const text = String(source[column.name]);
        const spec: QuerySpec = { ...defaultQuery(t), limit: null, where: { op: 'AND', items: [{ column: column.name, op, value: text, value2: '' }] } };
        if (queryProblems(spec, t).length) continue;
        const r = runQuery(buildQuery(spec, t), tables, data);
        expect(r.ok, `${t.name}.${column.name}: ${buildQuery(spec, t)} -> ${!r.ok && r.message}`).toBe(true);
        if (r.ok && op === 'eq') {
          expect(r.sources, `${t.name}.${column.name} = ${text}`).toContain(source);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('joins', () => {
  const ordersRows: Row[] = [
    { id: 10, user_id: 1, status: 'paid', total: '12.00', created_at: '2026-03-02 11:00:00' },
    { id: 11, user_id: 1, status: 'pending', total: '4.00', created_at: '2026-04-01 11:00:00' },
    { id: 12, user_id: 6, status: 'paid', total: '9.00', created_at: '2026-04-08 08:00:00' },
  ];
  const data = { users: USERS, orders: ordersRows };

  it('reads an inner join and keeps a user with no order on a left join', () => {
    const inner = run("SELECT users.name, orders.status FROM users INNER JOIN orders ON orders.user_id = users.id WHERE orders.status = 'paid' ORDER BY orders.id", data);
    expect(inner.rows).toEqual([
      { name: 'An Nguyen', status: 'paid' },
      { name: 'Phuc Do', status: 'paid' },
    ]);
    expect(inner.sources[0]).toBe(USERS[0]);
    const left = run('SELECT users.id, orders.id AS order_id FROM users LEFT JOIN orders ON orders.user_id = users.id WHERE users.id = 5', data);
    expect(left.rows).toEqual([{ id: 5, order_id: null }]);
  });

  it('names a shared column by its table when the query asks for every column', () => {
    const r = run('SELECT * FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.id = 2', data);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].email).toBe('binh@example.org');
    expect(r.rows[0].status).toBeNull();
    expect(r.rows[0]['o.id']).toBeNull();
    expect(r.sources[0]).toBe(USERS[1]);
  });

  it('prints a join the way it was read, and the Builder writes one', () => {
    const sql = ['SELECT users.id, orders.status', 'FROM users', 'INNER JOIN orders ON orders.user_id = users.id', 'WHERE users.id = 1;'].join('\n');
    expect(formatQuery('select users.id, orders.status from users join orders on orders.user_id = users.id where users.id = 1')).toEqual({ ok: true, sql });
    expect(formatQuery('SELECT * FROM users AS u LEFT OUTER JOIN orders o ON o.user_id = u.id')).toEqual({
      ok: true,
      sql: 'SELECT *\nFROM users AS u\nLEFT JOIN orders AS o ON o.user_id = u.id;',
    });
    const spec: QuerySpec = {
      ...defaultQuery(users),
      limit: null,
      joins: [{ type: 'INNER', table: 'orders', leftTable: 'users', leftColumn: 'id', rightColumn: 'user_id' }],
      where: { op: 'AND', items: [{ column: 'orders.status', op: 'eq', value: 'paid', value2: '' }] },
    };
    expect(buildQuery(spec, users, ecommerceTables)).toBe(
      ["SELECT *", 'FROM users', 'INNER JOIN orders ON users.id = orders.user_id', "WHERE orders.status = 'paid';"].join('\n'),
    );
  });

  it('refuses an ambiguous column, a repeated table and a table the join cannot see', () => {
    expect(failure('SELECT id FROM users INNER JOIN orders ON orders.user_id = users.id')).toMatchObject({ message: 'column reference "id" is ambiguous.' });
    expect(failure('SELECT * FROM users JOIN users ON users.id = users.id')).toMatchObject({ message: 'table name "users" specified more than once.' });
    expect(failure('SELECT * FROM users JOIN orders ON products.id = users.id')).toMatchObject({ message: 'missing FROM-clause entry for table "products".' });
    expect(parseQuery('SELECT * FROM users RIGHT JOIN orders ON orders.user_id = users.id').ok).toBe(false);
  });
});
