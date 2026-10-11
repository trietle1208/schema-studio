import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Server, utils } from 'ssh2';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SshTunnel } from '../src/core/introspect/catalog.ts';
import { HostKeyError, SshError } from './errors.ts';
import { fingerprintOf, openTunnel, type Tunnel } from './tunnel.ts';

// The tunnel is tried against a server of SSH that runs in this process and that carries a
// connection to an echo server of TCP, the way a server in front of a database would.

const PASSWORD = 'correct horse';

const hostKey = utils.generateKeyPairSync('ed25519');
const userKey = utils.generateKeyPairSync('ed25519');

/** What the server of SSH holds for the test that is running, and what it sees. */
let echo: net.Server;
let ssh: Server;
let sshPort: number;
let echoPort: number;
let folder: string;
const tunnels: Tunnel[] = [];

const listening = (server: net.Server) =>
  new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)));

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'schema-studio-tunnel-'));
  await writeFile(join(folder, 'id_ed25519'), userKey.private);
  await writeFile(join(folder, 'id_wrong'), utils.generateKeyPairSync('ed25519').private);
  return async () => {
    await rm(folder, { recursive: true, force: true });
  };
});

beforeAll(async () => {
  echo = net.createServer((socket) => socket.pipe(socket).on('error', () => {}));
  echoPort = await listening(echo);
  const userPublic = utils.parseKey(userKey.public);
  if (userPublic instanceof Error) throw userPublic;
  ssh = new Server({ hostKeys: [hostKey.private] }, (client) => {
    client.on('authentication', (context) => {
      if (context.username !== 'tunneler') return context.reject();
      if (context.method === 'password' && context.password === PASSWORD) return context.accept();
      if (context.method === 'publickey' && context.key.algo === userPublic.type && Buffer.compare(context.key.data, userPublic.getPublicSSH()) === 0) {
        return context.accept();
      }
      return context.reject(['password', 'publickey']);
    });
    client.on('ready', () => {
      client.on('tcpip', (accept, reject, info) => {
        const onward = net.connect(info.destPort, info.destIP);
        onward.once('error', () => reject());
        onward.once('connect', () => {
          const channel = accept();
          channel.pipe(onward).pipe(channel);
          channel.on('close', () => onward.destroy());
        });
      });
    });
    client.on('error', () => {});
  });
  sshPort = await listening(ssh as unknown as net.Server);
  return async () => {
    ssh.close();
    echo.close();
  };
});

afterEach(() => {
  for (const tunnel of tunnels.splice(0)) tunnel.close();
});

const hostPublic = utils.parseKey(hostKey.public);
if (hostPublic instanceof Error) throw hostPublic;
/** The fingerprint the server is known by. */
const trusted = fingerprintOf(hostPublic.getPublicSSH());

const login = (changes: Partial<SshTunnel> = {}): SshTunnel => ({
  host: '127.0.0.1',
  port: sshPort,
  user: 'tunneler',
  auth: 'password',
  password: PASSWORD,
  hostKey: trusted,
  ...changes,
});

const open = async (tunnel: SshTunnel, port = echoPort) => {
  const opened = await openTunnel(tunnel, { host: '127.0.0.1', port });
  tunnels.push(opened);
  return opened;
};

/** What the other end sends back for a line, when it is sent through `tunnel`. */
function roundTrip(tunnel: Tunnel, line: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(tunnel.port, tunnel.host, () => socket.write(line));
    socket.once('data', (data) => {
      socket.destroy();
      resolve(data.toString());
    });
    socket.once('error', reject);
    socket.once('close', () => resolve(''));
  });
}

describe('openTunnel', () => {
  it('carries a connection to the target from the server', async () => {
    const tunnel = await open(login());
    expect(tunnel.host).toBe('127.0.0.1');
    expect(await roundTrip(tunnel, 'SELECT 1')).toBe('SELECT 1');
  });

  it('logs in with a private key file', async () => {
    const tunnel = await open(login({ auth: 'key', keyPath: join(folder, 'id_ed25519'), password: undefined }));
    expect(await roundTrip(tunnel, 'hello')).toBe('hello');
  });

  it('lets in only the one connection of the driver', async () => {
    const tunnel = await open(login());
    expect(await roundTrip(tunnel, 'first')).toBe('first');
    await expect(roundTrip(tunnel, 'second')).rejects.toThrow();
  });

  it('asks whether to trust a server whose key it does not know', async () => {
    const error = await open(login({ hostKey: undefined })).catch((thrown) => thrown);
    expect(error).toBeInstanceOf(HostKeyError);
    expect(error).toMatchObject({ fingerprint: trusted, changed: false });
  });

  it('refuses a server whose key is not the one that was trusted', async () => {
    const other = fingerprintOf(Buffer.from('another key'));
    const error = await open(login({ hostKey: other })).catch((thrown) => thrown);
    expect(error).toBeInstanceOf(HostKeyError);
    expect(error).toMatchObject({ fingerprint: trusted, changed: true });
  });

  it('fails with a wrong password, a user that is not known and a key that is not accepted', async () => {
    for (const changes of [{ password: 'wrong' }, { user: 'someone' }, { auth: 'key', keyPath: join(folder, 'id_wrong') } as const]) {
      const error = await open(login(changes)).catch((thrown) => thrown);
      expect(error).toBeInstanceOf(SshError);
      expect(error).not.toBeInstanceOf(HostKeyError);
    }
  });

  it('says so when the key file cannot be read', async () => {
    await expect(open(login({ auth: 'key', keyPath: join(folder, 'missing') }))).rejects.toThrow(/private key could not be read/);
    await expect(open(login({ auth: 'key', keyPath: '' }))).rejects.toThrow(/path of the private key is empty/);
  });

  it('fails when the server cannot be reached', async () => {
    await expect(open(login({ port: 1 }))).rejects.toBeInstanceOf(SshError);
  });

  it('ends a connection to a target the server cannot reach', async () => {
    const closed = net.createServer();
    const gone = await listening(closed);
    closed.close();
    const tunnel = await open(login(), gone);
    expect(await roundTrip(tunnel, 'anyone there?')).toBe('');
  });

  it('can be closed more than once, and then no longer lets anyone in', async () => {
    const tunnel = await open(login());
    tunnel.close();
    tunnel.close();
    await expect(roundTrip(tunnel, 'late')).rejects.toThrow();
  });
});
