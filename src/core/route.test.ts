import { describe, expect, it } from 'vitest';
import { blogMysqlDump, shopVietnameseDump } from './fixtures/sql';
import { ecommerceSnapshot, linesBehind } from './fixtures/testing';
import { addInferred } from './infer';
import { computeEdges, edgePath, gridLayout, NODE_WIDTH, nodeRects, type Anchor, type Rect } from './layout';
import type { Position, Table } from './model';
import { mysqlParser } from './parse/mysql';
import { curveBlocked, curveBounds, curvePath, pathBlocked, roundedPath, routeAround } from './route';

/** The tables of a MySQL dump, with the relationships its column names point to. */
function dumped(sql: string): Table[] {
  const outcome = mysqlParser.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return addInferred(outcome.tables);
}

/** Whether a line through `points` keeps `clearance` from every one of `rects`. */
function clear(points: readonly Position[], rects: readonly Rect[], clearance: number): boolean {
  return points.every((p, k) => {
    const q = points[k - 1] ?? p;
    return rects.every(
      (r) =>
        Math.max(p.x, q.x) <= r.x - clearance ||
        Math.min(p.x, q.x) >= r.x + r.w + clearance ||
        Math.max(p.y, q.y) <= r.y - clearance ||
        Math.min(p.y, q.y) >= r.y + r.h + clearance,
    );
  });
}

// Two tables 600 apart with one between them, which the curve from the first to the last runs behind.
const left: Rect = { x: 0, y: 0, w: 228, h: 111 };
const between: Rect = { x: 300, y: -40, w: 228, h: 207 };
const right: Rect = { x: 600, y: 0, w: 228, h: 111 };
const a: Anchor = { x: 228, y: 46, side: 1 };
const b: Anchor = { x: 600, y: 70, side: -1 };

describe('curveBlocked', () => {
  it('says whether the curve between two ends runs behind a table', () => {
    expect(curveBlocked(a, b, [left, right])).toBe(false);
    expect(curveBlocked(a, b, [left, between, right])).toBe(true);
    // A table the curve passes over or under is not in its way.
    expect(curveBlocked(a, b, [left, { ...between, y: 120 }, right])).toBe(false);
    expect(curveBlocked(a, b, [left, { ...between, y: -260 }, right])).toBe(false);
  });

  it('finds no line of the ecommerce sample behind a table', () => {
    const { tables, positions } = ecommerceSnapshot();
    const rects = nodeRects(tables, positions);
    expect(computeEdges(tables, positions).filter((e) => curveBlocked(e.a, e.b, rects))).toEqual([]);
  });
});

describe('routeAround', () => {
  it('goes around the table between the two ends, along horizontal and vertical lines', () => {
    const rects = [left, between, right];
    const via = routeAround(a, b, rects, 10)!;
    expect(via[0]).toEqual({ x: 228, y: 46 });
    expect(via[via.length - 1]).toEqual({ x: 600, y: 70 });
    // Out of the side of each end, and over the table between them, which is nearer than under it.
    expect(via).toEqual([
      { x: 228, y: 46 },
      { x: 290, y: 46 },
      { x: 290, y: -50 },
      { x: 590, y: -50 },
      { x: 590, y: 70 },
      { x: 600, y: 70 },
    ]);
    for (let k = 1; k < via.length; k++) expect(via[k].x === via[k - 1].x || via[k].y === via[k - 1].y).toBe(true);
    // It keeps its distance from the table it goes around; its own tables it only leaves.
    expect(clear(via, [between], 10)).toBe(true);
    expect(clear(via.slice(1, -1), rects, 10)).toBe(true);
  });

  it('keeps further away with more clearance', () => {
    const via = routeAround(a, b, [left, between, right], 18)!;
    expect(via.map((p) => p.y)).toContain(-58);
    expect(clear(via.slice(1, -1), [left, between, right], 18)).toBe(true);
  });

  it('is a straight line when nothing is in the way at the height of the ends', () => {
    expect(routeAround(a, { ...b, y: 46 }, [left, right], 10)).toEqual([
      { x: 228, y: 46 },
      { x: 600, y: 46 },
    ]);
  });

  it('loops back to a table on the same side', () => {
    // Both ends out of the right side, one table over the other.
    const under: Rect = { x: 0, y: 200, w: 228, h: 111 };
    const via = routeAround(a, { x: 228, y: 246, side: 1 }, [left, under], 10)!;
    expect(via).toEqual([
      { x: 228, y: 46 },
      { x: 238, y: 46 },
      { x: 238, y: 246 },
      { x: 228, y: 246 },
    ]);
  });

  it('finds a way that leads far around', () => {
    // A wall of tables from far above to far below the two ends.
    const wall: Rect[] = Array.from({ length: 9 }, (_, k) => ({ x: 300, y: -1000 + k * 240, w: 228, h: 239 }));
    const via = routeAround(a, b, [left, ...wall, right], 10)!;
    expect(via).not.toBeNull();
    expect(clear(via.slice(1, -1), [left, ...wall, right], 10)).toBe(true);
  });

  it('has no way out of an end that a table stands against', () => {
    const against: Rect = { x: 232, y: 0, w: 228, h: 111 };
    expect(routeAround(a, b, [left, against, right], 10)).toBeNull();
  });
});

