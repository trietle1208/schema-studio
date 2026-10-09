import { describe, expect, it } from 'vitest';
import { arrangeOnly, arrangeTables } from './arrange';
import { dirtyTables, isDirty } from './dirty';
import { duplicateTable, moveTables, renameTable, resizeTables, showColumns } from './edit';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import {
  edgeMarks,
  fittingWidth,
  gridLayout,
  hasMoreRow,
  isKeyColumn,
  LARGE_TABLE,
  lookOf,
  nodeHeight,
  nodeRects,
  rowOf,
  routeEdges,
  shownColumns,
  widened,
  computeEdges,
  NODE_HEAD_HEIGHT,
  NODE_ROW_HEIGHT,
} from './layout';
import type { Placement, SchemaSnapshot, Table } from './model';
import { pathBlocked } from './route';

const orders = () => tableNamed(ecommerceSnapshot(), 'orders');
/** `rows` more columns than a table has by default, none of them a key. */
const wide = (name: string, rows: number): Table => ({
  name,
  columns: [{ name: 'id', type: 'INT', pk: true }, ...Array.from({ length: rows - 1 }, (_, i) => ({ name: `c${i}`, type: 'INT' }))],
});

describe('which columns a table shows', () => {
  it('knows the key columns: primary, foreign and unique', () => {
    const users = tableNamed(ecommerceSnapshot(), 'users');
    expect(users.columns.map(isKeyColumn)).toEqual([true, true, false, false, false]);
    expect(orders().columns.map(isKeyColumn)).toEqual([true, true, false, false, false]);
  });

  it('shows all of them, only the keys, or none', () => {
    expect(shownColumns(orders())).toEqual([0, 1, 2, 3, 4]);
    expect(shownColumns(orders(), { cols: undefined })).toEqual([0, 1, 2, 3, 4]);
    expect(shownColumns(orders(), { cols: 'keys' })).toEqual([0, 1]);
    expect(shownColumns(orders(), { cols: 'none' })).toEqual([]);
  });

  it('has a row that says how many are left out, for keys only and only when some are', () => {
    expect(hasMoreRow(orders(), { cols: 'keys' })).toBe(true);
    expect(hasMoreRow(orders())).toBe(false);
    expect(hasMoreRow(orders(), { cols: 'none' })).toBe(false);
    const keysOnly: Table = { name: 'links', columns: [{ name: 'a', type: 'INT', pk: true }, { name: 'b', type: 'INT', pk: true }] };
    expect(hasMoreRow(keysOnly, { cols: 'keys' })).toBe(false);
  });

  it('is as tall as the rows it draws', () => {
    expect(nodeHeight(orders())).toBe(NODE_HEAD_HEIGHT + 5 * NODE_ROW_HEIGHT + 6);
    // Two keys and the row of the others.
    expect(nodeHeight(orders(), { cols: 'keys' })).toBe(NODE_HEAD_HEIGHT + 3 * NODE_ROW_HEIGHT + 6);
    // Its head, and the two borders.
    expect(nodeHeight(orders(), { cols: 'none' })).toBe(NODE_HEAD_HEIGHT + 2);
  });

  it('numbers the rows of a column among those shown, and -1 for one that is not', () => {
    expect(rowOf(orders(), undefined, 3)).toBe(3);
    expect(rowOf(orders(), { cols: 'keys' }, 1)).toBe(1);
    expect(rowOf(orders(), { cols: 'keys' }, 3)).toBe(-1);
    expect(rowOf(orders(), { cols: 'none' }, 0)).toBe(-1);
  });

  it('gives the tables of the rectangles the height they are drawn with', () => {
    const { tables, positions } = ecommerceSnapshot();
    const collapsed = { ...positions, orders: { ...positions.orders, cols: 'none' as const } };
    expect(nodeRects(tables, collapsed).find((r) => r.name === 'orders')?.h).toBe(35);
    expect(nodeRects(tables, collapsed).find((r) => r.name === 'users')?.h).toBe(159);
  });

  it('fits the width of the columns it shows', () => {
    const long: Table = { name: 't', columns: [{ name: 'id', type: 'INT', pk: true }, { name: 'a_very_long_column_name_here', type: 'VARCHAR(255)' }] };
    expect(fittingWidth(long, { cols: 'keys' })).toBeLessThan(fittingWidth(long));
    expect(fittingWidth(long, { cols: 'none' })).toBeLessThanOrEqual(fittingWidth(long, { cols: 'keys' }));
  });

  it('keeps what a table shows when it is made wider, or moved', () => {
    const at: Placement = { x: 24, y: 48, cols: 'keys' };
    expect(widened(at, 300)).toEqual({ x: 24, y: 48, w: 300, cols: 'keys' });
    expect(widened({ x: 24, y: 48, w: 300, cols: 'none' }, 228)).toEqual({ x: 24, y: 48, cols: 'none' });
    expect(lookOf({ x: 1, y: 2 }, { x: 9, y: 9, w: 260, cols: 'keys' })).toEqual({ x: 1, y: 2, w: 260, cols: 'keys' });
    expect(lookOf({ x: 1, y: 2 }, undefined)).toEqual({ x: 1, y: 2 });
  });

  it('puts a grid under the tables as short as they are drawn', () => {
    const tables = [wide('a', 10), wide('b', 10), wide('c', 10)];
    const tall = gridLayout(tables, 1);
    const short = gridLayout(tables, 1, undefined, { a: { x: 0, y: 0, cols: 'none' }, b: { x: 0, y: 0, cols: 'none' } });
    expect(short.c.y).toBeLessThan(tall.c.y);
    // A collapsed table takes its 35 and the gap of 40, to the grid of 8.
    expect(short.b.y - short.a.y).toBe(72);
  });
});

