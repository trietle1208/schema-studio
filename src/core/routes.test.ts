import { describe, expect, it } from 'vitest';
import { ecommerceTables } from './fixtures/ecommerce';
import { dataTable, modeRoute, parseRoute, routeMode, routePath, routeSchema, sameRoute, type Route } from './routes';

// The screens, for the ecommerce sample at the versions the prototype compares.
const routes: [string, Route][] = [
  ['/schemas', { screen: 'schemas' }],
  ['/schemas/ecommerce', { screen: 'workspace', schema: 'ecommerce' }],
  ['/schemas/ecommerce/history', { screen: 'history', schema: 'ecommerce' }],
  ['/schemas/ecommerce/diff/v11/v12', { screen: 'diff', schema: 'ecommerce', from: 11, to: 12 }],
  ['/schemas/ecommerce/data/users', { screen: 'data', schema: 'ecommerce', table: 'users' }],
  ['/schemas/ecommerce/query', { screen: 'query', schema: 'ecommerce' }],
];

describe('routePath', () => {
  it.each(routes)('writes %s', (path, route) => {
    expect(routePath(route)).toBe(path);
  });

  it('escapes what a path cannot hold', () => {
    expect(routePath({ screen: 'workspace', schema: 'a/b c' })).toBe('/schemas/a%2Fb%20c');
    expect(routePath({ screen: 'data', schema: 'a b', table: 'order/items' })).toBe('/schemas/a%20b/data/order%2Fitems');
  });
});

describe('parseRoute', () => {
  it.each(routes)('reads %s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('reads what routePath wrote, for any name', () => {
    for (const schema of ['auth_service', 'a/b c', 'history', 'diff', 'data', 'query', 'đơn_hàng', '100%']) {
      const route: Route = { screen: 'history', schema };
      expect(parseRoute(routePath(route))).toEqual(route);
      expect(parseRoute(routePath({ screen: 'query', schema }))).toEqual({ screen: 'query', schema });
      for (const table of ['users', 'order items', 'a/b', 'data', 'history', 'đơn_hàng', '100%']) {
        const data: Route = { screen: 'data', schema, table };
        expect(parseRoute(routePath(data))).toEqual(data);
      }
    }
  });

  it('takes the hash of the address as it is', () => {
    expect(parseRoute('#/schemas/ecommerce')).toEqual({ screen: 'workspace', schema: 'ecommerce' });
    expect(parseRoute('#/schemas/')).toEqual({ screen: 'schemas' });
    expect(parseRoute('/schemas/ecommerce/history/')).toEqual({ screen: 'history', schema: 'ecommerce' });
  });

  it.each([
    '',
    '#',
    '#/',
    '/',
    'schemas',
    '/tables',
    '/schemas//history',
    '/schemas/ecommerce/versions',
    '/schemas/ecommerce/history/v2',
    '/schemas/ecommerce/diff',
    '/schemas/ecommerce/diff/v11',
    '/schemas/ecommerce/diff/11/12',
    '/schemas/ecommerce/diff/v0/v1',
    '/schemas/ecommerce/diff/v1/v2/v3',
    '/schemas/%E0%A4%A',
    '/schemas/ecommerce/data',
    '/schemas/ecommerce/data/',
    '/schemas/ecommerce/data//',
    '/schemas/ecommerce/data/%E0%A4%A',
    '/schemas/ecommerce/data/users/rows',
    '/schemas/ecommerce/query/history',
  ])('is null for %j', (path) => {
    expect(parseRoute(path)).toBeNull();
  });
});

describe('sameRoute', () => {
  it('compares the screen and what it is about', () => {
    expect(sameRoute({ screen: 'schemas' }, { screen: 'schemas' })).toBe(true);
    expect(sameRoute({ screen: 'workspace', schema: 'blog' }, { screen: 'workspace', schema: 'blog' })).toBe(true);
    expect(sameRoute({ screen: 'workspace', schema: 'blog' }, { screen: 'history', schema: 'blog' })).toBe(false);
    expect(sameRoute({ screen: 'workspace', schema: 'blog' }, { screen: 'workspace', schema: 'ecommerce' })).toBe(false);
    expect(
      sameRoute({ screen: 'diff', schema: 'blog', from: 1, to: 2 }, { screen: 'diff', schema: 'blog', from: 1, to: 3 }),
    ).toBe(false);
    expect(sameRoute({ screen: 'data', schema: 'blog', table: 'posts' }, { screen: 'data', schema: 'blog', table: 'posts' })).toBe(true);
    expect(sameRoute({ screen: 'data', schema: 'blog', table: 'posts' }, { screen: 'data', schema: 'blog', table: 'users' })).toBe(false);
    expect(sameRoute({ screen: 'data', schema: 'blog', table: 'posts' }, { screen: 'query', schema: 'blog' })).toBe(false);
  });
});

describe('routeMode', () => {
  it('names the mode of the three workspace screens and no other', () => {
    expect(routes.map(([, route]) => routeMode(route))).toEqual([null, 'diagram', null, null, 'data', 'query']);
  });
});

describe('modeRoute', () => {
  it('is the route that shows the mode', () => {
    expect(modeRoute('diagram', 'ecommerce', 'users')).toEqual({ screen: 'workspace', schema: 'ecommerce' });
    expect(modeRoute('query', 'ecommerce', 'users')).toEqual({ screen: 'query', schema: 'ecommerce' });
    expect(modeRoute('data', 'ecommerce', 'users')).toEqual({ screen: 'data', schema: 'ecommerce', table: 'users' });
  });

  it('has no Data route without a table, and the other two do not need one', () => {
    expect(modeRoute('data', 'ecommerce', null)).toBeNull();
    expect(modeRoute('diagram', 'ecommerce', null)).not.toBeNull();
    expect(modeRoute('query', 'ecommerce', null)).not.toBeNull();
  });

  it('leads back to the mode it came from', () => {
    for (const [, route] of routes) {
      const mode = routeMode(route);
      if (mode && route.screen !== 'schemas') expect(modeRoute(mode, route.schema, route.screen === 'data' ? route.table : 'users')).toEqual(route);
    }
  });
});

describe('dataTable', () => {
  const tables = ecommerceTables;

  it('opens the table selected on the diagram', () => {
    expect(dataTable(tables, 'orders')).toBe('orders');
  });

  it('opens the first table when none is selected, or the selected one is gone', () => {
    expect(dataTable(tables, null)).toBe(tables[0].name);
    expect(dataTable(tables, 'dropped')).toBe(tables[0].name);
  });

  it('opens nothing for a schema without tables', () => {
    expect(dataTable([], 'orders')).toBeNull();
  });
});

describe('routeSchema', () => {
  it('names the schema of every screen but the list', () => {
    expect(routes.map(([, route]) => routeSchema(route))).toEqual([null, 'ecommerce', 'ecommerce', 'ecommerce', 'ecommerce', 'ecommerce']);
  });
});
