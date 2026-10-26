import { SERVER_IDS, type Change, type ServerId } from './model';

export type ChangeGroup = 'today' | 'thisWeek' | 'lastWeek' | 'older';

/** The groups of the list, newest first. */
export const CHANGE_GROUPS: readonly ChangeGroup[] = ['today', 'thisWeek', 'lastWeek', 'older'];

/** Midnight, in local time, of the day `days` days from the day of `time` (a negative number goes back). */
function dayStart(time: number, days = 0): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** Monday 00:00 of the week `time` is in, in local time (ISO weeks). */
function weekStart(time: number): number {
  const monday = (new Date(time).getDay() + 6) % 7;
  return dayStart(time, -monday);
}

/**
 * The group a change belongs to: the day of `now`, the rest of its week, the week before, or
 * anything older. Weeks run Monday to Sunday by the local calendar, not 7 days back from `now`; a
 * change from later than `now` is today's.
 */
export function changeGroup(createdAt: number, now: number): ChangeGroup {
  if (createdAt >= dayStart(now)) return 'today';
  const week = weekStart(now);
  if (createdAt >= week) return 'thisWeek';
  if (createdAt >= dayStart(week, -7)) return 'lastWeek';
  return 'older';
}

/** The changes under each group they belong to, in the order of the groups and the order they were given in; a group with none is left out. */
export function groupChanges<T extends Change>(changes: readonly T[], now: number): { group: ChangeGroup; changes: T[] }[] {
  const groups = CHANGE_GROUPS.map((group) => ({ group, changes: [] as T[] }));
  for (const change of changes) groups[CHANGE_GROUPS.indexOf(changeGroup(change.createdAt, now))].changes.push(change);
  return groups.filter((g) => g.changes.length > 0);
}

export const hasPending = (change: Change) => SERVER_IDS.some((id) => change.runs[id].status === 'pending');
export const hasFailed = (change: Change) => SERVER_IDS.some((id) => change.runs[id].status === 'failed');

/** The server a change goes to next: the first in the pipeline where it is pending. A server it failed on or does not apply to is not next. */
export function nextServer(change: Change): ServerId | null {
  return SERVER_IDS.find((id) => change.runs[id].status === 'pending') ?? null;
}

const count = (changes: readonly Change[], keep: (change: Change) => boolean) => changes.filter(keep).length;

/** How many changes wait on `server`. */
export const pendingOn = (changes: readonly Change[], server: ServerId) => count(changes, (c) => c.runs[server].status === 'pending');

/** How many changes failed on `server`. */
export const failedOn = (changes: readonly Change[], server: ServerId) => count(changes, (c) => c.runs[server].status === 'failed');

/** How many changes `server` still needs: the ones that wait and the ones that have to be run again. This is the number the server strip shows. */
export const outstandingOn = (changes: readonly Change[], server: ServerId) =>
  count(changes, (c) => c.runs[server].status === 'pending' || c.runs[server].status === 'failed');

/** How many changes wait on some server. */
export const pendingChanges = (changes: readonly Change[]) => count(changes, hasPending);

export type RunFilter = 'all' | 'pending' | 'failed';

/**
 * The changes the list shows. A server keeps the changes that wait or failed on it; none keeps
 * every change. Then All keeps what is left, Pending the changes that wait, Failed the ones that
 * failed, on that server when there is one and on any server when there is none. A change that
 * waits on one server and failed on another is both Pending and Failed.
 */
export function filterChanges<T extends Change>(changes: readonly T[], server: ServerId | null, run: RunFilter): T[] {
  const pending = (c: Change) => (server ? c.runs[server].status === 'pending' : hasPending(c));
  const failed = (c: Change) => (server ? c.runs[server].status === 'failed' : hasFailed(c));
  if (run === 'pending') return changes.filter(pending);
  if (run === 'failed') return changes.filter(failed);
  return server ? changes.filter((c) => pending(c) || failed(c)) : [...changes];
}

/** What each of All, Pending and Failed would show, for the same server. */
export function runCounts(changes: readonly Change[], server: ServerId | null): Record<RunFilter, number> {
  return {
    all: filterChanges(changes, server, 'all').length,
    pending: filterChanges(changes, server, 'pending').length,
    failed: filterChanges(changes, server, 'failed').length,
  };
}

/**
 * The server a deploy is prepared for: `chosen` when a server is picked, otherwise the last
 * server of the pipeline where `database` still has a change waiting. Null when there is none.
 */
export function deployServer(changes: readonly Change[], database: string, chosen: ServerId | null): ServerId | null {
  if (chosen) return chosen;
  const ofDatabase = changes.filter((c) => c.database === database);
  return [...SERVER_IDS].reverse().find((id) => pendingOn(ofDatabase, id) > 0) ?? null;
}
