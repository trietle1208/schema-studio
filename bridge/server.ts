import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  BRIDGE_NAME,
  BRIDGE_PORT,
  type BridgeAnswer,
  type BridgeInfo,
  type Catalog,
  type Connection,
} from '../src/core/introspect/catalog.ts';
import { CatalogError, messageOf } from './errors.ts';
import { readMysql } from './mysql.ts';
import { readPostgres } from './postgres.ts';
import { addressedHere, allowsOrigin, connectionOf } from './requests.ts';

// The connection bridge of Schema Studio: `npm run bridge`.
//
// A browser cannot open a connection to a database, so the app asks this process to. It reads
// the catalog of the database it is given, in a read-only transaction, and answers with what it
// read. It never writes, and it never runs SQL that the app sends: the app only says where the
// database is.
//
// It listens on this machine only, and only answers pages that are served from this machine.
// Give it other origins with `--allow-origin https://studio.example.com` when the app is not.

const READERS: Record<string, (connection: Connection) => Promise<Catalog>> = { PostgreSQL: readPostgres, MySQL: readMysql };
const HOST = '127.0.0.1';
/** A connection is a few short fields. */
const MAX_BODY_BYTES = 16 * 1024;

/** The values that follow `--name` on the command line, one for each time it is given. */
function option(name: string): string[] {
  const args = process.argv.slice(2);
  return args.flatMap((arg, i) => (arg === `--${name}` && args[i + 1] !== undefined ? [args[i + 1]] : []));
}

const port = Number(option('port')[0] ?? process.env.SCHEMA_STUDIO_BRIDGE_PORT ?? BRIDGE_PORT);
const allowedOrigins = new Set(option('allow-origin'));

function send(response: ServerResponse, status: number, body: unknown, origin: string | undefined) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  });
  response.end(JSON.stringify(body));
}

const refuse = (response: ServerResponse, status: number, message: string, origin?: string) =>
  send(response, status, { ok: false, error: { message } } satisfies BridgeAnswer, origin);

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('The request is too large.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function introspect(connection: Connection): Promise<BridgeAnswer> {
  const where = `${connection.engine} ${connection.database} @ ${connection.host}:${connection.port}`;
  try {
    const catalog = await READERS[connection.engine](connection);
    console.log(`${where}: read ${catalog.tables.length} tables`);
    return { ok: true, catalog };
  } catch (thrown) {
    const detail = messageOf(thrown);
    console.log(`${where}: ${detail}`);
    const message = thrown instanceof CatalogError ? 'Could not read the tables of the database.' : 'Could not connect to the database.';
    return { ok: false, error: { message, detail } };
  }
}

const server = createServer((request, response) => {
  const origin = request.headers.origin;
  void (async () => {
    if (!addressedHere(request.headers.host) || !allowsOrigin(origin, allowedOrigins)) {
      return refuse(response, 403, 'The bridge only answers pages served from this machine.');
    }
    const path = new URL(request.url ?? '/', `http://${HOST}`).pathname;
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Max-Age': '600',
      });
      return response.end();
    }
    if (request.method === 'GET' && path === '/') {
      return send(response, 200, { name: BRIDGE_NAME, engines: Object.keys(READERS) } satisfies BridgeInfo, origin);
    }
    if (request.method === 'POST' && path === '/introspect') {
      // A page can only send JSON to another origin after asking first, which is where its origin is checked.
      if (!request.headers['content-type']?.startsWith('application/json')) return refuse(response, 415, 'The request must be JSON.', origin);
      let text: string;
      try {
        text = await bodyOf(request);
      } catch (thrown) {
        return refuse(response, 413, messageOf(thrown), origin);
      }
      const connection = connectionOf(text, Object.keys(READERS));
      if (!connection) return refuse(response, 400, 'The request does not describe a connection.', origin);
      const answer = await introspect(connection);
      return send(response, answer.ok ? 200 : 502, answer, origin);
    }
    return refuse(response, 404, 'Not found.', origin);
  })().catch((thrown) => {
    console.error(thrown);
    if (!response.headersSent) refuse(response, 500, 'The bridge failed.', origin);
  });
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Is the bridge already running? Try --port with another number.` : error.message);
  process.exit(1);
});

server.listen(port, HOST, () => {
  console.log(`Schema Studio connection bridge on http://${HOST}:${port}`);
  console.log(`Reads ${Object.keys(READERS).join(' and ')} catalogs in read-only transactions. This machine only. Ctrl+C stops it.`);
});
