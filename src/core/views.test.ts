import { describe, expect, it } from 'vitest';
import { computeEdges } from './layout';
import type { Table } from './model';
import { diagramViewProblem, hideHubEdges, overlayPositions, pickPositions, viewAt, viewIsShowing } from './views';

const users: Table = { name: 'users', columns: [{ name: 'id', type: 'BIGINT', pk: true }] };
const orders: Table = {
  name: 'orders',
  columns: [
    { name: 'id', type: 'BIGINT', pk: true },
    { name: 'user_id', type: 'BIGINT', fk: { table: 'users', column: 'id' } },
  ],
};

describe('saved view positions', () => {
  const base = {
    users: { x: 24, y: 48, w: 220 },
    orders: { x: 304, y: 24, cols: 'keys' as const },
  };

  it('copies the placements of the named tables and leaves the diagram alone', () => {
    const picked = pickPositions(base, ['orders', 'missing']);
    expect(picked).toEqual({ orders: { x: 304, y: 24, cols: 'keys' } });
    picked.orders.x = 9;
    expect(base.orders.x).toBe(304);
  });

  it('lays a view over the diagram without changing either', () => {
    const extra = { users: { x: 80, y: 90, w: 260 } };
    const over = overlayPositions(base, extra);
    expect(over.users).toEqual({ x: 80, y: 90, w: 260 });
    expect(over.orders).toBe(base.orders);
    expect(overlayPositions(base, {})).toBe(base);
    extra.users.x = 1;
    expect(over.users.x).toBe(80);
    expect(base.users).toEqual({ x: 24, y: 48, w: 220 });
  });

  it('matches a view to the tables on the canvas, in the order of the schema', () => {
    const tables = [users, orders];
    expect(viewIsShowing(tables, ['orders', 'users'], ['users', 'orders'])).toBe(true);
    expect(viewIsShowing(tables, ['users', 'gone'], ['users'])).toBe(true);
    expect(viewIsShowing(tables, ['users'], ['users', 'orders'])).toBe(false);
  });
});

describe('the first nine views', () => {
  const views = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('numbers them from 1 and stops at 9', () => {
    expect(viewAt(views, 1)).toBe('a');
    expect(viewAt(views, 9)).toBe('i');
    expect(viewAt(views, 10)).toBeNull();
    expect(viewAt(views, 0)).toBeNull();
    expect(viewAt(['only'], 2)).toBeNull();
  });
});

describe('a view name', () => {
  const views = [{ id: 1, name: 'Pay' }];

  it('refuses a blank name and one another view has', () => {
    expect(diagramViewProblem('  ', views)).toBe('empty');
    expect(diagramViewProblem('Pay', views)).toBe('taken');
    expect(diagramViewProblem('Pay', views, 1)).toBeNull();
    expect(diagramViewProblem(' Staff ', views)).toBeNull();
  });
});

describe('hub lines', () => {
  it('drops the line that ends on a hub and keeps the others', () => {
    const positions = { users: { x: 0, y: 0 }, orders: { x: 320, y: 0 } };
    const edges = computeEdges([users, orders], positions);
    expect(edges.map((edge) => edge.from)).toEqual(['users']);
    expect(hideHubEdges(edges, new Set(['users']))).toEqual([]);
    expect(hideHubEdges(edges, new Set())).toBe(edges);
    expect(hideHubEdges(edges, new Set(['products']))).toBe(edges);
  });
});
