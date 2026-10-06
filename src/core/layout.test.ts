import { describe, expect, it } from 'vitest';
import { deleteTable, moveTable, updateTable } from './edit';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import { clampZoom, computeEdges, edgePath, minimapLayout, nodeHeight, snap, viewRect, zoomAt } from './layout';

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
