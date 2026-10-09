import { describe, expect, it } from 'vitest';
import { deleteTable, moveTable, updateTable } from './edit';
import { ecommerceSnapshot, inferredTables, tableNamed } from './fixtures/testing';
import {
  centreOn,
  clampNodeWidth,
  clampZoom,
  computeEdges,
  draggedWidth,
  drawnEnds,
  edgeEnds,
  edgePath,
  fitView,
  fittingWidth,
  gridColumns,
  gridLayout,
  minimapLayout,
  minimapPoint,
  newTablePosition,
  nodeHeight,
  nodeRects,
  nodeWidth,
  rectBetween,
  snap,
  stepZoom,
  tablesInRect,
  viewRect,
  widened,
  zoomAt,
} from './layout';
import type { Positions, Table } from './model';

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
      // The column may be empty: a row of users need not be referred by another.
      optional: true,
    });
  });
});

describe('edgeEnds', () => {
  it('is where the edge of the foreign key is drawn once it is there', () => {
    const { tables, positions } = ecommerceSnapshot();
    const edges = computeEdges(tables, positions);
    // orders.user_id, row 1 of orders, references users.id, row 0 of users.
    const { a, b } = edges.find((e) => e.id === 'orders:1')!;
    expect(edgeEnds(positions.orders, 1, positions.users, 0)).toEqual({ a, b });
    // payments is left of orders, which it references.
    const payment = edges.find((e) => e.id === 'payments:1')!;
    expect(edgeEnds(positions.payments, 1, positions.orders, 0)).toEqual({ a: payment.a, b: payment.b });
  });
});

