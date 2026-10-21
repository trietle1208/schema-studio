import { t } from '../core/i18n';
import {
  BRIDGE_NAME,
  BRIDGE_PORT,
  type BridgeAnswer,
  type BridgeError,
  type BridgeInfo,
  type Connection,
  type LiveRow,
  type QueryAnswer,
  type RowsAnswer,
} from '../core/introspect/catalog';
import type { RecordSort } from '../core/records';
import type { Select } from '../core/records/query';

// The app's side of the connection bridge (see bridge/server.ts): a browser cannot open a
// connection to a database, so it asks the bridge on this machine to read the catalog.

/** Where the bridge is asked. `VITE_BRIDGE_URL` names another place than the one it listens on by default. */
export const BRIDGE_URL: string = (import.meta.env?.VITE_BRIDGE_URL as string | undefined) ?? `http://127.0.0.1:${BRIDGE_PORT}`;

/** What starts the bridge, as the dialog says it. */
export const BRIDGE_COMMAND = 'npm run bridge';

/** How long the bridge has to say that it is there. It is on this machine, so it answers at once or not at all. */
const HELLO_TIMEOUT_MS = 2000;

const notRunning = (): BridgeError => ({
  message: t('bridge.notRunning'),
  detail: t('bridge.notRunningDetail', { command: BRIDGE_COMMAND }),
});

const noAnswer = (): BridgeError => ({
  message: t('bridge.noAnswer'),
  detail: t('bridge.noAnswerDetail', { url: BRIDGE_URL }),
});

/** A failure the app says in its own language. Each of these has no placeholder. */
type FailureKey = 'bridge.connectFailed' | 'bridge.readFailed' | 'bridge.sshFailed' | 'data.liveReadFailed' | 'query.liveFailed';

/** What the bridge says went wrong, in the language of the app. Its own words are English, and stay for a failure it does not name. */
const FAILURES: Partial<Record<NonNullable<BridgeError['code']>, FailureKey>> = {
  connect: 'bridge.connectFailed',
  read: 'bridge.readFailed',
  ssh: 'bridge.sshFailed',
};

function inAppLanguage(error: BridgeError, failures: Partial<Record<NonNullable<BridgeError['code']>, FailureKey>> = FAILURES): BridgeError {
  if (error.code === 'hostKey') return { ...error, message: t(error.hostKey?.changed ? 'bridge.hostKeyChanged' : 'bridge.hostKeyUnknown') };
  const key = error.code ? failures[error.code] : undefined;
  return key ? { ...error, message: t(key) } : error;
}

function isLiveRow(value: unknown): value is LiveRow {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((cell) => cell === null || typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean');
}

/** Whether the bridge is running. Never rejects. */
export async function bridgeRunning(): Promise<boolean> {
  try {
    const response = await fetch(BRIDGE_URL, { signal: AbortSignal.timeout(HELLO_TIMEOUT_MS) });
    const info = (await response.json()) as Partial<BridgeInfo> | null;
    return info?.name === BRIDGE_NAME;
  } catch {
    return false;
  }
}

/**
 * Asks the bridge to read the catalog of a database. Never rejects: a bridge that is not running,
 * and a database that cannot be reached or read, come back as an error with what to do about it.
 */
export async function readCatalog(connection: Connection): Promise<BridgeAnswer> {
  let response: Response;
  try {
    response = await fetch(`${BRIDGE_URL}/introspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connection),
    });
  } catch {
    return { ok: false, error: notRunning() };
  }
  try {
    const answer = (await response.json()) as Partial<BridgeAnswer> | null;
    if (answer?.ok === true && answer.catalog) return { ok: true, catalog: answer.catalog };
    if (answer?.ok === false && typeof answer.error?.message === 'string') return { ok: false, error: inAppLanguage(answer.error) };
  } catch {
    // Not JSON: whatever answered is not the bridge.
  }
  return { ok: false, error: noAnswer() };
}

/** One page of a MySQL table. `orderBy` is one column of `columns`. */
export interface RowsRequest {
  connection: Connection;
  table: string;
  columns: string[];
  limit: number;
  offset: number;
  orderBy?: RecordSort;
}

/**
 * Asks the bridge for one page of a table and how many rows it has. Never rejects: a bridge that
 * is not running comes back as `bridge.notRunning`.
 */
export async function readRows(request: RowsRequest): Promise<RowsAnswer> {
  const { connection, orderBy, ...page } = request;
  let response: Response;
  try {
    response = await fetch(`${BRIDGE_URL}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...connection, ...page, ...(orderBy ? { orderBy } : {}) }),
    });
  } catch {
    return { ok: false, error: notRunning() };
  }
  try {
    const answer = (await response.json()) as Partial<RowsAnswer> | null;
    if (answer?.ok === true && Array.isArray(answer.rows) && answer.rows.every(isLiveRow) && typeof answer.total === 'number' && Number.isFinite(answer.total)) {
      return { ok: true, rows: answer.rows, total: answer.total };
    }
    if (answer?.ok === false && typeof answer.error?.message === 'string') {
      return { ok: false, error: inAppLanguage(answer.error, { ...FAILURES, read: 'data.liveReadFailed' }) };
    }
  } catch {
    // Not JSON: whatever answered is not the bridge.
  }
  return { ok: false, error: noAnswer() };
}

/** A SELECT to run on a live MySQL database. `tables` expands `*`. */
export interface QueryRequest {
  connection: Connection;
  select: Select;
  tables: { name: string; columns: string[] }[];
}

function isQueryAnswer(answer: Partial<QueryAnswer> | null): answer is Extract<QueryAnswer, { ok: true }> {
  if (!answer || answer.ok !== true || !Array.isArray(answer.columns) || !answer.columns.every((column) => typeof column === 'string')) return false;
  if (!Array.isArray(answer.rows) || !answer.rows.every(isLiveRow) || typeof answer.capped !== 'boolean') return false;
  return Array.isArray(answer.plan) && answer.plan.every((line) => typeof line === 'string');
}

/**
 * Asks the bridge to run one SELECT. Never rejects: a bridge that is not running comes back as
 * `bridge.notRunning`. The bridge builds the statement; this does not send SQL text.
 */
export async function readQuery(request: QueryRequest): Promise<QueryAnswer> {
  let response: Response;
  try {
    response = await fetch(`${BRIDGE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request.connection, select: request.select, tables: request.tables }),
    });
  } catch {
    return { ok: false, error: notRunning() };
  }
  try {
    const answer = (await response.json()) as Partial<QueryAnswer> | null;
    if (isQueryAnswer(answer)) return answer;
    if (answer?.ok === false && typeof answer.error?.message === 'string') {
      return { ok: false, error: inAppLanguage(answer.error, { ...FAILURES, read: 'query.liveFailed' }) };
    }
  } catch {
    // Not JSON: whatever answered is not the bridge.
  }
  return { ok: false, error: noAnswer() };
}
