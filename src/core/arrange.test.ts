import { describe, expect, it } from 'vitest';
import { arrangeOnly, arrangeTables } from './arrange';
import { blogMysqlDump, shopVietnameseDump } from './fixtures/sql';
import { ecommerceSnapshot, inferredTables, linesBehind } from './fixtures/testing';
import { addInferred } from './infer';
import { GRID_GAP_Y, NODE_WIDTH, computeEdges, gridLayout, nodeHeight, nodeRects } from './layout';
import type { Positions, Table } from './model';
import { mysqlParser } from './parse/mysql';
import { removeInferred } from './relations';

/** A table of `rows` columns, the first ones foreign keys to the `references`. */
function sized(name: string, rows: number, ...references: string[]): Table {
  return {
    name,
    columns: [
      { name: 'id', type: 'INT', pk: true },
      ...references.map((table) => ({ name: `${table}_id`, type: 'INT', fk: { table, column: 'id' } })),
      ...Array.from({ length: Math.max(0, rows - 1 - references.length) }, (_, i) => ({ name: `c${i}`, type: 'INT' })),
    ],
  };
}

/** The tables of a MySQL dump, with the relationships its column names point to. */
function dumped(sql: string): Table[] {
  const outcome = mysqlParser.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return addInferred(outcome.tables);
}

/** Fails unless every table is placed on the grid, clear of the others by the row gap. */
function expectTidy(tables: readonly Table[], positions: Positions) {
  const rects = nodeRects(tables, positions);
  expect(rects).toHaveLength(tables.length);
  for (const a of rects) {
    expect([a.name, a.x % 8, a.y % 8]).toEqual([a.name, 0, 0]);
    for (const b of rects) {
      if (a === b) continue;
      const beside = a.x + a.w <= b.x || b.x + b.w <= a.x;
      const apart = a.y + a.h + GRID_GAP_Y <= b.y || b.y + b.h + GRID_GAP_Y <= a.y;
      expect([a.name, b.name, beside || apart]).toEqual([a.name, b.name, true]);
    }
  }
}

/** The names of the tables column by column, left to right, each column from the top. */
function columns(positions: Positions): string[][] {
  const xs = [...new Set(Object.values(positions).map((p) => p.x))].sort((a, b) => a - b);
  return xs.map((x) =>
    Object.keys(positions)
      .filter((name) => positions[name].x === x)
      .sort((a, b) => positions[a].y - positions[b].y),
  );
}

