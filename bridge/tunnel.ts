import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { Client, type ConnectConfig } from 'ssh2';
import type { SshTunnel } from '../src/core/introspect/catalog.ts';
import { HostKeyError, messageOf, SshError } from './errors.ts';

// Reaches a database through a server that can be logged in to with SSH. The bridge logs in, and
// listens on this machine for the one connection of the driver, which it carries to the database
// from the server. Nothing but that connection goes through.

const READY_TIMEOUT_MS = 8000;
const KEEPALIVE_MS = 10000;
/** Where the agent of OpenSSH listens on Windows. */
const WINDOWS_AGENT = '\\\\.\\pipe\\openssh-ssh-agent';

export interface Tunnel {
  /** Where the driver connects instead of the database. */
  host: string;
  port: number;
  /** Ends the tunnel. It can be called more than once. */
  close(): void;
}

/** The fingerprint of a host key as ssh-keygen writes it: `SHA256:` and the base64 of the hash, without padding. */
export function fingerprintOf(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}

const expandHome = (path: string) => (path === '~' || /^~[\\/]/.test(path) ? join(homedir(), path.slice(1)) : path);

/** The way to log in as the connect options of ssh2 say it. */
async function login(ssh: SshTunnel): Promise<Pick<ConnectConfig, 'password' | 'privateKey' | 'passphrase' | 'agent'>> {
  if (ssh.auth === 'password') return { password: ssh.password ?? '' };
  if (ssh.auth === 'agent') {
    const agent = process.env.SSH_AUTH_SOCK ?? (process.platform === 'win32' ? WINDOWS_AGENT : undefined);
    if (!agent) throw new SshError('No ssh-agent is running: SSH_AUTH_SOCK is not set.');
    return { agent };
  }
  if (!ssh.keyPath) throw new SshError('The path of the private key is empty.');
  try {
    return { privateKey: await readFile(expandHome(ssh.keyPath)), ...(ssh.passphrase ? { passphrase: ssh.passphrase } : {}) };
  } catch (thrown) {
    throw new SshError(`The private key could not be read: ${messageOf(thrown)}`);
  }
}

/** Logs in to the server of `ssh`, once the key it presents is the one that was trusted for it. */
async function connectClient(ssh: SshTunnel): Promise<Client> {
  const auth = await login(ssh);
  const client = new Client();
  let untrusted: HostKeyError | undefined;
  await new Promise<void>((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', (thrown) => reject(untrusted ?? new SshError(messageOf(thrown))));
    client.connect({
      host: ssh.host,
      port: ssh.port,
      username: ssh.user,
      ...auth,
      readyTimeout: READY_TIMEOUT_MS,
      keepaliveInterval: KEEPALIVE_MS,
      hostVerifier: (key: Buffer, verified: (trusted: boolean) => void) => {
        const fingerprint = fingerprintOf(key);
        if (fingerprint === ssh.hostKey) return verified(true);
        untrusted = new HostKeyError(fingerprint, ssh.hostKey !== undefined);
        verified(false);
      },
    });
  }).catch((thrown) => {
    client.end();
    throw thrown;
  });
  return client;
}

/**
 * Logs in to the server of `ssh` and opens a way to `target` from there. Rejects with a
 * `HostKeyError` when the server's key is not the one given in `ssh.hostKey`, and with a
 * `SshError` for anything else that keeps the server from being reached.
 */
export async function openTunnel(ssh: SshTunnel, target: { host: string; port: number }): Promise<Tunnel> {
  const client = await connectClient(ssh);
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    // Only the driver is let in: nothing else is told that the way is there.
    listener.close();
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    client.forwardOut(socket.remoteAddress ?? '127.0.0.1', socket.remotePort ?? 0, target.host, target.port, (failed, channel) => {
      if (failed) return socket.destroy();
      channel.on('error', () => socket.destroy());
      socket.on('close', () => channel.destroy());
      channel.on('close', () => socket.destroy());
      socket.pipe(channel).pipe(socket);
    });
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    listener.close();
    for (const socket of sockets) socket.destroy();
    client.end();
  };
  // What goes wrong after the login ends the tunnel; the driver finds its connection closed.
  client.on('error', close);
  client.on('close', close);
  try {
    const port = await new Promise<number>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', () => resolve((listener.address() as net.AddressInfo).port));
    });
    return { host: '127.0.0.1', port, close };
  } catch (thrown) {
    close();
    throw new SshError(messageOf(thrown));
  }
}
