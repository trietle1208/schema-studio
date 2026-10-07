import { describe, expect, it } from 'vitest';
import { deleteTable, moveTable, updateTable } from './edit';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import {
  clampZoom,
  computeEdges,
  edgePath,
  fitView,
  gridColumns,
  gridLayout,
  minimapLayout,
  newTablePosition,
  nodeHeight,
  nodeRects,
  snap,
  stepZoom,
  viewRect,
  zoomAt,
} from './layout';

describe('nodeHeight', () => {
  it('is the header plus one row per column', () => {
    const { tables } = ecommerceSnapshot();
    expect(tables.map((t) => [t.name, nodeHeight(t)])).toEqual([
      ['users', 159],
      ['orders', 159],
      ['order_items', 159],
      ['products', 135],
      ['payments', 159],
    ]);
  });
});

describe('snap and clampZoom', () => {
  it('snaps to the 8px grid', () => {
    expect([0, 3, 4, 11, 12, 301, -5].map((v) => snap(v))).toEqual([0, 0, 8, 8, 16, 304, -8]);
  });

  it('keeps zoom between 25% and 200%', () => {
    expect([0.1, 0.25, 1, 1.9, 2, 3.5].map(clampZoom)).toEqual([0.25, 0.25, 1, 1.9, 2, 2]);
  });
});

describe('computeEdges', () => {
  it('draws one edge per foreign key in the ecommerce sample', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(computeEdges(tables, positions).map((e) => [e.id, e.from, e.to])).toEqual([
      ['orders:1', 'users', 'orders'],
      ['order_items:1', 'orders', 'order_items'],
      ['order_items:2', 'products', 'order_items'],
      ['payments:1', 'orders', 'payments'],
    ]);
  });

  it('runs from the right of the referenced table to the left of a table further right', () => {
    const { tables, positions } = ecommerceSnapshot();
    const edge = computeEdges(tables, positions).find((e) => e.id === 'orders:1');
    // users.id is row 0 of users at (24, 48); orders.user_id is row 1 of orders at (304, 24).
    expect(edge?.a).toEqual({ x: 252, y: 94, side: 1 });
    expect(edge?.b).toEqual({ x: 304, y: 94, side: -1 });
  });

  it('runs from the left of the referenced table when the referencing table is further left', () => {
    const { tables, positions } = ecommerceSnapshot();
    const edge = computeEdges(tables, positions).find((e) => e.id === 'payments:1');
    // orders.id is row 0 of orders at (304, 24); payments.order_id is row 1 of payments at (24, 336).
    expect(edge?.a).toEqual({ x: 304, y: 70, side: -1 });
    expect(edge?.b).toEqual({ x: 252, y: 406, side: 1 });
  });

  it('loops out of the right side of both tables when they overlap horizontally', () => {
    const snapshot = moveTable(ecommerceSnapshot(), 'order_items', { x: 320, y: 480 });
    const edge = computeEdges(snapshot.tables, snapshot.positions).find((e) => e.id === 'order_items:2');
    expect(edge?.a).toEqual({ x: 532, y: 374, side: 1 });
    expect(edge?.b).toEqual({ x: 548, y: 574, side: 1 });
  });

  it('follows a table as it moves', () => {
    const snapshot = moveTable(ecommerceSnapshot(), 'users', { x: 24, y: 248 });
    const edge = computeEdges(snapshot.tables, snapshot.positions).find((e) => e.id === 'orders:1');
    expect(edge?.a).toEqual({ x: 252, y: 294, side: 1 });
    expect(edge?.b).toEqual({ x: 304, y: 94, side: -1 });
  });

  it('skips foreign keys whose table is missing or not placed', () => {
    const { tables, positions } = ecommerceSnapshot();
    const withoutProducts = tables.filter((t) => t.name !== 'products');
    expect(computeEdges(withoutProducts, positions).map((e) => e.id)).toEqual(['orders:1', 'order_items:1', 'payments:1']);

    const unplaced = { ...positions };
    delete unplaced.orders;
    expect(computeEdges(tables, unplaced).map((e) => e.id)).toEqual(['order_items:2']);
  });

  it('has no edges left to a deleted table', () => {
    const snapshot = deleteTable(ecommerceSnapshot(), 'orders');
    expect(computeEdges(snapshot.tables, snapshot.positions).map((e) => e.id)).toEqual(['order_items:2']);
  });

  it('anchors on the first row when the referenced column does not exist', () => {
    const base = ecommerceSnapshot();
    const orders = tableNamed(base, 'orders');
    const snapshot = updateTable(base, 'orders', {
      ...orders,
      columns: orders.columns.map((c) => (c.name === 'user_id' ? { ...c, fk: { table: 'users', column: 'uuid' } } : c)),
    });
    const edge = computeEdges(snapshot.tables, snapshot.positions).find((e) => e.id === 'orders:1');
    expect(edge?.a.y).toBe(94);
  });

  it('draws a self-reference', () => {
    const base = ecommerceSnapshot();
    const users = tableNamed(base, 'users');
    const snapshot = updateTable(base, 'users', {
      ...users,
      columns: [...users.columns, { name: 'referred_by', type: 'BIGINT', nullable: true, fk: { table: 'users', column: 'id' } }],
    });
    const edge = computeEdges(snapshot.tables, snapshot.positions).find((e) => e.id === 'users:5');
    expect(edge).toEqual({
      id: 'users:5',
      from: 'users',
      to: 'users',
      a: { x: 252, y: 94, side: 1 },
      b: { x: 252, y: 214, side: 1 },
    });
  });
});