describe('arrangeTables', () => {
  it('puts the ecommerce sample in columns that follow its foreign keys', () => {
    const { tables } = ecommerceSnapshot();
    const positions = arrangeTables(tables);
    expect(positions).toEqual({
      users: { x: 24, y: 200 },
      orders: { x: 344, y: 200 },
      order_items: { x: 664, y: 48 },
      // Referenced by order_items alone, so next to it and not at the far left.
      products: { x: 344, y: 24 },
      payments: { x: 664, y: 248 },
    });
    expectTidy(tables, positions);
  });

  it('places a referenced table left of every table that references it', () => {
    for (const tables of [ecommerceSnapshot().tables, dumped(shopVietnameseDump), dumped(blogMysqlDump)]) {
      const positions = arrangeTables(tables);
      expectTidy(tables, positions);
      for (const table of tables) {
        for (const column of table.columns) {
          if (!column.fk || column.fk.table === table.name) continue;
          expect(positions[column.fk.table].x + NODE_WIDTH).toBeLessThan(positions[table.name].x);
        }
      }
    }
  });

  it('reads inferred relationships like declared ones', () => {
    expect(arrangeTables(inferredTables())).toEqual(arrangeTables(ecommerceSnapshot().tables));
  });

  it('keeps groups that have nothing to do with each other apart, the largest first', () => {
    // The dump has the users, posts and comments of a blog, and its terms, which no post refers to.
    const positions = arrangeTables(dumped(blogMysqlDump));
    expect(columns(positions)).toEqual([
      ['wp_users', 'wp_posts', 'wp_terms'],
      ['wp_usermeta', 'wp_comments', 'wp_postmeta', 'wp_term_taxonomy'],
      ['wp_term_relationships'],
    ]);
    const bottom = positions.wp_postmeta.y;
    for (const name of ['wp_terms', 'wp_term_taxonomy', 'wp_term_relationships']) {
      expect(positions[name].y).toBeGreaterThan(bottom);
    }
  });

  it('is the grid for a schema without relationships', () => {
    const tables = removeInferred(inferredTables());
    expect(arrangeTables(tables)).toEqual(gridLayout(tables));
  });

  it('puts the tables without a relationship in a grid of their own, under a group that is wider than tall', () => {
    const loose = [sized('audit_log', 4), sized('settings', 3), sized('migrations', 2)];
    const tables = [...ecommerceSnapshot().tables, ...loose];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(positions.users).toEqual({ x: 24, y: 200 });
    // The grid starts under the lowest table of the sample and is as wide as the sample.
    expect(positions.payments.y + nodeHeight(tables[4])).toBe(407);
    expect(loose.map((t) => positions[t.name])).toEqual([
      { x: 24, y: 480 },
      { x: 304, y: 480 },
      { x: 584, y: 480 },
    ]);
  });

  it('puts that grid beside a group that is taller than wide', () => {
    const loose = [sized('audit_log', 4), sized('settings', 3)];
    const tables = [sized('master', 10), sized('a', 8, 'master'), sized('b', 8, 'master'), sized('c', 8, 'master'), ...loose];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(positions.a.x + NODE_WIDTH).toBe(572);
    expect(loose.map((t) => positions[t.name])).toEqual([
      { x: 648, y: 24 },
      { x: 928, y: 24 },
    ]);
  });

  it('stands the tables of a master table on both sides of it once one column would be too tall', () => {
    const details = Array.from({ length: 8 }, (_, i) => sized(`detail_${i}`, 8, 'master'));
    const tables = [sized('master', 10), ...details];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(columns(positions).map((column) => column.length)).toEqual([4, 1, 4]);
    expect(columns(positions)[1]).toEqual(['master']);
  });

  it('splits a column that is too tall even so', () => {
    const details = Array.from({ length: 24 }, (_, i) => sized(`detail_${i}`, 8, 'master'));
    const tables = [sized('master', 10), ...details];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(columns(positions).map((column) => column.length)).toEqual([6, 6, 1, 6, 6]);
  });

  it('leaves a short column of such tables on one side', () => {
    const tables = [sized('master', 10), sized('a', 8, 'master'), sized('b', 8, 'master'), sized('c', 8, 'master')];
    expect(columns(arrangeTables(tables))).toEqual([['master'], ['a', 'b', 'c']]);
  });

  it('orders a column by the tables it is linked to, so that the lines do not cross', () => {
    const tables = [
      sized('a', 4),
      sized('b', 4),
      sized('c', 4),
      sized('of_c', 4, 'c'),
      sized('of_a', 4, 'a'),
      sized('of_b', 4, 'b'),
      sized('of_all', 4, 'a', 'b', 'c'),
    ];
    const [first, second] = columns(arrangeTables(tables));
    expect(second.filter((name) => name !== 'of_all')).toEqual(first.map((name) => `of_${name}`));
  });

  it('leaves a gap in a column for the line that passes through it', () => {
    // `lines` references `orders` in the column before it and `users` two columns back.
    const tables = [sized('users', 4), sized('orders', 12, 'users'), sized('invoices', 12, 'users'), sized('lines', 4, 'orders', 'users')];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(columns(positions)).toEqual([['users'], ['orders', 'invoices'], ['lines']]);
    // The two tables of the middle column are further apart than the row gap, by the room of one line.
    const [orders, invoices] = nodeRects(tables, positions).filter((r) => r.name === 'orders' || r.name === 'invoices');
    expect(invoices.y - (orders.y + orders.h)).toBeGreaterThanOrEqual(GRID_GAP_Y + 16);
    expect(invoices.y - (orders.y + orders.h)).toBeLessThan(GRID_GAP_Y + 16 + 8);
    // Which the line takes: it is drawn behind no table.
    expect(linesBehind(tables, positions)).toEqual([]);
    expect(computeEdges(tables, positions)).toHaveLength(4);
  });

  it('arranges the dumps and the sample so that no line runs behind a table', () => {
    for (const tables of [dumped(shopVietnameseDump), dumped(blogMysqlDump), inferredTables(), ecommerceSnapshot().tables]) {
      expect(linesBehind(tables, arrangeTables(tables))).toEqual([]);
    }
  });

  it('arranges the same way twice with lines that pass through columns', () => {
    const tables = [sized('a', 3), sized('b', 6, 'a'), sized('c', 6, 'a'), sized('d', 3, 'b', 'a'), sized('e', 3, 'd', 'a', 'c')];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(arrangeTables(tables)).toEqual(positions);
    expect(linesBehind(tables, positions)).toEqual([]);
  });

  it('places tables that reference each other, or themselves', () => {
    const tables = [
      sized('employees', 5, 'departments', 'employees'),
      sized('departments', 4, 'employees'),
      sized('categories', 3, 'categories'),
    ];
    const positions = arrangeTables(tables);
    expectTidy(tables, positions);
    expect(positions.employees.x).not.toBe(positions.departments.x);
  });

  it('ignores a foreign key to a table that is not there', () => {
    const tables = [sized('orders', 4, 'users'), sized('payments', 4)];
    expect(arrangeTables(tables)).toEqual(gridLayout(tables));
  });

  it('places a table whose name is a property of every object', () => {
    const tables = [sized('constructor', 2), sized('toString', 2, 'constructor')];
    const positions = arrangeTables(tables);
    expect(Object.keys(positions)).toEqual(['constructor', 'toString']);
    expectTidy(tables, positions);
  });

  it('has nothing to place in an empty schema', () => {
    expect(arrangeTables([])).toEqual({});
  });
});

