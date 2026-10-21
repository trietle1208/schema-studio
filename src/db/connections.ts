import type { Connection, SshTunnel } from '../core/introspect/catalog';
import type { SessionSecrets } from '../store/session';
import { db, type ConnectionRecord, type ConnectionSshRecord } from './db';

// The connection profile of a schema imported from MySQL. The password and the SSH passphrase
// never go into the record: the caller keeps them in the session store.

/** The SSH fields that may be stored. A password and a passphrase are left out. */
function storedSsh(ssh: SshTunnel): ConnectionSshRecord {
  return {
    host: ssh.host,
    port: ssh.port,
    user: ssh.user,
    auth: ssh.auth,
    ...(ssh.auth === 'key' && ssh.keyPath ? { keyPath: ssh.keyPath } : {}),
  };
}

/**
 * The profile to store for a MySQL connection, or null for any other engine. The returned record
 * has no password, no SSH password and no passphrase.
 */
export function connectionRecord(schemaId: number, connection: Connection): ConnectionRecord | null {
  if (connection.engine !== 'MySQL') return null;
  return {
    schemaId,
    engine: 'MySQL',
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    ...(connection.ssl ? { ssl: true } : {}),
    ...(connection.ssh ? { ssh: storedSsh(connection.ssh) } : {}),
  };
}

/** Stores the profile of a schema, replacing one it already has. */
export function saveConnection(record: ConnectionRecord): Promise<void> {
  return db.connections.put(record).then(() => undefined);
}

/** The profile of a schema, or undefined when it was imported from a file. */
export function getConnection(schemaId: number): Promise<ConnectionRecord | undefined> {
  return db.connections.get(schemaId);
}

/** The connection the bridge is asked with: the stored profile, the session secrets, and the trusted host key. */
export function connectionFromProfile(profile: ConnectionRecord, secrets: SessionSecrets, hostKey?: string): Connection {
  const ssh = profile.ssh;
  return {
    engine: profile.engine,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    user: profile.user,
    password: secrets.password,
    ...(profile.ssl ? { ssl: true } : {}),
    ...(ssh
      ? {
          ssh: {
            host: ssh.host,
            port: ssh.port,
            user: ssh.user,
            auth: ssh.auth,
            ...(ssh.auth === 'key' && ssh.keyPath ? { keyPath: ssh.keyPath } : {}),
            ...(ssh.auth === 'password' && secrets.sshPassword !== undefined ? { password: secrets.sshPassword } : {}),
            ...(ssh.auth === 'key' && secrets.sshPassphrase ? { passphrase: secrets.sshPassphrase } : {}),
            ...(hostKey ? { hostKey } : {}),
          },
        }
      : {}),
  };
}
