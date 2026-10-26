import { analyzeSql, type SqlWarning, type SqlWarningKind } from './analyzeSql';
import { SERVER_IDS, setRun, type Change, type ServerId } from './model';

// Deploying to a server is a script: the changes that wait there, in the order they were written,
// as one file to run by hand. The app does not run it. Once it was run, the changes are marked here.

/** The one thing said about a change in the list of a deploy. */
export type DeployFlag =
  | { kind: SqlWarningKind }
  /** It failed on a server before this one. */
  | { kind: 'failed'; server: ServerId }
  /** Its pull request is not merged yet. */
  | { kind: 'pr-open' };

export interface DeployRow {
  change: Change;
  /** What the script of the change does to the data; null when it is nothing to warn about. */
  warning: SqlWarning | null;
  flag: DeployFlag | null;
  /** Whether the change starts checked: all but one whose pull request is still open. */
  checked: boolean;
}

/** The flag of a change: a drop first, then a rewrite, then a failure on an earlier server, then an open pull request. */
function flagOf(change: Change, server: ServerId, warning: SqlWarning | null): DeployFlag | null {
  if (warning) return { kind: warning.kind };
  const failed = SERVER_IDS.slice(0, SERVER_IDS.indexOf(server)).find((id) => change.runs[id].status === 'failed');
  if (failed) return { kind: 'failed', server: failed };
  return change.pr?.state === 'open' ? { kind: 'pr-open' } : null;
}

/** The changes of `database` that wait on `server`, the oldest first: the order they have to be run in. */
export function deployRows(changes: readonly Change[], database: string, server: ServerId): DeployRow[] {
  return changes
    .filter((c) => c.database === database && c.runs[server].status === 'pending')
    .sort((a, b) => a.seq - b.seq)
    .map((change) => {
      const warning = analyzeSql(change.sql, change.engine);
      return { change, warning, flag: flagOf(change, server, warning), checked: change.pr?.state !== 'open' };
    });
}

/** The rows that are checked, as the `seq` of each. */
export function defaultSelection(rows: readonly DeployRow[]): Set<number> {
  return new Set(rows.filter((r) => r.checked).map((r) => r.change.seq));
}

/** The script of the checked changes: their SQL one after the other, a blank line between. A change with no SQL adds nothing. */
export function deployScript(rows: readonly DeployRow[], selected: ReadonlySet<number>): string {
  return rows
    .filter((r) => selected.has(r.change.seq))
    .map((r) => r.change.sql.trim())
    .filter((sql) => sql !== '')
    .join('\n\n');
}

/** How many lines a script has; none for an empty one. */
export function scriptLines(script: string): number {
  return script === '' ? 0 : script.split('\n').length;
}

const two = (n: number) => String(n).padStart(2, '0');

/** `atad5s_production_2026-10-24.sql`: the database, the server and the day of `now` in local time. */
export function deployFileName(database: string, server: ServerId, now: number): string {
  const day = new Date(now);
  const date = `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
  return `${database.replace(/[^\p{L}\p{N}._-]+/gu, '_')}_${server}_${date}.sql`;
}

/** The first checked change that drops a table: its data is lost, so a copy has to be taken before it runs. */
export function backupBefore(rows: readonly DeployRow[], selected: ReadonlySet<number>): { table: string; seq: number } | null {
  const drop = rows.find((r) => selected.has(r.change.seq) && r.warning?.kind === 'drop-table');
  return drop?.warning ? { table: drop.warning.name, seq: drop.change.seq } : null;
}

/** The changes called `seqs`, as they are once run on `server` at `at`. A change that is already run there is left out. */
export function markRuns<T extends Change>(changes: readonly T[], seqs: Iterable<number>, server: ServerId, at: number): T[] {
  const wanted = new Set(seqs);
  return changes.filter((c) => wanted.has(c.seq) && c.runs[server].status !== 'ran').map((c) => setRun(c, server, 'ran', at));
}
