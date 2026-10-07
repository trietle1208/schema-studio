import { describe, expect, it } from 'vitest';
import { parseRoute, routePath, routeSchema, sameRoute, type Route } from './routes';

// The four screens, for the ecommerce sample at the versions the prototype compares.
const routes: [string, Route][] = [
  ['/schemas', { screen: 'schemas' }],
  ['/schemas/ecommerce', { screen: 'workspace', schema: 'ecommerce' }],
  ['/schemas/ecommerce/history', { screen: 'history', schema: 'ecommerce' }],
  ['/schemas/ecommerce/diff/v11/v12', { screen: 'diff', schema: 'ecommerce', from: 11, to: 12 }],
];

describe('routePath', () => {
  it.each(routes)('writes %s', (path, route) => {
    expect(routePath(route)).toBe(path);
  });

  it('escapes what a path cannot hold', () => {
    expect(routePath({ screen: 'workspace', schema: 'a/b c' })).toBe('/schemas/a%2Fb%20c');
  });
});

describe('parseRoute', () => {
  it.each(routes)('reads %s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('reads what routePath wrote, for any name', () => {
    for (const schema of ['auth_service', 'a/b c', 'history', 'diff', 'đơn_hàng', '100%']) {
      const route: Route = { screen: 'history', schema };
      expect(parseRoute(routePath(route))).toEqual(route);
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
  });
});

describe('routeSchema', () => {
  it('names the schema of every screen but the list', () => {
    expect(routes.map(([, route]) => routeSchema(route))).toEqual([null, 'ecommerce', 'ecommerce', 'ecommerce']);
  });
});