describe('arranging tables that were made wider or narrower', () => {
  it('changes nothing for tables that are as wide as tables are by themselves', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(arrangeTables(tables, positions)).toEqual(arrangeTables(tables));
    expect(arrangeTables(tables, {})).toEqual(arrangeTables(tables));
  });

  it('keeps the width of a table and makes its column as wide', () => {
    const { tables, positions } = ecommerceSnapshot();
    const plain = arrangeTables(tables);
    const arranged = arrangeTables(tables, { ...positions, orders: { ...positions.orders, w: 400 } });
    expectTidy(tables, arranged);
    expect(arranged.orders).toEqual({ ...plain.orders, w: 400 });
    expect(columns(arranged)).toEqual(columns(plain));
    // products is over orders, in its column; the tables that reference orders are right of all of it.
    expect(arranged.products).toEqual(plain.products);
    expect(arranged.users).toEqual(plain.users);
    expect(arranged.order_items.x).toBe(arranged.payments.x);
    expect(arranged.order_items.x - (arranged.orders.x + 400)).toBe(plain.order_items.x - (plain.orders.x + NODE_WIDTH) + 4);
    expect(linesBehind(tables, arranged)).toEqual([]);
    // Arranged again it stays as it is.
    expect(arrangeTables(tables, arranged)).toEqual(arranged);
  });

  it('brings the next column nearer for a column of narrower tables', () => {
    const { tables, positions } = ecommerceSnapshot();
    const plain = arrangeTables(tables);
    const arranged = arrangeTables(tables, { ...positions, users: { ...positions.users, w: 160 } });
    expectTidy(tables, arranged);
    expect(arranged.users).toEqual({ ...plain.users, w: 160 });
    expect(plain.orders.x - arranged.orders.x).toBeGreaterThanOrEqual(64);
  });

  it('gives the grid of the tables without a relationship columns as wide as the widest of them', () => {
    const loose = removeInferred(dumped(shopVietnameseDump));
    const wide = loose[2].name;
    const arranged = arrangeTables(loose, { [wide]: { x: 0, y: 0, w: 480 } });
    expectTidy(loose, arranged);
    expect(arranged[wide].w).toBe(480);
    expect(Object.values(arranged).filter((p) => p.w !== undefined)).toHaveLength(1);
    const xs = [...new Set(Object.values(arranged).map((p) => p.x))].sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(1);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(480);
  });

  it('keeps the widths of the tables it arranges among themselves and of the others', () => {
    const { tables, positions } = ecommerceSnapshot();
    const some = ['orders', 'order_items', 'payments'];
    const wide = { ...positions, orders: { ...positions.orders, w: 400 }, users: { ...positions.users, w: 300 } };
    const arranged = arrangeOnly(tables, wide, some);
    expect(arranged.users).toBe(wide.users);
    expect(arranged.orders.w).toBe(400);
    expect(arranged.order_items.w).toBeUndefined();
    expect(arranged.order_items.x).toBeGreaterThanOrEqual(arranged.orders.x + 400);
    expectTidy(
      tables.filter((t) => some.includes(t.name)),
      Object.fromEntries(some.map((name) => [name, arranged[name]])),
    );
    expect(arrangeOnly(tables, arranged, some)).toEqual(arranged);
  });
});