describe('the lines of tables that show fewer columns', () => {
  const snapshot = (cols: Placement['cols']): SchemaSnapshot => {
    const base = ecommerceSnapshot();
    return { ...base, positions: { ...base.positions, orders: { ...base.positions.orders, cols } } };
  };

  it('end at the same rows while the keys are shown, which are the rows of the keys', () => {
    const all = computeEdges(ecommerceSnapshot().tables, ecommerceSnapshot().positions).find((e) => e.id === 'orders:1');
    const keys = snapshot('keys');
    const kept = computeEdges(keys.tables, keys.positions).find((e) => e.id === 'orders:1');
    expect(kept?.b.y).toBe(all?.b.y);
  });

  it('end at the head of a table that shows no column', () => {
    const none = snapshot('none');
    const edge = computeEdges(none.tables, none.positions).find((e) => e.id === 'orders:1');
    // The head of orders (at y 24) is 33 high: the middle of it, one px down for the border.
    expect(edge?.b.y).toBe(24 + 16.5 + 1);
    const referenced = computeEdges(none.tables, none.positions).find((e) => e.id === 'order_items:1');
    expect(referenced?.a.y).toBe(24 + 16.5 + 1);
  });

  it('is shown by the lines of every table, whatever it shows', () => {
    const none = snapshot('none');
    expect(computeEdges(none.tables, none.positions)).toHaveLength(4);
  });
});

