import type { GroupColor, SchemaSnapshot, Table, TableGroup } from './model';

// Every edit returns a new list and leaves the input untouched. Groups that an edit does not
// change keep their identity, and an edit that cannot apply returns the list it was given.

/** The colours of groups, in the order they are given out. */
export const GROUP_COLORS: readonly GroupColor[] = ['violet', 'orange', 'cyan', 'pink', 'lime', 'brown', 'gray'];

const NO_GROUPS: readonly TableGroup[] = [];

/** The groups of a snapshot, which has none when it was saved before there were groups. */
export function groupsOf(snapshot: Pick<SchemaSnapshot, 'groups'>): readonly TableGroup[] {
  return snapshot.groups ?? NO_GROUPS;
}

/** The group a table is in. */
export function groupOf(groups: readonly TableGroup[], table: string): TableGroup | undefined {
  return groups.find((g) => g.tables.includes(table));
}

/** The colour a new group gets: the one the fewest groups have, the first of those in `GROUP_COLORS`. */
export function nextGroupColor(groups: readonly TableGroup[]): GroupColor {
  const used = (color: GroupColor) => groups.filter((g) => g.color === color).length;
  return GROUP_COLORS.reduce((least, color) => (used(color) < used(least) ? color : least));
}

/** The name a new group gets: `group_1`, then `group_2`… */
export function newGroupName(groups: readonly TableGroup[]): string {
  const taken = new Set(groups.map((g) => g.name));
  let n = 1;
  while (taken.has(`group_${n}`)) n++;
  return `group_${n}`;
}

/** Why a group cannot be called `name`, in the words of the design system; null when it can. `self` is the group being renamed. */
export function groupNameProblem(groups: readonly TableGroup[], name: string, self?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Group name cannot be empty.';
  if (trimmed !== self && groups.some((g) => g.name === trimmed)) return `Group "${trimmed}" already exists.`;
  return null;
}

/**
 * Puts `tables` into the group called `name`, out of the groups they were in, or out of every
 * group when `name` is null. A group that does not exist yet is added, with `color` or the next
 * colour; one that loses its last table stays, empty, until it is removed.
 */
export function assignGroup(
  groups: readonly TableGroup[],
  tables: readonly string[],
  name: string | null,
  color?: GroupColor,
): readonly TableGroup[] {
  const moving = [...new Set(tables)];
  const target = name?.trim() || null;
  let changed = false;
  const next = groups.map((g) => {
    const members =
      g.name === target ? [...g.tables, ...moving.filter((t) => !g.tables.includes(t))] : g.tables.filter((t) => !moving.includes(t));
    if (members.length === g.tables.length) return g;
    changed = true;
    return { ...g, tables: members };
  });
  if (target !== null && !groups.some((g) => g.name === target)) {
    return [...next, { name: target, color: color ?? nextGroupColor(groups), tables: moving }];
  }
  return changed ? next : groups;
}

/** Removes a group. Its tables stay, in no group. */
export function removeGroup(groups: readonly TableGroup[], name: string): readonly TableGroup[] {
  return groups.some((g) => g.name === name) ? groups.filter((g) => g.name !== name) : groups;
}

/** Gives a group another label. It keeps the one it has when `to` is not a name it can have (see `groupNameProblem`). */
export function renameGroup(groups: readonly TableGroup[], from: string, to: string): readonly TableGroup[] {
  const name = to.trim();
  if (name === from || !groups.some((g) => g.name === from) || groupNameProblem(groups, name, from)) return groups;
  return groups.map((g) => (g.name === from ? { ...g, name } : g));
}

export function recolorGroup(groups: readonly TableGroup[], name: string, color: GroupColor): readonly TableGroup[] {
  if (!groups.some((g) => g.name === name && g.color !== color)) return groups;
  return groups.map((g) => (g.name === name ? { ...g, color } : g));
}

/** The groups once the table `from` is called `to`, or is gone when `to` is null. */
export function renameMember(groups: readonly TableGroup[], from: string, to: string | null): readonly TableGroup[] {
  if (!groupOf(groups, from)) return groups;
  return groups.map((g) =>
    g.tables.includes(from) ? { ...g, tables: g.tables.flatMap((t) => (t !== from ? [t] : to === null ? [] : [to])) } : g,
  );
}

/** The groups once `copy` has been made of the table `of`: it is in the group of that table, after it. */
export function copyMember(groups: readonly TableGroup[], of: string, copy: string): readonly TableGroup[] {
  if (!groupOf(groups, of)) return groups;
  return groups.map((g) => (g.tables.includes(of) ? { ...g, tables: g.tables.flatMap((t) => (t === of ? [t, copy] : [t])) } : g));
}

