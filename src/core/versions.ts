import { countChanges, diffGroups, diffSchemas, type DiffStats, type SchemaChanges } from './diff';
import type { DiffGroup, DiffOp, SchemaSnapshot, Version } from './model';
import { t, type MessageKey } from './i18n';
import { countRelations } from './relations';
import { countIndexes } from './summary';
import { dateTime, relativeTime } from './time';

/** A version number as it is shown: `v12`. Versions of a schema count up from 1. */
export function versionLabel(version: number): string {
  return `v${version}`;
}

/** A saved version as it is stored. */
export interface SavedVersion {
  version: number;
  message: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  snapshot: SchemaSnapshot;
}

/** A saved version with what it changed. */
export interface VersionEntry extends SavedVersion {
  /** The version it is compared with: the one saved before it. Null for the first. */
  previous: number | null;
  /** What it changed from `previous`; for the first version, everything it holds. */
  changes: SchemaChanges;
  groups: DiffGroup[];
  stats: DiffStats;
}

/** The versions of a schema, newest first, each with what it changed from the one before. */
export function versionEntries(versions: readonly SavedVersion[]): VersionEntry[] {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return sorted.map((saved, i) => {
    const before = sorted[i + 1];
    const changes = diffSchemas(before?.snapshot.tables ?? [], saved.snapshot.tables);
    return { ...saved, previous: before?.version ?? null, changes, groups: diffGroups(changes), stats: countChanges(changes) };
  });
}

const VERB = { add: 'version.change.add', mod: 'version.change.mod', del: 'version.change.del' } as const satisfies Record<DiffOp, MessageKey>;

/**
 * What a version did, in a line, for a version that was saved without a message: `Add order_items
 * and 10 more changes`.
 */
export function changeMessage(entry: Pick<VersionEntry, 'previous' | 'groups'>): string {
  if (entry.previous === null) return t('version.initial');
  const items = entry.groups.flatMap((group) => group.items);
  if (!items.length) return t('version.noChanges');
  const first = t(VERB[items[0].op], { path: items[0].path });
  return items.length === 1 ? first : t('version.changeAndMore', { first, count: items.length - 1 });
}

/** The message a version is listed with: its own, or what it changed. */
export function versionMessage(entry: Pick<VersionEntry, 'message' | 'previous' | 'groups'>): string {
  return entry.message.trim() || changeMessage(entry);
}

/** A version as the list shows it at the time `now`. `current` is the number of the schema's current version. */
export function versionSummary(entry: VersionEntry, current: number, now: number): Version {
  const { tables } = entry.snapshot;
  return {
    version: versionLabel(entry.version),
    current: entry.version === current,
    time: relativeTime(entry.createdAt, now),
    timestamp: dateTime(entry.createdAt),
    message: versionMessage(entry),
    tables: tables.length,
    relationships: countRelations(tables),
    indexes: countIndexes(tables),
    ...entry.stats,
  };
}

/**
 * The versions that match `query`: by their number, their message, or the name of something they
 * changed (a table, a column, an index). Case does not count, and a blank query matches every version.
 */
export function filterVersions(entries: readonly VersionEntry[], query: string): VersionEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...entries];
  return entries.filter(
    (entry) =>
      versionLabel(entry.version) === needle ||
      versionMessage(entry).toLowerCase().includes(needle) ||
      entry.groups.some((group) => group.items.some((item) => item.path.toLowerCase().includes(needle))),
  );
}