describe('showColumns', () => {
  it('makes tables show the keys only, none, or all again', () => {
    const base = ecommerceSnapshot();
    const keys = showColumns(base, 'keys', ['users', 'orders']);
    expect(keys.positions.users).toEqual({ x: 24, y: 48, cols: 'keys' });
    expect(keys.positions.orders).toEqual({ x: 304, y: 24, cols: 'keys' });
    expect(keys.positions.products).toBe(base.positions.products);
    expect(keys.tables).toBe(base.tables);

    const none = showColumns(keys, 'none', ['users']);
    expect(none.positions.users.cols).toBe('none');
    const back = showColumns(none, 'all');
    expect(back.positions).toEqual(base.positions);
    expect(Object.values(back.positions).every((p) => !('cols' in p))).toBe(true);
  });

  it('does nothing when every table is as it should be', () => {
    const base = ecommerceSnapshot();
    expect(showColumns(base, 'all')).toBe(base);
    const keys = showColumns(base, 'keys');
    expect(showColumns(keys, 'keys')).toBe(keys);
    expect(showColumns(base, 'keys', ['nothing'])).toBe(base);
  });

  it('keeps the width of a table', () => {
    const base = resizeTables(ecommerceSnapshot(), { users: { x: 24, y: 48, w: 300 } });
    expect(showColumns(base, 'keys', ['users']).positions.users).toEqual({ x: 24, y: 48, w: 300, cols: 'keys' });
    expect(showColumns(showColumns(base, 'keys', ['users']), 'all', ['users']).positions.users).toEqual({ x: 24, y: 48, w: 300 });
  });

  it('collapses only the large tables for `large`', () => {
    const base = ecommerceSnapshot();
    const tables = [...base.tables, wide('audit_log', LARGE_TABLE + 1), wide('lookup', LARGE_TABLE)];
    const positions = { ...base.positions, audit_log: { x: 0, y: 0 }, lookup: { x: 300, y: 0 } };
    const large = showColumns({ tables, positions }, 'large');
    expect(large.positions.audit_log.cols).toBe('keys');
    expect(large.positions.lookup.cols).toBeUndefined();
    expect(large.positions.users.cols).toBeUndefined();
    // A table that has become small again is shown whole.
    const shrunk = showColumns({ ...large, tables: large.tables.map((t) => (t.name === 'audit_log' ? wide('audit_log', 3) : t)) }, 'large');
    expect(shrunk.positions.audit_log.cols).toBeUndefined();
  });

  it('leaves a table that has no place on the canvas out', () => {
    const base = ecommerceSnapshot();
    const positions = Object.fromEntries(Object.entries(base.positions).filter(([name]) => name !== 'users'));
    const next = showColumns({ ...base, positions }, 'keys');
    expect(next.positions).not.toHaveProperty('users');
    expect(next.positions.orders.cols).toBe('keys');
  });

  it('is kept by a move, a resize, a rename and a copy of the table', () => {
    const keys = showColumns(ecommerceSnapshot(), 'keys', ['users']);
    expect(moveTables(keys, { users: { x: 100, y: 100 } }).positions.users).toEqual({ x: 100, y: 100, cols: 'keys' });
    expect(resizeTables(keys, { users: { x: 24, y: 48, w: 260 } }).positions.users).toEqual({ x: 24, y: 48, w: 260, cols: 'keys' });
    expect(renameTable(keys, 'users', 'accounts').positions.accounts.cols).toBe('keys');
    const copy = duplicateTable(keys, 'users');
    const copied = copy.tables[copy.tables.length - 1].name;
    expect(copied).not.toBe('users');
    expect(copy.positions[copied].cols).toBe('keys');
  });

  it('is an unsaved change of the table, and not a change of its columns', () => {
    const saved = ecommerceSnapshot();
    const keys = showColumns(saved, 'keys', ['users']);
    expect(isDirty(keys, saved)).toBe(true);
    expect(dirtyTables(keys, saved)).toEqual(['users']);
    // Shown whole again it is what was saved.
    expect(isDirty(showColumns(keys, 'all'), saved)).toBe(false);
    expect(dirtyTables(showColumns(keys, 'all', ['users']), saved)).toEqual([]);
  });
});

describe('arranging tables that show fewer columns', () => {
  it('keeps what they show, and makes room for them as tall as they are', () => {
    const { tables } = ecommerceSnapshot();
    const placed = showColumns({ tables, positions: arrangeTables(tables) }, 'none').positions;
    const again = arrangeTables(tables, placed);
    expect(Object.values(again).every((p) => p.cols === 'none')).toBe(true);
    const full = arrangeTables(tables);
    const height = (p: typeof again) => Math.max(...nodeRects(tables, p).map((r) => r.y + r.h));
    expect(height(again)).toBeLessThan(height(full));
    expect(arrangeTables(tables, again)).toEqual(again);
  });

  it('keeps what the tables it leaves alone show', () => {
    const { tables, positions } = ecommerceSnapshot();
    const placed = showColumns({ tables, positions }, 'keys', ['users', 'payments']).positions;
    const next = arrangeOnly(tables, placed, ['users', 'orders']);
    expect(next.users.cols).toBe('keys');
    expect(next.payments).toBe(placed.payments);
  });
});

