import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  BRIDGE_NAME,
  BRIDGE_PORT,
  type BridgeAnswer,
  type BridgeError,
  type BridgeInfo,
  type Catalog,
  type Connection,
  type QueryAnswer,
  type RowsAnswer,
} from '../src/core/introspect/catalog.ts';
import { CatalogError, HostKeyError, messageOf, SshError } from './errors.ts';
import { readMysql, readMysqlQuery, readMysqlRows } from './mysql.ts';
import { readPostgres } from './postgres.ts';
import type { QueryTable } from './query.ts';
import { addressedHere, allowsOrigin, connectionOf, queryOf, rowsOf } from './requests.ts';
import type { RowsQuery } from './rows.ts';
import type { Select } from '../src/core/records/query/ast.ts';
import { openTunnel } from './tunnel.ts';

// The connection bridge of Schema Studio: `npm run bridge`.
//
// A browser cannot open a connection to a database, so the app asks this process to. It reads
// the catalog of the database it is given, in a read-only transaction, and answers with what it
// read. It also reads one page of one MySQL table: the app names the table, the columns and the
// page, and the bridge builds the SELECT. Query mode sends the SELECT it parsed; the bridge builds
// that statement too. It never writes, and it never runs SQL text that the app sends.
//
// It listens on this machine only, and only answers pages that are served from this machine.
// Give it other origins with `--allow-origin https://studio.example.com` when the app is not.

const READERS: Record<string, (connection: Connection) => Promise<Catalog>> = { PostgreSQL: readPostgres, MySQL: readMysql };
const HOST = '127.0.0.1';
/** A connection is a few short fields. */
const MAX_BODY_BYTES = 16 * 1024;
/** A connection plus the column list of one table. Rows travel back, not in. */
const ROWS_BODY_BYTES = 64 * 1024;
/** A connection, the parsed SELECT and the column lists it joins. Rows travel back, not in. */
const QUERY_BODY_BYTES = 256 * 1024;

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

async function bodyOf(request: IncomingMessage, max = MAX_BODY_BYTES): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > max) throw new Error('The request is too large.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Runs `read` against the database, through the server of `connection.ssh` when there is one. The tunnel is closed whatever comes of it. */
async function throughTunnel<T>(connection: Connection, read: (connection: Connection) => Promise<T>): Promise<T> {
  const { ssh } = connection;
  if (!ssh) return read(connection);
  const tunnel = await openTunnel(ssh, { host: connection.host, port: connection.port });
  try {
    return await read({ ...connection, host: tunnel.host, port: tunnel.port });
  } finally {
    tunnel.close();
  }
}

/** Reads the catalog, through the server of `connection.ssh` when there is one. */
function readCatalog(connection: Connection): Promise<Catalog> {
  return throughTunnel(connection, (reached) => READERS[reached.engine](reached));
}

function refused(thrown: unknown, readMessage: string): { ok: false; error: BridgeError } {
  const detail = messageOf(thrown);
  if (thrown instanceof HostKeyError) {
    const { fingerprint, changed } = thrown;
    const message = changed ? 'The key of the SSH server has changed.' : 'The SSH server is not trusted yet.';
    return { ok: false, error: { message, code: 'hostKey', detail, hostKey: { fingerprint, changed } } };
  }
  if (thrown instanceof SshError) return { ok: false, error: { message: 'Could not log in to the SSH server.', code: 'ssh', detail } };
  const read = thrown instanceof CatalogError;
  const message = read ? readMessage : 'Could not connect to the database.';
  return { ok: false, error: { message, code: read ? 'read' : 'connect', detail } };
}

async function introspect(connection: Connection): Promise<BridgeAnswer> {
  const { ssh } = connection;
  const through = ssh ? ` via ${ssh.user}@${ssh.host}:${ssh.port}` : '';
  const where = `${connection.engine} ${connection.database} @ ${connection.host}:${connection.port}${through}`;
  try {
    const catalog = await readCatalog(connection);
    console.log(`${where}: read ${catalog.tables.length} tables`);
    return { ok: true, catalog };
  } catch (thrown) {
    console.log(`${where}: ${messageOf(thrown)}`);
    return refused(thrown, 'Could not read the tables of the database.');
  }
}

async function readQuery(connection: Connection, select: Select, tables: readonly QueryTable[]): Promise<QueryAnswer> {
  const where = `${connection.database} @ ${connection.host}:${connection.port} ${select.table}`;
  try {
    const result = await throughTunnel(connection, (reached) => readMysqlQuery(reached, select, tables));
    console.log(`${where}: query returned ${result.rows.length} rows`);
    return { ok: true, ...result };
  } catch (thrown) {
    console.log(`${where}: ${messageOf(thrown)}`);
    return refused(thrown, 'Could not run the query.');
  }
}

async function readRows(connection: Connection, query: RowsQuery): Promise<RowsAnswer> {
  const where = `${connection.database} @ ${connection.host}:${connection.port} ${query.table}`;
  try {
    const page = await throughTunnel(connection, (reached) => readMysqlRows(reached, query));
    console.log(`${where}: read ${page.rows.length} of ${page.total} rows`);
    return { ok: true, ...page };
  } catch (thrown) {
    console.log(`${where}: ${messageOf(thrown)}`);
    return refused(thrown, 'Could not read the rows of the table.');
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
    if (request.method === 'POST' && path === '/rows') {
      if (!request.headers['content-type']?.startsWith('application/json')) return refuse(response, 415, 'The request must be JSON.', origin);
      let text: string;
      try {
        text = await bodyOf(request, ROWS_BODY_BYTES);
      } catch (thrown) {
        return refuse(response, 413, messageOf(thrown), origin);
      }
      const parsed = rowsOf(text);
      if ('error' in parsed) {
        const message = parsed.error === 'query' ? 'The request does not describe a table.' : 'The request does not describe a connection.';
        return refuse(response, 400, message, origin);
      }
      const answer = await readRows(parsed.connection, parsed.query);
      return send(response, answer.ok ? 200 : 502, answer, origin);
    }
    if (request.method === 'POST' && path === '/query') {
      if (!request.headers['content-type']?.startsWith('application/json')) return refuse(response, 415, 'The request must be JSON.', origin);
      let text: string;
      try {
        text = await bodyOf(request, QUERY_BODY_BYTES);
      } catch (thrown) {
        return refuse(response, 413, messageOf(thrown), origin);
      }
      const parsed = queryOf(text);
      if ('error' in parsed) {
        const message = parsed.error === 'query' ? 'The request does not describe a query.' : 'The request does not describe a connection.';
        return refuse(response, 400, message, origin);
      }
      const answer = await readQuery(parsed.connection, parsed.select, parsed.tables);
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
  console.log(`Reads ${Object.keys(READERS).join(' and ')} catalogs, one page of a MySQL table, and a MySQL SELECT, in read-only transactions. This machine only. Ctrl+C stops it.`);
});
