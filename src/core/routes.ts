/** A place in the app. Every screen but the schema list is about one schema, named in the route. */
export type Route =
  | { screen: 'schemas' }
  | { screen: 'workspace'; schema: string }
  | { screen: 'history'; schema: string }
  /** Compares version `from` (the base) with version `to`. */
  | { screen: 'diff'; schema: string; from: number; to: number }
  /** The records of one table of the schema. */
  | { screen: 'data'; schema: string; table: string }
  /** The query console of the schema. */
  | { screen: 'query'; schema: string };

export type Screen = Route['screen'];

/** What the workspace shows: the diagram of the schema, the records of a table, or the query console. */
export type WorkspaceMode = 'diagram' | 'data' | 'query';

export const SCHEMAS_ROUTE: Route = { screen: 'schemas' };

const VERSION = /^v([1-9]\d*)$/;

function version(segment: string): number | null {
  const match = VERSION.exec(segment);
  return match ? Number(match[1]) : null;
}

/** A segment of a path with its escapes undone; null when it is empty or its escapes are broken. */
function decoded(segment: string): string | null {
  try {
    return decodeURIComponent(segment) || null;
  } catch {
    return null;
  }
}

/**
 * The path of a route, as it goes in the address bar after the `#`:
 * `/schemas`, `/schemas/ecommerce`, `/schemas/ecommerce/history`, `/schemas/ecommerce/diff/v11/v12`,
 * `/schemas/ecommerce/data/users`, `/schemas/ecommerce/query`.
 */
export function routePath(route: Route): string {
  if (route.screen === 'schemas') return '/schemas';
  const schema = `/schemas/${encodeURIComponent(route.schema)}`;
  if (route.screen === 'workspace') return schema;
  if (route.screen === 'history') return `${schema}/history`;
  if (route.screen === 'data') return `${schema}/data/${encodeURIComponent(route.table)}`;
  if (route.screen === 'query') return `${schema}/query`;
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

  const schema = decoded(segments[1]);
  if (!schema) return null;
  if (segments.length === 2) return { screen: 'workspace', schema };
  if (segments.length === 3 && segments[2] === 'history') return { screen: 'history', schema };
  if (segments.length === 3 && segments[2] === 'query') return { screen: 'query', schema };
  if (segments.length === 4 && segments[2] === 'data') {
    const table = decoded(segments[3]);
    if (table) return { screen: 'data', schema, table };
  }
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

/** The workspace mode a route is in; null for a screen that is not one (the list, history, a comparison). */
export function routeMode(route: Route): WorkspaceMode | null {
  if (route.screen === 'workspace') return 'diagram';
  if (route.screen === 'data' || route.screen === 'query') return route.screen;
  return null;
}

/**
 * The route that shows `mode` of `schema`. Data needs a table: `table` is the one to open, and with
 * none (a schema without tables) there is no such route.
 */
export function modeRoute(mode: WorkspaceMode, schema: string, table: string | null): Route | null {
  if (mode === 'diagram') return { screen: 'workspace', schema };
  if (mode === 'query') return { screen: 'query', schema };
  return table === null ? null : { screen: 'data', schema, table };
}

/**
 * The table the Data mode opens on: `preferred` (the one selected on the diagram) when the schema has
 * it, else the first table; null for a schema without tables.
 */
export function dataTable(tables: readonly { name: string }[], preferred: string | null): string | null {
  return tables.find((t) => t.name === preferred)?.name ?? tables[0]?.name ?? null;
}