describe('edgeMarks', () => {
  const ends = { a: { x: 100, y: 50, side: 1 as const }, b: { x: 300, y: 80, side: -1 as const } };

  it('draws one bar and a foot in the simple notation, whatever the column is', () => {
    const simple = edgeMarks(ends, 'simple');
    expect(simple.rings).toEqual([]);
    expect(simple.paths).toEqual(['M108 45 V55', 'M291 80 L300 75 M291 80 L300 85 M291 80 L300 80']);
    expect(edgeMarks({ ...ends, optional: true, single: true }, 'simple')).toEqual(simple);
  });

  it("is exactly one at the referenced end and zero or many at the other, in crow's foot", () => {
    const marks = edgeMarks(ends);
    expect(marks.paths).toEqual(['M107 45 V55', 'M112 45 V55', 'M290 80 L300 75 M290 80 L300 85 M290 80 L300 80']);
    expect(marks.rings).toEqual([{ x: 285.5, y: 80 }]);
  });

  it('is zero or one at the referenced end when the column may be empty', () => {
    const marks = edgeMarks({ ...ends, optional: true });
    expect(marks.paths[0]).toBe('M107 45 V55');
    expect(marks.paths).toHaveLength(2);
    expect(marks.rings).toEqual([{ x: 114, y: 50 }, { x: 285.5, y: 80 }]);
  });

  it('is zero or one at the other end when the column is unique', () => {
    const marks = edgeMarks({ ...ends, single: true });
    expect(marks.paths).toEqual(['M107 45 V55', 'M112 45 V55', 'M293 75 V85']);
    expect(marks.rings).toEqual([{ x: 286, y: 80 }]);
    expect(edgeMarks({ ...ends, single: true, optional: true }).rings).toHaveLength(2);
  });
});

describe('the kind of a line', () => {
  it('is optional for a column that may be empty and single for one that is unique or the whole primary key', () => {
    const base = ecommerceSnapshot();
    const users = tableNamed(base, 'users');
    const changed = {
      ...base,
      tables: base.tables.map((t) =>
        t.name === 'payments'
          ? { ...t, columns: t.columns.map((c) => (c.name === 'order_id' ? { ...c, nullable: true, unique: true } : c)) }
          : t,
      ),
    };
    const edges = computeEdges(changed.tables, changed.positions);
    expect(edges.find((e) => e.id === 'payments:1')).toMatchObject({ optional: true, single: true });
    expect(edges.find((e) => e.id === 'orders:1')).not.toHaveProperty('optional');
    expect(edges.find((e) => e.id === 'orders:1')).not.toHaveProperty('single');
    expect(users.name).toBe('users');

    // A column that is the whole primary key can hold a value once.
    const shared: Table = { name: 'profiles', columns: [{ name: 'user_id', type: 'BIGINT', pk: true, fk: { table: 'users', column: 'id' } }] };
    const withShared = [...base.tables, shared];
    const edge = computeEdges(withShared, { ...base.positions, profiles: { x: 700, y: 400 } }).find((e) => e.to === 'profiles');
    expect(edge?.single).toBe(true);
    // Half of a key made of two columns cannot.
    const half: Table = { name: 'half', columns: [{ name: 'user_id', type: 'BIGINT', pk: true, fk: { table: 'users', column: 'id' } }, { name: 'x', type: 'INT', pk: true }] };
    expect(computeEdges([...base.tables, half], { ...base.positions, half: { x: 700, y: 400 } }).find((e) => e.to === 'half')?.single).toBeUndefined();
  });
});

