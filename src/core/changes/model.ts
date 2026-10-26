// The change log: which server is still missing which change. A change is one script that was
// written for a database and is run by hand, server by server, in the order of the pipeline.

export type ServerId = 'local' | 'demo' | 'staging' | 'production';

/** The `--group-*` token a server is drawn in. */
export type ServerColor = 'gray' | 'cyan' | 'violet' | 'orange';

export interface Server {
  id: ServerId;
  /** The one letter that heads its column in the list. */
  letter: string;
  color: ServerColor;
  /** Marking a change as run here asks first. */
  protected: boolean;
}

/** The servers a change goes through, in pipeline order: a change reaches Local first and Production last. */
export const SERVERS: readonly Server[] = [
  { id: 'local', letter: 'L', color: 'gray', protected: false },
  { id: 'demo', letter: 'D', color: 'cyan', protected: false },
  { id: 'staging', letter: 'S', color: 'violet', protected: false },
  { id: 'production', letter: 'P', color: 'orange', protected: true },
];

export const SERVER_IDS: readonly ServerId[] = SERVERS.map((s) => s.id);

export function serverOf(id: ServerId): Server {
  return SERVERS.find((s) => s.id === id)!;
}

/** What happened to a change on one server: it was run, it waits, it failed, or it does not apply there. */
export type RunStatus = 'ran' | 'pending' | 'failed' | 'na';

/** What a run was before it was last set, so that one step can be taken back. */
export interface RunBefore {
  status: RunStatus;
  at?: number;
}

export interface Run {
  status: RunStatus;
  /** Milliseconds since the epoch: when it was run. Only a run that happened has one. */
  at?: number;
  undo?: RunBefore;
}

export type PullRequestState = 'open' | 'merged';

export interface PullRequest {
  repo: string;
  number: number;
  state: PullRequestState;
  /** Where it is on the host. Without one the number is only text. */
  url?: string;
}

export interface Change {
  /** Counts up across the whole log, whatever the database: `#0046`. */
  seq: number;
  /** The ticket it was written for: `ATA-312`. */
  key: string;
  title: string;
  /** The database, which is also the name of a schema when there is one. */
  database: string;
  engine: string;
  branch: string;
  pr?: PullRequest;
  /** Milliseconds since the epoch. */
  createdAt: number;
  sql: string;
  rollback: string;
  notes: string;
  runs: Record<ServerId, Run>;
}

/** The change as it is written, with `#` and four digits at least: `#0046`. */
export function seqLabel(seq: number): string {
  return `#${String(seq).padStart(4, '0')}`;
}

/** A run that waits, on every server. */
export function pendingRuns(): Record<ServerId, Run> {
  return { local: { status: 'pending' }, demo: { status: 'pending' }, staging: { status: 'pending' }, production: { status: 'pending' } };
}

/** `change` with the run on `server` set to `status`; the run it replaces is kept for one undo. A run that is set to what it already is stays as it was. */
export function setRun<T extends Change>(change: T, server: ServerId, status: RunStatus, at?: number): T {
  const before = change.runs[server];
  if (before.status === status) return change;
  const run: Run = { status, undo: { status: before.status, ...(before.at !== undefined ? { at: before.at } : {}) } };
  if (status === 'ran' && at !== undefined) run.at = at;
  return { ...change, runs: { ...change.runs, [server]: run } };
}

/** `change` with the last setting of the run on `server` taken back. A run with nothing to take back stays as it is. */
export function undoRun<T extends Change>(change: T, server: ServerId): T {
  const { undo } = change.runs[server];
  if (!undo) return change;
  const run: Run = { status: undo.status, ...(undo.at !== undefined ? { at: undo.at } : {}) };
  return { ...change, runs: { ...change.runs, [server]: run } };
}
