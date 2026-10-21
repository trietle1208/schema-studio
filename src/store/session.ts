import { create } from 'zustand';
import type { Connection } from '../core/introspect/catalog';

/**
 * Secrets of a connected schema, kept in memory for this browser session. A reload clears them.
 * Nothing here is written to IndexedDB or to a file.
 */
export interface SessionSecrets {
  /** The password of the database user. */
  password: string;
  /** SSH password auth. Left out for a key or an agent. */
  sshPassword?: string;
  /** The passphrase of an encrypted SSH key. */
  sshPassphrase?: string;
}

interface SessionState {
  /** Keyed by the schema id. */
  secrets: Record<number, SessionSecrets>;
  setSecrets: (schemaId: number, secrets: SessionSecrets) => void;
  /** Forgets the secrets of a schema, so Data mode asks for the password again. */
  clear: (schemaId: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  secrets: {},
  setSecrets: (schemaId, secrets) => set((state) => ({ secrets: { ...state.secrets, [schemaId]: secrets } })),
  clear: (schemaId) =>
    set((state) => {
      const secrets = { ...state.secrets };
      delete secrets[schemaId];
      return { secrets };
    }),
}));

/** The secrets a connection form holds, to keep beside the stored profile. */
export function secretsOf(connection: Connection): SessionSecrets {
  const ssh = connection.ssh;
  return {
    password: connection.password,
    ...(ssh?.auth === 'password' && ssh.password !== undefined ? { sshPassword: ssh.password } : {}),
    ...(ssh?.auth === 'key' && ssh.passphrase ? { sshPassphrase: ssh.passphrase } : {}),
  };
}