/** Whether two lists hold the same groups: their names, colours and tables, in the same order. */
export function sameGroups(a: readonly TableGroup[], b: readonly TableGroup[]): boolean {
  if (a === b) return true;
  return (
    a.length === b.length &&
    a.every((g, i) => {
      const o = b[i];
      return g === o || (g.name === o.name && g.color === o.color && g.tables.length === o.tables.length && g.tables.every((t, j) => t === o.tables[j]));
    })
  );
}

/** A group that the names of the tables point to. */
export interface GroupSuggestion {
  /** The name of the table the others are called after, or what their names begin with: `da_chung_tu`. */
  name: string;
  tables: string[];
}

/** A table with the words of its name. */
interface Named {
  name: string;
  /** Where each word ends in the name. */
  ends: number[];
  /** The words as they are compared: in lower case and without the ending of a plural. */
  stems: string[];
}

/** `da_chung_tu`, `OrderItems` and `HTTPServer` are of three, two and two words. */
const WORD = /[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z0-9]+/g;

/** `orders` and `order_items` begin with one word, and so do `wp_terms` and `wp_term_taxonomy`. */
function stem(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length > 4 && lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

function named(table: Table): Named {
  const words = [...table.name.matchAll(WORD)];
  return { name: table.name, ends: words.map((w) => w.index + w[0].length), stems: words.map((w) => stem(w[0])) };
}

/**
 * The groups among `members`, which all begin with the same `depth` words. `whole` says that they
 * are every table of the schema, so that what they all begin with tells none from the others.
 */
function split(members: readonly Named[], depth: number, whole: boolean): GroupSuggestion[] {
  if (members.length < 2) return [];
  // What all of them begin with, as far as it goes and no further than the shortest name.
  let d = depth;
  while (members.every((m) => m.stems.length > d && m.stems[d] === members[0].stems[d])) d++;

  /** The tables that are called just that: the others are called after them. */
  const heads = members.filter((m) => m.stems.length === d);
  const group = (): GroupSuggestion => ({
    name: heads.length === 1 ? heads[0].name : members[0].name.slice(0, members[0].ends[d - 1]),
    tables: members.map((m) => m.name),
  });
  if (d > 0 && heads.length && !whole) return [group()];

  const buckets = new Map<string, Named[]>();
  for (const m of members) {
    if (m.stems.length === d) continue;
    buckets.set(m.stems[d], [...(buckets.get(m.stems[d]) ?? []), m]);
  }
  const families = [...buckets.values()].filter((b) => b.length > 1);
  const inFamilies = families.reduce((sum, b) => sum + b.length, 0);
  // Tables that begin alike without a table to be called after are one group, unless most of them
  // are in smaller families: `dm_kho`, `dm_khach_hang`, `dm_san_pham` are the group `dm`.
  if (d > 0 && !whole && inFamilies * 2 <= members.length) return [group()];

  const found = families.flatMap((b) => split(b, d + 1, false));
  if (d === 0 || whole) return found;
  // The rest of them are what is left of the group.
  const taken = new Set(found.flatMap((g) => g.tables));
  const rest = members.filter((m) => !taken.has(m.name));
  return rest.length > 1 ? [...found, { name: members[0].name.slice(0, members[0].ends[d - 1]), tables: rest.map((m) => m.name) }] : found;
}

/**
 * The groups the names of the tables point to: tables whose names begin with the same words are
 * of one module (`da_chung_tu`, `da_chung_tu_noi_dung`, `da_chung_tu_phe_duyet`). What every table
 * of the schema begins with (`da_`, `wp_`) makes no group. Tables that are in a group already are
 * left out, and a suggestion needs two tables that are left, or one when it adds to a group of
 * its name. In the order of the tables.
 */
export function suggestGroups(tables: readonly Table[], groups: readonly TableGroup[] = NO_GROUPS): GroupSuggestion[] {
  const members = tables.map(named).filter((m) => m.stems.length > 0);
  const grouped = new Set(groups.flatMap((g) => g.tables));
  const order = new Map(tables.map((t, i) => [t.name, i]));
  return split(members, 0, true)
    .map((s) => ({ name: s.name, tables: s.tables.filter((t) => !grouped.has(t)) }))
    .filter((s) => s.tables.length > (groups.some((g) => g.name === s.name) ? 0 : 1))
    .sort((a, b) => (order.get(a.tables[0]) ?? 0) - (order.get(b.tables[0]) ?? 0));
}
