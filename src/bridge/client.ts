import { t } from '../core/i18n';
import { BRIDGE_NAME, BRIDGE_PORT, type BridgeAnswer, type BridgeError, type BridgeInfo, type Connection } from '../core/introspect/catalog';

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

/** What the bridge says went wrong, in the language of the app. Its own words are English, and stay for a failure it does not name. */
const FAILURES = { connect: 'bridge.connectFailed', read: 'bridge.readFailed' } as const;

function inAppLanguage(error: BridgeError): BridgeError {
  return error.code ? { ...error, message: t(FAILURES[error.code]) } : error;
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