describe('routeEdges', () => {
  /** A row of `count` tables, each referencing the first, so that the lines to it run behind the tables between and have to go around them. */
  const stacked = (count: number) => {
    const tables: Table[] = Array.from({ length: count }, (_, i) => ({
      name: `t${i}`,
      columns: [{ name: 'id', type: 'INT', pk: true }, ...(i ? [{ name: 'root_id', type: 'INT', fk: { table: 't0', column: 'id' } }] : [])],
    }));
    const positions = Object.fromEntries(tables.map((t, i) => [t.name, { x: 24 + i * 300, y: 24 }]));
    return { tables, positions };
  };

  it('gives the lines of computeEdges', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(routeEdges(tables, positions).edges).toEqual(computeEdges(tables, positions));
    expect(routeEdges(tables, positions).pending).toBe(0);
  });

  it('keeps the lines that are still right, themselves and not copies', () => {
    const { tables, positions } = stacked(8);
    const first = routeEdges(tables, positions);
    expect(first.edges.some((e) => e.via)).toBe(true);
    const again = routeEdges(tables, positions, first.edges);
    expect(again.edges).toHaveLength(first.edges.length);
    again.edges.forEach((e, i) => expect(e).toBe(first.edges[i]));
  });

  it('looks for the lines of a table that moved, and keeps the others', () => {
    const { tables, positions } = stacked(8);
    const first = routeEdges(tables, positions);
    const moved = { ...positions, t7: { x: positions.t7.x, y: 400 } };
    const next = routeEdges(tables, moved, first.edges);
    const same = next.edges.filter((e, i) => e === first.edges[i]);
    expect(same.length).toBeGreaterThanOrEqual(3);
    expect(next.edges.find((e) => e.to === 't7')).not.toBe(first.edges.find((e) => e.to === 't7'));
    // What it comes to is what a search from nothing comes to.
    expect(next.edges.map((e) => e.via)).toEqual(routeEdges(tables, moved).edges.map((e) => e.via));
  });

  it('looks again for a line that a table has come to stand in the way of, and lets one go that is free now', () => {
    const base = ecommerceSnapshot();
    const lines = routeEdges(base.tables, base.positions);
    // The payments table moves between orders and order_items.
    const blocking = { ...base.positions, payments: { x: 584 - 40, y: 40 } };
    const after = routeEdges(base.tables, blocking, lines.edges);
    expect(after.edges.map((e) => e.via)).toEqual(routeEdges(base.tables, blocking).edges.map((e) => e.via));
    const back = routeEdges(base.tables, base.positions, after.edges);
    expect(back.edges.map((e) => e.via)).toEqual(lines.edges.map((e) => e.via));
  });

  it('leaves the lines it has no time to look for as curves, counted as pending, and finishes with the next call', () => {
    const { tables, positions } = stacked(10);
    const full = routeEdges(tables, positions);
    const behind = full.edges.filter((e) => e.via).length;
    expect(behind).toBeGreaterThan(2);

    const none = routeEdges(tables, positions, [], { searches: 0 });
    expect(none.pending).toBe(behind);
    expect(none.edges.filter((e) => e.via)).toHaveLength(0);

    const some = routeEdges(tables, positions, none.edges, { searches: 2 });
    expect(some.edges.filter((e) => e.via)).toHaveLength(2);
    expect(some.pending).toBe(behind - 2);

    let current = some;
    for (let pass = 0; pass < behind && current.pending; pass++) current = routeEdges(tables, positions, current.edges, { searches: 2 });
    expect(current.pending).toBe(0);
    expect(current.edges.map((e) => e.via)).toEqual(full.edges.map((e) => e.via));
  });

  it('does not look for a way when its time is over before it begins', () => {
    const { tables, positions } = stacked(6);
    expect(routeEdges(tables, positions, [], { ms: -1 }).pending).toBeGreaterThan(0);
    expect(routeEdges(tables, positions, [], { ms: 10_000 }).pending).toBe(0);
  });

  it('draws the line again when only what it is about changed', () => {
    const { tables, positions } = ecommerceSnapshot();
    const first = routeEdges(tables, positions);
    const optional = tables.map((t) => (t.name === 'orders' ? { ...t, columns: t.columns.map((c) => (c.name === 'user_id' ? { ...c, nullable: true } : c)) } : t));
    const next = routeEdges(optional, positions, first.edges);
    const was = first.edges.find((e) => e.id === 'orders:1');
    const is = next.edges.find((e) => e.id === 'orders:1');
    expect(is).not.toBe(was);
    expect(is).toMatchObject({ optional: true, a: was?.a, b: was?.b });
    expect(next.edges.filter((e) => e.id !== 'orders:1').every((e) => first.edges.includes(e))).toBe(true);
  });

  it('does not take a line of another diagram for its own', () => {
    const { tables, positions } = ecommerceSnapshot();
    const first = routeEdges(tables, positions);
    const renamed = tables.map((t) => ({ ...t, columns: t.columns.map((c) => (c.fk?.table === 'users' ? { ...c, fk: { ...c.fk, table: 'orders', column: 'id' } } : c)) }));
    const next = routeEdges(renamed, positions, first.edges);
    expect(next.edges.find((e) => e.id === 'orders:1')?.from).toBe('orders');
  });
});