describe('drawnEnds', () => {
  // orders is at (304, 24) and 228 wide; user_id is its row 1.
  it('runs from the side of the table the pointer is past to the pointer', () => {
    const { positions } = ecommerceSnapshot();
    expect(drawnEnds(positions.orders, 1, { x: 700, y: 300 })).toEqual({
      a: { x: 700, y: 300, side: -1 },
      b: { x: 532, y: 94, side: 1 },
    });
    expect(drawnEnds(positions.orders, 1, { x: 120, y: 60 })).toEqual({
      a: { x: 120, y: 60, side: 1 },
      b: { x: 304, y: 94, side: -1 },
    });
  });

  it('loops out of the right side to a pointer over or under the table, as the edge of tables that overlap does', () => {
    const { positions } = ecommerceSnapshot();
    expect(drawnEnds(positions.orders, 1, { x: 320, y: 400 })).toEqual({
      a: { x: 320, y: 400, side: 1 },
      b: { x: 532, y: 94, side: 1 },
    });
    expect(drawnEnds(positions.orders, 1, { x: 303, y: 400 }).b).toEqual({ x: 304, y: 94, side: -1 });
    expect(drawnEnds(positions.orders, 1, { x: 532, y: 400 }).a.side).toBe(-1);
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

  it('says where it draws the canvas', () => {
    const { tables, positions } = ecommerceSnapshot();
    const view = { x: 400, y: 200, w: 840, h: 600 };
    const layout = minimapLayout(tables, positions, view, size)!;
    for (const n of layout.nodes) {
      const p = positions[n.name];
      expect(minimapPoint(layout, n).x).toBeCloseTo(p.x);
      expect(minimapPoint(layout, n).y).toBeCloseTo(p.y);
    }
    expect(minimapPoint(layout, layout.viewport).x).toBeCloseTo(400);
    expect(minimapPoint(layout, layout.viewport).y).toBeCloseTo(200);
    // The padding is canvas too: its corner is left of and above everything that is drawn.
    expect(minimapPoint(layout, { x: 0, y: 0 }).x).toBeCloseTo(Math.min(...Object.values(positions).map((p) => p.x)) - 8 / layout.scale);
  });

  it('holds the picture still while the visible area moves over it', () => {
    const { tables, positions } = ecommerceSnapshot();
    const before = minimapLayout(tables, positions, { x: 0, y: 0, w: 840, h: 600 }, size)!;
    const moved = minimapLayout(tables, positions, { x: 3000, y: -900, w: 840, h: 600 }, size, before)!;

    expect(moved.scale).toBe(before.scale);
    expect(moved.origin).toEqual(before.origin);
    expect(moved.nodes).toEqual(before.nodes);
    // The visible area goes where it is, off the minimap here, at the size it had.
    expect(moved.viewport.x).toBeCloseTo(before.viewport.x + 3000 * before.scale);
    expect(moved.viewport.y).toBeCloseTo(before.viewport.y - 900 * before.scale);
    expect(moved.viewport.w).toBeCloseTo(before.viewport.w);
    expect(moved.viewport.x).toBeGreaterThan(size.w);
  });
});

describe('centreOn', () => {
  const view = { w: 840, h: 600 };
  const minimap = { w: 168, h: 108 };

  it('puts a canvas point in the middle of the view at any zoom', () => {
    for (const zoom of [0.5, 1, 1.5]) {
      const point = { x: 692, y: 344 };
      const rect = viewRect(centreOn(point, zoom, view), zoom, view);
      expect(rect.x + rect.w / 2).toBeCloseTo(point.x, 0);
      expect(rect.y + rect.h / 2).toBeCloseTo(point.y, 0);
    }
    expect(centreOn({ x: 0, y: 0 }, 1, view)).toEqual({ x: 420, y: 300 });
    expect(centreOn({ x: 100.3, y: 0 }, 0.5, view)).toEqual({ x: 370, y: 300 });
  });

  it('moves the visible area of the minimap to the point that was pressed', () => {
    const { tables, positions } = ecommerceSnapshot();
    const zoom = 2;
    const start = { x: 0, y: 0 };
    const layout = minimapLayout(tables, positions, viewRect(start, zoom, view), minimap)!;
    // A press on the middle of the last table, which is under the view at this zoom.
    const node = layout.nodes[layout.nodes.length - 1];
    const press = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
    expect(tablesInRect(tables, positions, viewRect(start, zoom, view))).not.toContain(node.name);
    const offset = centreOn(minimapPoint(layout, press), zoom, view);

    expect(tablesInRect(tables, positions, viewRect(offset, zoom, view))).toContain(node.name);
    const after = minimapLayout(tables, positions, viewRect(offset, zoom, view), minimap, layout)!;
    expect(after.viewport.x + after.viewport.w / 2).toBeCloseTo(press.x, 0);
    expect(after.viewport.y + after.viewport.h / 2).toBeCloseTo(press.y, 0);
    expect(after.viewport.w).toBeCloseTo(layout.viewport.w);
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

describe('the width of a table', () => {
  it('is what tables have by themselves until a table is given another', () => {
    const { positions } = ecommerceSnapshot();
    expect(nodeWidth(positions.users)).toBe(228);
    expect(nodeWidth({ ...positions.users, w: 300 })).toBe(300);
    expect(nodeWidth(undefined)).toBe(228);
  });

  it('is a whole step of 4, no narrower than 160 and no wider than 640', () => {
    expect(clampNodeWidth(300)).toBe(300);
    expect(clampNodeWidth(301)).toBe(300);
    expect(clampNodeWidth(302)).toBe(304);
    expect(clampNodeWidth(228)).toBe(228);
    expect(clampNodeWidth(50)).toBe(160);
    expect(clampNodeWidth(2000)).toBe(640);
  });

  it('follows the right side as it is dragged', () => {
    const { users } = ecommerceSnapshot().positions;
    expect(draggedWidth(users, 1, 72)).toBe(300);
    expect(draggedWidth(users, 1, 73.4)).toBe(300);
    expect(draggedWidth(users, 1, -500)).toBe(160);
    expect(draggedWidth({ ...users, w: 300 }, 1, -72)).toBe(228);
  });

  it('follows the left side as it is dragged, which lands on the grid', () => {
    const { users } = ecommerceSnapshot().positions;
    // users is at 24 and ends at 252. Its left side goes to -56, and to 64.
    expect(draggedWidth(users, -1, -80)).toBe(308);
    expect(draggedWidth(users, -1, -83)).toBe(308);
    expect(draggedWidth(users, -1, 40)).toBe(188);
    expect(draggedWidth(users, -1, 500)).toBe(160);
  });

  it('keeps the side that was not dragged where it is', () => {
    const { users } = ecommerceSnapshot().positions;
    expect(widened(users, 300)).toEqual({ x: 24, y: 48, w: 300 });
    expect(widened(users, 308, -1)).toEqual({ x: -56, y: 48, w: 308 });
    expect(widened({ x: 24, y: 48, w: 300 }, 160, -1)).toEqual({ x: 164, y: 48, w: 160 });
    expect(widened(users, 5000)).toEqual({ x: 24, y: 48, w: 640 });
  });

  it('does not keep the width tables have by themselves', () => {
    expect(widened({ x: 24, y: 48, w: 300 }, 228)).toEqual({ x: 24, y: 48 });
    expect(widened({ x: 24, y: 48, w: 300 }, 228, -1)).toEqual({ x: 96, y: 48 });
  });

  it('fits the name of the table and the name and type of its widest column', () => {
    const sample = ecommerceSnapshot();
    // `created_at TIMESTAMP`, 19 characters of 7.2px, and 72px around them: 208.8, on the next step.
    expect(fittingWidth(tableNamed(sample, 'users'))).toBe(212);
    // `product_id BIGINT`, 16 characters, is not the widest: `price DECIMAL(12,2)` has 18.
    expect(fittingWidth(tableNamed(sample, 'order_items'))).toBe(204);
    const wide: Table = {
      name: 'da_chung_tu_phe_duyet',
      columns: [{ name: 'nguoi_phe_duyet_cuoi_cung_id', type: 'BIGINT UNSIGNED', nullable: true, fk: null }],
    };
    // 28 + 15 characters and the `?` of a nullable column.
    expect(fittingWidth(wide)).toBe(392);
    // The name of the table when no column is as wide: its 32 characters, 63px around them and the count of the columns (6.6px).
    expect(fittingWidth({ name: 'bang_ke_chi_tiet_hoa_don_dau_vao', columns: [{ name: 'id', type: 'INT', nullable: false }] })).toBe(300);
    expect(fittingWidth({ name: 'bang_ke_chi_tiet_hoa_don_dau_vao_', columns: [{ name: 'id', type: 'INT', nullable: false }] })).toBe(308);
    expect(fittingWidth({ name: 't', columns: [] })).toBe(160);
    expect(fittingWidth({ name: 'x'.repeat(200), columns: [] })).toBe(640);
  });

  it('is the width of the rectangle of the table, which the view is fitted to', () => {
    const { tables, positions } = ecommerceSnapshot();
    const wide = { ...positions, order_items: { ...positions.order_items, w: 400 } };
    expect(nodeRects(tables, wide).find((r) => r.name === 'order_items')).toMatchObject({ x: 584, w: 400 });
    // The diagram is 172 wider, so it is shown smaller in a canvas it filled.
    expect(fitView(tables, wide, { w: 884, h: 800 }).zoom).toBeLessThan(fitView(tables, positions, { w: 884, h: 800 }).zoom);
    // The part of order_items that is past where it ended is touched by a frame there.
    expect(tablesInRect(tables, positions, { x: 900, y: 200, w: 40, h: 40 })).toEqual([]);
    expect(tablesInRect(tables, wide, { x: 900, y: 200, w: 40, h: 40 })).toEqual(['order_items']);
  });

  it('is where the lines of a table leave its right side', () => {
    const { tables, positions } = ecommerceSnapshot();
    // payments, at 24, references orders, at 304: the line ends at the right side of payments.
    const narrow = { ...positions, payments: { ...positions.payments, w: 160 } };
    expect(computeEdges(tables, narrow).find((e) => e.id === 'payments:1')?.b).toMatchObject({ x: 184, side: 1 });
    // users made so wide that it reaches under orders: the line leaves the right side of both.
    const wide = { ...positions, users: { ...positions.users, w: 300 } };
    const edge = computeEdges(tables, wide).find((e) => e.id === 'orders:1');
    expect(edge?.a).toMatchObject({ x: 324, side: 1 });
    expect(edge?.b).toMatchObject({ x: 532, side: 1 });
    expect(drawnEnds(wide.users, 1, { x: 900, y: 100 }).b).toMatchObject({ x: 324, side: 1 });
  });

  it('is the width of the columns of a grid of wider tables', () => {
    const { tables } = ecommerceSnapshot();
    const xs = (positions: Positions) => [...new Set(Object.values(positions).map((p) => p.x))];
    expect(xs(gridLayout(tables, 3))).toEqual([24, 304, 584]);
    expect(xs(gridLayout(tables, 3, 400))).toEqual([24, 480, 928]);
  });
});

describe('rectBetween and tablesInRect', () => {
  it('makes the same rectangle whichever corner the drag began at', () => {
    const rect = { x: 40, y: 16, w: 200, h: 120 };
    expect(rectBetween({ x: 40, y: 16 }, { x: 240, y: 136 })).toEqual(rect);
    expect(rectBetween({ x: 240, y: 16 }, { x: 40, y: 136 })).toEqual(rect);
    expect(rectBetween({ x: 240, y: 136 }, { x: 40, y: 16 })).toEqual(rect);
  });

  it('finds the tables a frame covers any part of, in the order of the schema', () => {
    const { tables, positions } = ecommerceSnapshot();
    // users is at 24,48 and 228 by 159; orders at 304,24; payments at 24,336.
    expect(tablesInRect(tables, positions, { x: 200, y: 0, w: 150, h: 60 })).toEqual(['users', 'orders']);
    expect(tablesInRect(tables, positions, { x: 0, y: 150, w: 100, h: 250 })).toEqual(['users', 'payments']);
    expect(tablesInRect(tables, positions, { x: 0, y: 0, w: 2000, h: 2000 })).toEqual(tables.map((t) => t.name));
  });

  it('finds none in the gap between tables, and none that has no position', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(tablesInRect(tables, positions, { x: 256, y: 0, w: 40, h: 600 })).toEqual([]);
    expect(tablesInRect(tables, { orders: positions.orders }, { x: 0, y: 0, w: 2000, h: 2000 })).toEqual(['orders']);
  });

  it('counts a click without a drag as a frame on the table under it', () => {
    const { tables, positions } = ecommerceSnapshot();
    expect(tablesInRect(tables, positions, rectBetween({ x: 100, y: 100 }, { x: 100, y: 100 }))).toEqual(['users']);
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

describe('inferred foreign keys', () => {
  it('get the edge a declared one gets, marked so that it is drawn dashed', () => {
    const { tables, positions } = ecommerceSnapshot();
    const declared = computeEdges(tables, positions);
    const inferred = computeEdges(inferredTables(), positions);
    expect(inferred).toEqual(declared.map((edge) => ({ ...edge, inferred: true })));
    expect(declared.every((edge) => !('inferred' in edge))).toBe(true);
  });
});
