import type { Connection } from '../src/core/introspect/catalog.ts';

// What the bridge takes from a request before it does anything: who may ask, and what a
// connection looks like. Nothing here touches the network.

/** The names this machine goes by. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether a page of this origin may ask: one that is served from this machine, or one of `allowed`.
 * A request without an origin comes from no page at all, but from a tool on this machine.
 */
export function allowsOrigin(origin: string | undefined, allowed: ReadonlySet<string> = new Set()): boolean {
  if (origin === undefined || allowed.has(origin)) return true;
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Whether a request was addressed to this machine by one of its own names. A page elsewhere can
 * make a name of its own resolve to this machine; the bridge does not answer to such a name.
 */
export function addressedHere(host: string | undefined): boolean {
  if (!host) return false;
  try {
    return LOCAL_HOSTS.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

/** The connection the body of a request asks for, or null when it does not describe one for an engine of `engines`. */
export function connectionOf(text: string, engines: readonly string[]): Connection | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { engine, host, port, database, user, password, schema, ssl } = value as Record<string, unknown>;
  const filled = (field: unknown): field is string => typeof field === 'string' && field.trim() !== '';
  if (typeof engine !== 'string' || !engines.includes(engine)) return null;
  if (!filled(host) || !filled(database) || !filled(user) || typeof password !== 'string') return null;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (schema !== undefined && typeof schema !== 'string') return null;
  // Only what a connection is made of goes on: anything else in the request is dropped.
  return { engine, host, port, database, user, password, ...(schema ? { schema } : {}), ...(ssl === true ? { ssl: true } : {}) };
}
