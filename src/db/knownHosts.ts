import { db, type KnownHostRecord } from './db';

// The SSH servers whose keys were trusted. The bridge keeps nothing: the app says which key a
// server is known by with every request, and the bridge logs in only to a server that has it.

/** How a server is told apart from others: the way it is typed in the form, without regard to case. */
export function hostId(host: string, port: number): string {
  return `${host.trim().toLowerCase()}:${port}`;
}

/** The fingerprint trusted for a server, or undefined when none was. */
export async function knownHostKey(host: string, port: number): Promise<string | undefined> {
  return (await db.knownHosts.get(hostId(host, port)))?.fingerprint;
}

/** Trusts `fingerprint` for a server. A key that was trusted for it before is replaced. */
export async function trustHost(host: string, port: number, fingerprint: string): Promise<KnownHostRecord> {
  const record = { id: hostId(host, port), fingerprint, trustedAt: Date.now() };
  await db.knownHosts.put(record);
  return record;
}

/** Forgets a server, so that its key is asked about again. */
export async function forgetHost(host: string, port: number): Promise<void> {
  await db.knownHosts.delete(hostId(host, port));
}
