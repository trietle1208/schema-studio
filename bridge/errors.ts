/** A database that was reached and then could not be read: the connection itself was fine. */
export class CatalogError extends Error {}

/** The server of an SSH tunnel could not be logged in to: not reached, refused, or the key could not be used. */
export class SshError extends Error {}

/** A server whose key is not the one that was trusted for it, or that nothing was trusted for yet. */
export class HostKeyError extends SshError {
  fingerprint: string;
  /** Whether another key was trusted for the server, which is a reason to stop and not only to ask. */
  changed: boolean;

  constructor(fingerprint: string, changed: boolean) {
    super(changed ? `The key of the server is not the one that was trusted: ${fingerprint}` : `The key of the server is not known yet: ${fingerprint}`);
    this.fingerprint = fingerprint;
    this.changed = changed;
  }
}

/** What an error says. A connection that is refused on every address of a host comes as several errors with no message of their own. */
export function messageOf(thrown: unknown): string {
  if (thrown instanceof AggregateError) return [...new Set(thrown.errors.map(messageOf))].join('; ');
  if (thrown instanceof Error) return thrown.message || (thrown as NodeJS.ErrnoException).code || thrown.name;
  return String(thrown);
}

/** Runs the reading of a catalog, so that what fails in it is told apart from a connection that failed. */
export async function reading<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (thrown) {
    throw new CatalogError(messageOf(thrown));
  }
}
