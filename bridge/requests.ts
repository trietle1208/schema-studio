import type { Connection, SshTunnel } from '../src/core/introspect/catalog.ts';

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

const FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/;
const filled = (field: unknown): field is string => typeof field === 'string' && field.trim() !== '';
const isPort = (field: unknown): field is number => typeof field === 'number' && Number.isInteger(field) && field >= 1 && field <= 65535;

/** The server a request asks to go through, or null when it does not describe one. */
function sshOf(value: unknown): SshTunnel | null {
  if (typeof value !== 'object' || value === null) return null;
  const { host, port, user, auth, password, keyPath, passphrase, hostKey } = value as Record<string, unknown>;
  if (!filled(host) || !isPort(port) || !filled(user)) return null;
  if (auth !== 'password' && auth !== 'key' && auth !== 'agent') return null;
  if (auth === 'password' && typeof password !== 'string') return null;
  if (auth === 'key' && !filled(keyPath)) return null;
  if (passphrase !== undefined && typeof passphrase !== 'string') return null;
  if (hostKey !== undefined && !(typeof hostKey === 'string' && FINGERPRINT.test(hostKey))) return null;
  return {
    host,
    port,
    user,
    auth,
    // Only what the way of logging in needs goes on.
    ...(auth === 'password' ? { password: password as string } : {}),
    ...(auth === 'key' ? { keyPath: keyPath as string, ...(passphrase ? { passphrase } : {}) } : {}),
    ...(hostKey ? { hostKey: hostKey as string } : {}),
  };
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
  const { engine, host, port, database, user, password, schema, ssl, ssh } = value as Record<string, unknown>;
  if (typeof engine !== 'string' || !engines.includes(engine)) return null;
  if (!filled(host) || !filled(database) || !filled(user) || typeof password !== 'string') return null;
  if (!isPort(port)) return null;
  if (schema !== undefined && typeof schema !== 'string') return null;
  const tunnel = ssh === undefined ? undefined : sshOf(ssh);
  if (tunnel === null) return null;
  // Only what a connection is made of goes on: anything else in the request is dropped.
  return {
    engine,
    host,
    port,
    database,
    user,
    password,
    ...(schema ? { schema } : {}),
    ...(ssl === true ? { ssl: true } : {}),
    ...(tunnel ? { ssh: tunnel } : {}),
  };
}