describe('roundedPath and edgePath', () => {
  it('rounds the corners of a line', () => {
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 30 },
        ],
        8,
      ),
    ).toBe('M0 0 L32 0 Q40 0 40 8 L40 30');
    // A corner takes half of a short stretch at most.
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 6 },
          { x: 80, y: 6 },
        ],
        8,
      ),
    ).toBe('M0 0 L37 0 Q40 0 40 3 L40 3 Q40 6 43 6 L80 6');
    expect(roundedPath([{ x: 0, y: 0 }, { x: 40, y: 0 }])).toBe('M0 0 L40 0');
    expect(roundedPath([])).toBe('');
  });

  it('draws the curve between two ends, or the line through the corners it is given', () => {
    expect(edgePath(a, b)).toBe('M228 46 C414 46 414 70 600 70');
    expect(edgePath(a, b)).toBe(curvePath(a, b));
    const via = routeAround(a, b, [left, between, right], 10)!;
    expect(edgePath(a, b, via)).toBe(roundedPath(via));
    expect(edgePath(a, b, via).startsWith('M228 46 L282 46 Q290 46 290 38')).toBe(true);
  });
});

describe('computeEdges around tables', () => {
  it('leads the lines of a dump that is laid out in a grid through the gaps between its tables', () => {
    for (const dump of [shopVietnameseDump, blogMysqlDump]) {
      const tables = dumped(dump);
      const positions = gridLayout(tables);
      const edges = computeEdges(tables, positions);
      expect(edges.some((e) => e.via)).toBe(true);
      expect(linesBehind(tables, positions)).toEqual([]);
      // A line that has nothing in its way stays the curve it was.
      const rects = nodeRects(tables, positions);
      for (const e of edges) expect([e.id, !!e.via]).toEqual([e.id, curveBlocked(e.a, e.b, rects)]);
    }
  });

  it('keeps lines to different columns apart where they go around the same table', () => {
    // Two tables at the right reference two at the left, past the table between them.
    const table = (name: string, ...references: string[]): Table => ({
      name,
      columns: [{ name: 'id', type: 'INT', pk: true }, ...references.map((r) => ({ name: `${r}_id`, type: 'INT', fk: { table: r, column: 'id' } }))],
    });
    const tables = [table('one'), table('two'), table('wall'), table('uses', 'one', 'two')];
    const positions = { one: { x: 0, y: 0 }, two: { x: 0, y: 120 }, wall: { x: 300, y: -80 }, uses: { x: 600, y: 40 } };
    tables[2] = { ...tables[2], columns: [...tables[2].columns, ...Array.from({ length: 12 }, (_, k) => ({ name: `c${k}`, type: 'INT' }))] };
    const [first, second] = computeEdges(tables, positions);
    expect(first.via && second.via).toBeTruthy();
    expect(linesBehind(tables, positions)).toEqual([]);
    // Each keeps its own distance from the wall: 10 and 14.
    const wallLeft = 300;
    expect(first.via!.some((p) => p.x === wallLeft - 10)).toBe(true);
    expect(second.via!.some((p) => p.x === wallLeft - 14)).toBe(true);
    expect(NODE_WIDTH).toBe(228);
  });

  it('leaves the lines of the ecommerce sample the curves they are', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(computeEdges(tables, positions).some((e) => e.via)).toBe(false);
  });
});

describe('curveBounds', () => {
  it('holds the curve between two ends', () => {
    const a: Anchor = { x: 100, y: 50, side: 1 };
    const b: Anchor = { x: 400, y: 250, side: -1 };
    const bounds = curveBounds(a, b);
    expect(bounds).toEqual({ x: 100, y: 50, w: 300, h: 200 });
    // A curve that is pulled out of the same side at both ends reaches past them.
    const loop = curveBounds({ x: 100, y: 50, side: 1 }, { x: 100, y: 200, side: 1 });
    expect(loop.x).toBe(100);
    expect(loop.w).toBe(36);
  });
});

describe('pathBlocked', () => {
  const tables: Rect[] = [{ x: 100, y: 100, w: 100, h: 100 }];

  it('is true when a stretch of the line crosses a table, and false when it goes by or along its side', () => {
    expect(pathBlocked([{ x: 0, y: 150 }, { x: 300, y: 150 }], tables)).toBe(true);
    expect(pathBlocked([{ x: 150, y: 0 }, { x: 150, y: 120 }], tables)).toBe(true);
    expect(pathBlocked([{ x: 0, y: 50 }, { x: 300, y: 50 }], tables)).toBe(false);
    expect(pathBlocked([{ x: 100, y: 0 }, { x: 100, y: 300 }], tables)).toBe(false);
    expect(pathBlocked([{ x: 0, y: 100 }, { x: 300, y: 100 }], tables)).toBe(false);
    expect(pathBlocked([{ x: 0, y: 0 }], tables)).toBe(false);
  });

  it('is false for the lines that routeAround draws', () => {
    const { tables: all, positions } = ecommerceSnapshot();
    const rects = nodeRects(all, positions);
    for (const e of computeEdges(all, positions)) if (e.via) expect(pathBlocked(e.via, rects)).toBe(false);
  });
});