describe('a diagram of hundreds of tables', () => {
  /** `count` tables of ten columns that reference earlier tables, laid out by `arrangeTables`. */
  function big(count: number) {
    let seed = 7;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const tables: Table[] = Array.from({ length: count }, (_, i) => ({
      name: `t${i}`,
      columns: [
        { name: 'id', type: 'BIGSERIAL', pk: true },
        ...Array.from({ length: 8 }, (_, k) => ({ name: `c${k}`, type: 'TEXT', nullable: true })),
        ...(i > 0 ? [{ name: 'parent_id', type: 'BIGINT', fk: { table: `t${Math.max(0, i - 1 - Math.floor(random() * 12))}`, column: 'id' } }] : []),
        ...(i > 5 ? [{ name: 'other_id', type: 'BIGINT', fk: { table: `t${Math.floor(random() * i)}`, column: 'id' } }] : []),
      ],
    }));
    return { tables, positions: arrangeTables(tables) };
  }

  it('is found a pass at a time, each pass keeping what the one before found', () => {
    const { tables, positions } = big(150);
    const full = routeEdges(tables, positions);
    expect(full.edges.length).toBeGreaterThan(250);
    expect(full.edges.filter((e) => e.via).length).toBeGreaterThan(20);

    let current = routeEdges(tables, positions, [], { searches: 0 });
    expect(current.pending).toBeGreaterThan(20);
    let passes = 0;
    while (current.pending && passes++ < 100) {
      const before = current.edges;
      current = routeEdges(tables, positions, before, { searches: 10 });
      // What was found stays found: the same lines, not new ones.
      before.filter((e) => e.via).forEach((e) => expect(current.edges.find((x) => x.id === e.id)).toBe(e));
    }
    expect(current.pending).toBe(0);
    // The same lines go around tables. Where they run in the gaps may differ a little: lines that are found a few at a time share the gaps in another order.
    expect(current.edges.map((e) => !!e.via)).toEqual(full.edges.map((e) => !!e.via));
    const rects = nodeRects(tables, positions);
    for (const e of current.edges) if (e.via) expect(pathBlocked(e.via, rects)).toBe(false);
  });

  it('looks only for the lines of the table that was moved', () => {
    const { tables, positions } = big(150);
    const first = routeEdges(tables, positions);
    const name = tables[40].name;
    const moved = { ...positions, [name]: { x: positions[name].x + 16, y: positions[name].y + 8 } };
    const next = routeEdges(tables, moved, first.edges);
    const changed = next.edges.filter((e, i) => e !== first.edges[i]);
    // Its own lines, and the ones it came to stand in the way of or stopped standing in the way of.
    expect(changed.length).toBeLessThan(first.edges.length / 3);
    expect(changed.some((e) => e.from === name || e.to === name)).toBe(true);
  });

  it('is laid out in a grid as tall as the tables show', () => {
    const { tables } = big(40);
    const full = gridLayout(tables, 4);
    const short = gridLayout(tables, 4, undefined, Object.fromEntries(tables.map((t) => [t.name, { x: 0, y: 0, cols: 'keys' as const }])));
    const bottom = (p: typeof full, shown?: Placement['cols']) => Math.max(...nodeRects(tables, Object.fromEntries(Object.entries(p).map(([n, at]) => [n, { ...at, cols: shown }]))).map((r) => r.y + r.h));
    expect(bottom(short, 'keys')).toBeLessThan(bottom(full));
  });
});
