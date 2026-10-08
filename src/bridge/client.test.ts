import { afterEach, describe, expect, it, vi } from 'vitest';
import { mysqlCatalog } from '../core/fixtures/catalogs';
import type { Connection } from '../core/introspect/catalog';
import { BRIDGE_URL, bridgeRunning, readCatalog } from './client';

const connection: Connection = { engine: 'MySQL', host: 'localhost', port: 3306, database: 'shop', user: 'reader', password: 'secret' };

/** Makes `fetch` answer with `body` as JSON, and gives the calls it got. */
function answering(body: unknown, status = 200) {
  const fetched = vi.fn<(url: string, request?: RequestInit) => Promise<Response>>(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fetched);
  return fetched;
}

afterEach(() => vi.unstubAllGlobals());

describe('bridgeRunning', () => {
  it('holds when the bridge says its name', async () => {
    const fetched = answering({ name: 'schema-studio-bridge', engines: ['PostgreSQL', 'MySQL'] });
    expect(await bridgeRunning()).toBe(true);
    expect(fetched.mock.calls[0][0]).toBe('http://127.0.0.1:4577');
    expect(BRIDGE_URL).toBe('http://127.0.0.1:4577');
  });

  it('does not hold when nothing listens, or something else does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await bridgeRunning()).toBe(false);
    answering({ name: 'another-server' });
    expect(await bridgeRunning()).toBe(false);
    answering('<html>It works!</html>');
    expect(await bridgeRunning()).toBe(false);
  });
});

describe('readCatalog', () => {
  it('sends the connection as JSON and gives the catalog that was read', async () => {
    const fetched = answering({ ok: true, catalog: mysqlCatalog });
    expect(await readCatalog(connection)).toEqual({ ok: true, catalog: mysqlCatalog });
    const [url, request] = fetched.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:4577/introspect');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(request?.body as string)).toEqual(connection);
  });

  it('gives the error of a database that could not be reached, as the bridge words it', async () => {
    const error = { message: 'Could not connect to the database.', detail: 'password authentication failed for user "reader"' };
    answering({ ok: false, error }, 502);
    expect(await readCatalog(connection)).toEqual({ ok: false, error });
  });

  it('says how to start the bridge when it is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await readCatalog(connection)).toEqual({
      ok: false,
      error: {
        message: 'The connection bridge is not running.',
        detail: 'Start it with `npm run bridge` in the project folder, then connect again.',
      },
    });
  });

  it('does not take the answer of another server for one of the bridge', async () => {
    for (const body of ['<html>404</html>', { hello: 'world' }, { ok: true }, { ok: false }, null]) {
      answering(body, 404);
      const answer = await readCatalog(connection);
      expect(answer).toMatchObject({ ok: false, error: { message: 'The connection bridge gave no answer.' } });
    }
  });
});