describe('arrangeOnly', () => {
  const some = ['orders', 'order_items', 'payments'];

  it('arranges the tables it names among themselves and leaves the others where they are', () => {
    const { tables, positions } = ecommerceSnapshot();
    const arranged = arrangeOnly(tables, positions, some);
    expectTidy(
      tables.filter((t) => some.includes(t.name)),
      Object.fromEntries(some.map((name) => [name, arranged[name]])),
    );
    // orders is referenced by the other two; users and products, which it and they reference, are not arranged.
    expect(columns(Object.fromEntries(some.map((name) => [name, arranged[name]])))).toEqual([['orders'], ['order_items', 'payments']]);
    expect(arranged.users).toBe(positions.users);
    expect(arranged.products).toBe(positions.products);
    expect(Object.keys(arranged)).toEqual(Object.keys(positions));
  });

  it('keeps the top left corner of the area the tables took up', () => {
    const { tables, positions } = ecommerceSnapshot();
    // payments is the leftmost of the three at x 24, orders the highest at y 24.
    const arranged = arrangeOnly(tables, positions, some);
    expect(Math.min(...some.map((name) => arranged[name].x))).toBe(24);
    expect(Math.min(...some.map((name) => arranged[name].y))).toBe(24);

    const away = { ...positions, orders: { x: 1004, y: 803 }, order_items: { x: 1300, y: 900 }, payments: { x: 1100, y: 1200 } };
    const there = arrangeOnly(tables, away, some);
    expect(there.orders.x).toBe(1008);
    expect(Math.min(...some.map((name) => there[name].y))).toBe(800);
    expect(there.order_items.x - there.orders.x).toBe(arranged.order_items.x - arranged.orders.x);
    expect(there.payments.y - there.order_items.y).toBe(arranged.payments.y - arranged.order_items.y);
  });

  it('changes nothing the second time', () => {
    const { tables, positions } = ecommerceSnapshot();
    const once = arrangeOnly(tables, positions, some);
    expect(arrangeOnly(tables, once, some)).toEqual(once);
  });

  it('puts tables that have nothing to do with each other in a grid', () => {
    const { tables, positions } = ecommerceSnapshot();
    const arranged = arrangeOnly(tables, positions, ['users', 'products']);
    expect(arranged.users).toEqual({ x: 24, y: 48 });
    expect(arranged.products).toEqual({ x: 304, y: 48 });
  });

  it('is the arrangement of the whole schema when it names every table', () => {
    const { tables, positions } = ecommerceSnapshot();
    const all = arrangeTables(tables);
    const arranged = arrangeOnly(
      tables,
      positions,
      tables.map((t) => t.name),
    );
    // The sample starts at 24,24, as an arranged schema does.
    expect(arranged).toEqual(all);
  });

  it('ignores a name that is no table, and has nothing to arrange without one that is', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(arrangeOnly(tables, positions, [...some, 'invoices'])).toEqual(arrangeOnly(tables, positions, some));
    expect(arrangeOnly(tables, positions, ['invoices'])).toBe(positions);
    expect(arrangeOnly(tables, positions, [])).toBe(positions);
  });

  it('arranges the tables of a dump that share a prefix without moving the rest', () => {
    const tables = dumped(blogMysqlDump);
    const positions = gridLayout(tables);
    const terms = tables.map((t) => t.name).filter((name) => name.startsWith('wp_term'));
    const arranged = arrangeOnly(tables, positions, terms);
    expect(terms).toHaveLength(3);
    for (const table of tables) {
      if (!terms.includes(table.name)) expect(arranged[table.name]).toBe(positions[table.name]);
    }
    expect(columns(Object.fromEntries(terms.map((name) => [name, arranged[name]])))).toEqual([
      ['wp_terms'],
      ['wp_term_taxonomy'],
      ['wp_term_relationships'],
    ]);
  });
});
