/** A place in the app. Every screen but the schema list is about one schema, named in the route. */
export type Route =
  | { screen: 'schemas' }
  | { screen: 'workspace'; schema: string }
  | { screen: 'history'; schema: string }
  /** Compares version `from` (the base) with version `to`. */
  | { screen: 'diff'; schema: string; from: number; to: number };

export type Screen = Route['screen'];

export const SCHEMAS_ROUTE: Route = { screen: 'schemas' };

const VERSION = /^v([1-9]\d*)$/;

function version(segment: string): number | null {
  const match = VERSION.exec(segment);
  return match ? Number(match[1]) : null;
}

/**
 * The path of a route, as it goes in the address bar after the `#`:
 * `/schemas`, `/schemas/ecommerce`, `/schemas/ecommerce/history`, `/schemas/ecommerce/diff/v11/v12`.
 */
export function routePath(route: Route): string {
  if (route.screen === 'schemas') return '/schemas';
  const schema = `/schemas/${encodeURIComponent(route.schema)}`;
  if (route.screen === 'workspace') return schema;
  if (route.screen === 'history') return `${schema}/history`;
  return `${schema}/diff/v${route.from}/v${route.to}`;
}

/**
 * The route a path stands for, or null when it is not one. A leading `#` and a slash at the end
 * are ignored, so the text of `location.hash` can be passed as it is.
 */
export function parseRoute(path: string): Route | null {
  const [lead, ...segments] = path.replace(/^#/, '').split('/');
  if (lead !== '') return null;
  if (segments[segments.length - 1] === '') segments.pop();
  if (segments[0] !== 'schemas') return null;
  if (segments.length === 1) return SCHEMAS_ROUTE;

  let schema: string;
  try {
    schema = decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  if (!schema) return null;
  if (segments.length === 2) return { screen: 'workspace', schema };
  if (segments.length === 3 && segments[2] === 'history') return { screen: 'history', schema };
  if (segments.length === 5 && segments[2] === 'diff') {
    const from = version(segments[3]);
    const to = version(segments[4]);
    if (from !== null && to !== null) return { screen: 'diff', schema, from, to };
  }
  return null;
}

export function sameRoute(a: Route, b: Route): boolean {
  return routePath(a) === routePath(b);
}

/** The schema a route is about; null for the schema list. */
export function routeSchema(route: Route): string | null {
  return route.screen === 'schemas' ? null : route.schema;
}