describe('edgePath', () => {
  it('is a cubic curve that leaves each node horizontally', () => {
    expect(edgePath({ x: 252, y: 94, side: 1 }, { x: 304, y: 94, side: -1 })).toBe('M252 94 C288 94 268 94 304 94');
    expect(edgePath({ x: 304, y: 70, side: -1 }, { x: 252, y: 406, side: 1 })).toBe('M304 70 C268 70 288 406 252 406');
    expect(edgePath({ x: 0, y: 0, side: 1 }, { x: 400, y: 100, side: -1 })).toBe('M0 0 C200 0 200 100 400 100');
  });
});

describe('viewRect and zoomAt', () => {
  it('maps the screen back to canvas units', () => {
    expect(viewRect({ x: 0, y: 0 }, 1, { w: 840, h: 600 })).toEqual({ x: 0, y: 0, w: 840, h: 600 });
    expect(viewRect({ x: -100, y: 50 }, 0.5, { w: 840, h: 600 })).toEqual({ x: 200, y: -100, w: 1680, h: 1200 });
  });

  it('keeps the canvas point under the pointer fixed while zooming', () => {
    const point = { x: 400, y: 300 };
    const before = { offset: { x: -120, y: 40 }, zoom: 1 };
    const toCanvas = (offset: { x: number; y: number }, zoom: number) => ({
      x: (point.x - offset.x) / zoom,
      y: (point.y - offset.y) / zoom,
    });

    for (const next of [0.25, 0.5, 1.5, 2]) {
      const offset = zoomAt(before.offset, before.zoom, next, point);
      expect(toCanvas(offset, next).x).toBeCloseTo(toCanvas(before.offset, before.zoom).x);
      expect(toCanvas(offset, next).y).toBeCloseTo(toCanvas(before.offset, before.zoom).y);
    }
    expect(zoomAt(before.offset, 1, 1, point)).toEqual(before.offset);
    expect(zoomAt({ x: 0, y: 0 }, 1, 2, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('minimapLayout', () => {
  const size = { w: 168, h: 108 };

  it('fits every placed table and the viewport inside the minimap', () => {
    const { tables, positions } = ecommerceSnapshot();
    const layout = minimapLayout(tables, positions, { x: 0, y: 0, w: 840, h: 600 }, size);

    expect(layout?.nodes.map((n) => n.name)).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    for (const r of [...(layout?.nodes ?? []), layout!.viewport]) {
      expect(r.x).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(160 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(100 + 1e-9);
    }
    // The viewport (840 x 600 from the origin) bounds everything here, so it sets the scale.
    expect(layout?.viewport.x).toBeCloseTo(8);
    expect(layout?.viewport.y).toBeCloseTo(8);
    expect(layout?.viewport.h).toBeCloseTo(92);
    expect(layout?.nodes[0].w).toBeCloseTo((228 * 92) / 600);
  });

  it('keeps the viewport in the picture when it is panned away from the tables', () => {
    const { tables, positions } = ecommerceSnapshot();
    const near = minimapLayout(tables, positions, { x: 0, y: 0, w: 840, h: 600 }, size);
    const far = minimapLayout(tables, positions, { x: 3000, y: 0, w: 840, h: 600 }, size);
    expect(far!.viewport.x + far!.viewport.w).toBeCloseTo(160);
    expect(far!.nodes[0].w).toBeLessThan(near!.nodes[0].w);
  });

  it('leaves out tables without a position and returns null when none is placed', () => {
    const { tables, positions } = ecommerceSnapshot();
    const partial = { users: positions.users, orders: positions.orders };
    const view = { x: 0, y: 0, w: 840, h: 600 };
    expect(minimapLayout(tables, partial, view, size)?.nodes.map((n) => n.name)).toEqual(['users', 'orders']);
    expect(minimapLayout(tables, {}, view, size)).toBeNull();
    expect(minimapLayout([], positions, view, size)).toBeNull();
  });
});

describe('stepZoom', () => {
  it('steps by whole percents without drifting', () => {
    let zoom = 1;
    for (let i = 0; i < 3; i++) zoom = stepZoom(zoom, -0.1);
    expect(zoom).toBe(0.7);
    for (let i = 0; i < 3; i++) zoom = stepZoom(zoom, 0.1);
    expect(zoom).toBe(1);
  });

  it('stops at the zoom limits', () => {
    expect(stepZoom(0.3, -0.1)).toBe(0.25);
    expect(stepZoom(0.25, -0.1)).toBe(0.25);
    expect(stepZoom(1.95, 0.1)).toBe(2);
    expect(stepZoom(2, 0.1)).toBe(2);
  });
});

describe('nodeRects', () => {
  it('gives a rectangle for each placed table and skips the others', () => {
    const { tables, positions } = ecommerceSnapshot();
    const rects = nodeRects(tables, { users: positions.users, products: positions.products });
    expect(rects).toEqual([
      { name: 'users', x: 24, y: 48, w: 228, h: 159 },
      { name: 'products', x: positions.products.x, y: positions.products.y, w: 228, h: 135 },
    ]);
  });
});

describe('fitView', () => {
  // The ecommerce sample spans x 24..812 and y 24..495 on the canvas.
  const bounds = { x: 24, y: 24, w: 788, h: 471 };

  it('describes the sample bounds this test relies on', () => {
    const { tables, positions } = ecommerceSnapshot();
    const rects = nodeRects(tables, positions);
    expect(Math.min(...rects.map((r) => r.x))).toBe(bounds.x);
    expect(Math.min(...rects.map((r) => r.y))).toBe(bounds.y);
    expect(Math.max(...rects.map((r) => r.x + r.w))).toBe(bounds.x + bounds.w);
    expect(Math.max(...rects.map((r) => r.y + r.h))).toBe(bounds.y + bounds.h);
  });

  it('centres the diagram at 100% when it fits', () => {
    const { tables, positions } = ecommerceSnapshot();
    const view = fitView(tables, positions, { w: 1200, h: 800 });
    expect(view.zoom).toBe(1);
    expect(view.offset).toEqual({ x: Math.round((1200 - 788) / 2 - 24), y: Math.round((800 - 471) / 2 - 24) });
  });

  it('zooms out until the diagram fits inside the padding', () => {
    const { tables, positions } = ecommerceSnapshot();
    const size = { w: 600, h: 500 };
    const view = fitView(tables, positions, size, 48);
    expect(view.zoom).toBeCloseTo((600 - 96) / 788, 10);
    const left = bounds.x * view.zoom + view.offset.x;
    const right = (bounds.x + bounds.w) * view.zoom + view.offset.x;
    const top = bounds.y * view.zoom + view.offset.y;
    const bottom = (bounds.y + bounds.h) * view.zoom + view.offset.y;
    expect(left).toBeGreaterThanOrEqual(47);
    expect(size.w - right).toBeGreaterThanOrEqual(47);
    expect(Math.abs(top - (size.h - bottom))).toBeLessThanOrEqual(1);
  });

  it('does not zoom below the minimum', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(fitView(tables, positions, { w: 200, h: 150 }).zoom).toBe(0.25);
  });

  it('fits only the tables it is given', () => {
    const { tables, positions } = ecommerceSnapshot();
    const view = fitView([tables[0]], positions, { w: 1000, h: 600 });
    expect(view).toEqual({ zoom: 1, offset: { x: Math.round((1000 - 228) / 2 - 24), y: Math.round((600 - 159) / 2 - 48) } });
  });

  it('resets the view when no table is placed', () => {
    expect(fitView([], {}, { w: 800, h: 600 })).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
    expect(fitView(ecommerceSnapshot().tables, {}, { w: 800, h: 600 })).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
  });
});

describe('newTablePosition', () => {
  const view = { x: 0, y: 0, w: 844, h: 800 };

  it('is the middle of the visible canvas, on the grid', () => {
    const { positions } = ecommerceSnapshot();
    expect(newTablePosition(positions, view)).toEqual({ x: 312, y: 368 });
    expect(newTablePosition({}, view)).toEqual({ x: 312, y: 368 });
  });

  it('follows the pan and the zoom', () => {
    const p = newTablePosition({}, viewRect({ x: -400, y: 120 }, 0.5, { w: 844, h: 800 }));
    expect(p).toEqual({ x: 1528, y: 528 });
  });

  it('steps down and right while a table sits at that spot', () => {
    const { positions } = ecommerceSnapshot();
    const first = { ...positions, new_table: { x: 312, y: 368 } };
    expect(newTablePosition(first, view)).toEqual({ x: 344, y: 400 });
    const second = { ...first, new_table2: { x: 344, y: 400 } };
    expect(newTablePosition(second, view)).toEqual({ x: 376, y: 432 });
  });
});

describe('gridLayout', () => {
  const sized = (name: string, columns: number) => ({
    name,
    columns: Array.from({ length: columns }, (_, i) => ({ name: `c${i}`, type: 'INT' })),
  });

  it('fills the rows from left to right when the tables are of one height', () => {
    const tables = ['a', 'b', 'c', 'd', 'e'].map((name) => sized(name, 3));
    expect(gridLayout(tables, 3)).toEqual({
      a: { x: 24, y: 24 },
      b: { x: 304, y: 24 },
      c: { x: 584, y: 24 },
      d: { x: 24, y: 176 },
      e: { x: 304, y: 176 },
    });
  });

  it('puts each table under the shortest column so far', () => {
    const positions = gridLayout([sized('tall', 12), sized('short', 1), sized('next', 1), sized('last', 1)], 2);
    expect(positions).toEqual({
      tall: { x: 24, y: 24 },
      short: { x: 304, y: 24 },
      // Both go under `short`: the first column is still the longer one.
      next: { x: 304, y: 128 },
      last: { x: 304, y: 232 },
    });
  });

  it('lays out the ecommerce sample without two tables overlapping, on the grid', () => {
    const { tables } = ecommerceSnapshot();
    const positions = gridLayout(tables);
    const rects = nodeRects(tables, positions);
    expect(rects).toHaveLength(tables.length);
    for (const a of rects) {
      expect(a.x % 8).toBe(0);
      expect(a.y % 8).toBe(0);
      for (const b of rects) {
        if (a === b) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('places a table whose name is a property of every object', () => {
    expect(Object.keys(gridLayout([sized('constructor', 1), sized('toString', 1)]))).toEqual(['constructor', 'toString']);
  });

  it('has nothing to place in an empty schema', () => {
    expect(gridLayout([])).toEqual({});
  });
});

describe('gridColumns', () => {
  it('makes the grid wider than it is tall', () => {
    expect([0, 1, 2, 5, 6, 24, 100].map(gridColumns)).toEqual([1, 2, 2, 3, 3, 6, 13]);
  });
});
