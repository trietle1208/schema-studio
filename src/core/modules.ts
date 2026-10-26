import { suggestGroups } from './groups';
import type { GroupColor, Table, TableGroup } from './model';
import { outgoingRelations, type Relation } from './relations';

// Modules of a large schema. The names already gather tables (`suggestGroups`); foreign keys then
// join two of those groups when the lines between them are denser than chance, and split a group
// that is only the prefix every table shares (`da`), which would otherwise hide the real modules.
// A table referenced by more others than a threshold is a hub: those lines are drawn as tags, and
// they are left out of the joining, or one hub would pull the whole schema into one module.

/** How many other tables must reference a table before it is a hub. */
export const HUB_THRESHOLD = 15;

/** A table many others reference. */
export interface Hub {
  table: string;
  /** Other tables with a foreign key to it. A reference to itself does not count. */
  referencedBy: number;
}

/** One module: a prefix group, or several that the foreign keys between them joined. */
export interface SchemaModule {
  /**
   * The name it is saved under, as a group: the largest prefix it was joined from. A module of
   * tables that had no prefix is named after the table the others reference.
   */
  name: string;
  /** Those prefixes, the one with the most tables first. */
  prefixes: string[];
  /** In the order of the schema. */
  tables: string[];
  /**
   * Tables of this module that have no relationship. They belong here because they share its
   * prefix; "Not linked" is only the tables that belong to no module.
   */
  notLinked?: string[];
  /** Foreign keys with one end in this module and one in another, the most first. */
  links: ModuleLink[];
}

/** How many foreign keys run between this module and another. The same number is on both. */
export interface ModuleLink {
  module: string;
  relationships: number;
}

/** A table of a neighbourhood, and how it was reached. */
export interface Neighbour {
  table: string;
  /**
   * Steps along incoming foreign keys — tables that reference the one before — or null when it was
   * not reached that way. The table itself is 0.
   */
  incoming: number | null;
  /** Steps along outgoing foreign keys, apart from the incoming ones. */
  outgoing: number | null;
  /** Neighbours one step away, either way, that this depth does not show. The +N badge. */
  hidden: number;
}

/** One step of a path: the foreign key it walks, and which way. */
export interface PathHop {
  /** The table the step leaves. */
  from: string;
  /** The table the step arrives at. */
  to: string;
  /** The column that holds the foreign key. */
  column: string;
  /** The column it references. */
  referenced: string;
  /** `out` walks from the foreign key to the table it references; `in` walks back. */
  direction: 'out' | 'in';
}

/** The shortest way from one table to another along foreign keys. */
export interface SchemaPath {
  /** From the start to the end. */
  tables: string[];
  hops: PathHop[];
}

interface Edge {
  from: string;
  to: string;
  column: string;
  referenced: string;
}

/** A foreign key as an edge. A reference to a table the schema does not have is left out. */
function edgesOf(tables: readonly Table[]): Edge[] {
  const names = new Set(tables.map((t) => t.name));
  const edges: Edge[] = [];
  for (const table of tables) {
    for (const relation of outgoingRelations(table)) {
      if (!names.has(relation.to.table)) continue;
      edges.push({
        from: relation.from.table,
        to: relation.to.table,
        column: relation.from.column,
        referenced: relation.to.column,
      });
    }
  }
  return edges;
}

/** Other tables that reference `table`, itself excluded. */
function referencedBy(edges: readonly Edge[], table: string): number {
  const from = new Set<string>();
  for (const edge of edges) if (edge.to === table && edge.from !== table) from.add(edge.from);
  return from.size;
}

/**
 * The tables referenced by more other tables than `threshold` (15 by default): a hub. The most
 * referenced first, and the order of the schema where two are referenced alike.
 */
export function findHubs(tables: readonly Table[], threshold = HUB_THRESHOLD): Hub[] {
  const edges = edgesOf(tables);
  const order = new Map(tables.map((t, i) => [t.name, i]));
  return tables
    .map((t) => ({ table: t.name, referencedBy: referencedBy(edges, t.name) }))
    .filter((hub) => hub.referencedBy > threshold)
    .sort((a, b) => b.referencedBy - a.referencedBy || (order.get(a.table) ?? 0) - (order.get(b.table) ?? 0));
}

/**
 * The tables with no foreign key in or out, inferred ones included. A table that references only
 * itself has a relationship and is not among them. In the order of the schema.
 */
export function unlinkedTables(tables: readonly Table[]): string[] {
  const edges = edgesOf(tables);
  const linked = new Set<string>();
  for (const edge of edges) {
    linked.add(edge.from);
    linked.add(edge.to);
  }
  return tables.filter((t) => !linked.has(t.name)).map((t) => t.name);
}

/** Whether `table` begins with `prefix` at a word boundary: `da_loai` for `da`, `OrderItems` for `Order`. */
function hasPrefix(table: string, prefix: string): boolean {
  if (!table.startsWith(prefix) || table.length === prefix.length) return false;
  const next = table[prefix.length];
  return next === '_' || (next >= 'A' && next <= 'Z');
}

/** The word of `table` that follows `prefix`, so two tables of one family compare equal. */
function wordAfter(table: string, prefix: string): string {
  const rest = table.slice(prefix.length).replace(/^_/, '');
  const match = /^(?:[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z0-9]+)/.exec(rest);
  return (match?.[0] ?? rest).toLowerCase();
}

/**
 * A suggestion that is only what was left after the real families were taken: its name is a prefix
 * other tables of the schema also begin with, no table is called just that, and no two of its
 * tables begin with the same word after it. `da` over forty unrelated tables is one; `wp` is not,
 * because nothing outside it begins with `wp`.
 */
function isRemainder(name: string, members: readonly string[], tables: readonly Table[]): boolean {
  if (members.some((table) => table === name)) return false;
  if (!tables.some((table) => !members.includes(table.name) && hasPrefix(table.name, name))) return false;
  const words = new Set(members.map((table) => wordAfter(table, name)));
  return words.size === members.length;
}

/** Other prefix groups that must reference a table before that line stops joining modules. */
const SHARED_REFERENCE_GROUPS = 3;

interface Cluster {
  /** Prefix groups this cluster was joined from, in the order they were added. */
  prefixes: string[];
  tables: string[];
  /** Sum of the structural degrees of its tables. */
  degree: number;
  /** Structural foreign keys with both ends in the cluster. */
  internal: number;
}

/**
 * The modules the names and the foreign keys point to.
 *
 * Groups come from `suggestGroups`. A remainder group — the prefix left after the real families
 * were taken — is dissolved. Two groups then join when the foreign keys between them outnumber
 * what their sizes would have by chance, and are denser than the keys inside either group. Lines
 * into a hub, and into a table that three other groups already reference, do not count: a catalog
 * or a hub would otherwise pull every group that looks it up into one module. Those lines still
 * count in `links`. A table of a dissolved group joins the one module its own lines point at.
 * Every module has two tables at least.
 */
export function suggestModules(tables: readonly Table[]): SchemaModule[] {
  const suggestions = suggestGroups(tables);
  const order = new Map(tables.map((t, i) => [t.name, i]));
  const edges = edgesOf(tables);
  const kept = suggestions.filter((suggestion) => !isRemainder(suggestion.name, suggestion.tables, tables));
  const prefixOf = new Map<string, string>();
  for (const suggestion of kept) for (const table of suggestion.tables) prefixOf.set(table, suggestion.name);
  // A dissolved table is its own group, so three of them pointing at one catalog still mark it.
  const groupKey = (table: string) => prefixOf.get(table) ?? table;

  const outside = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const from = groupKey(edge.from);
    if (from === groupKey(edge.to)) continue;
    const groups = outside.get(edge.to) ?? new Set<string>();
    groups.add(from);
    outside.set(edge.to, groups);
  }
  const shared = new Set<string>([...findHubs(tables).map((hub) => hub.table)]);
  for (const [table, groups] of outside) if (groups.size >= SHARED_REFERENCE_GROUPS) shared.add(table);

  /** Weight of the lines that may join two modules. A shared reference is left out. */
  const weight = new Map<string, Map<string, number>>();
  const addWeight = (a: string, b: string) => {
    if (a === b) return;
    const [x, y] = a < b ? [a, b] : [b, a];
    const row = weight.get(x) ?? new Map<string, number>();
    row.set(y, (row.get(y) ?? 0) + 1);
    weight.set(x, row);
  };
  for (const edge of edges) if (!shared.has(edge.to)) addWeight(edge.from, edge.to);

  const degreeOf = new Map<string, number>();
  let total = 0;
  for (const [a, row] of weight) {
    for (const [b, w] of row) {
      total += w;
      degreeOf.set(a, (degreeOf.get(a) ?? 0) + w);
      degreeOf.set(b, (degreeOf.get(b) ?? 0) + w);
    }
  }

  const placed = new Set<string>();
  const clusters: Cluster[] = [];
  const internalOf = (members: readonly string[]): number => {
    const set = new Set(members);
    let found = 0;
    for (const table of members) {
      const row = weight.get(table);
      if (!row) continue;
      for (const [other, w] of row) if (set.has(other)) found += w;
    }
    return found;
  };
  const addCluster = (prefixes: string[], members: readonly string[]) => {
    const list = [...members].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    for (const table of list) placed.add(table);
    clusters.push({
      prefixes,
      tables: list,
      degree: list.reduce((sum, table) => sum + (degreeOf.get(table) ?? 0), 0),
      internal: internalOf(list),
    });
  };

  for (const suggestion of kept) addCluster([suggestion.name], suggestion.tables);
  // A table of a remainder joins only when a structural line can pull it into a module.
  for (const table of tables) {
    if (!placed.has(table.name) && (degreeOf.get(table.name) ?? 0) > 0) addCluster([], [table.name]);
  }
  if (total === 0) return foldModules(finish(clusters, edges, order), tables, edges, order);

  const pairWeight = (a: string, b: string): number => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return weight.get(x)?.get(y) ?? 0;
  };
  const between = (a: Cluster, b: Cluster): number => {
    let found = 0;
    const [small, large] = a.tables.length <= b.tables.length ? [a, b] : [b, a];
    const inLarge = new Set(large.tables);
    for (const table of small.tables) for (const other of inLarge) found += pairWeight(table, other);
    return found;
  };
  const merge = (keep: Cluster, drop: Cluster, w: number) => {
    keep.tables = [...keep.tables, ...drop.tables].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    keep.prefixes = [...keep.prefixes, ...drop.prefixes];
    keep.degree += drop.degree;
    keep.internal += drop.internal + w;
    clusters.splice(clusters.indexOf(drop), 1);
  };

  // A leftover table joins the one module its lines point at, when that one is ahead of the rest.
  let absorbed = true;
  while (absorbed) {
    absorbed = false;
    for (const free of clusters) {
      if (free.prefixes.length) continue;
      let best: Cluster | null = null;
      let bestWeight = 0;
      let tied = false;
      for (const other of clusters) {
        if (other === free || !other.prefixes.length) continue;
        const w = between(free, other);
        if (w > bestWeight) {
          best = other;
          bestWeight = w;
          tied = false;
        } else if (w === bestWeight && w > 0) tied = true;
      }
      if (!best || tied) continue;
      merge(best, free, bestWeight);
      absorbed = true;
      break;
    }
  }

  // Two prefix groups join when the line between them is denser than either is inside, and denser
  // than chance (`2 m W > D1 D2`). Two leftovers that reference each other become a module.
  for (;;) {
    let best: { a: Cluster; b: Cluster; gain: number; w: number } | null = null;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const w = between(a, b);
        if (w === 0) continue;
        const named = a.prefixes.length > 0 && b.prefixes.length > 0;
        const loose = a.prefixes.length === 0 && b.prefixes.length === 0;
        if (!named && !loose) continue;
        if (named) {
          if (w < 2) continue;
          const coupling = w / Math.min(a.tables.length, b.tables.length);
          if (coupling <= a.internal / a.tables.length || coupling <= b.internal / b.tables.length) continue;
        }
        const gain = 2 * total * w - a.degree * b.degree;
        if (gain <= 0) continue;
        const better =
          !best || gain > best.gain || (gain === best.gain && firstOf(a, b, order) < firstOf(best.a, best.b, order));
        if (better) best = { a, b, gain, w };
      }
    }
    if (!best) break;
    const keep = firstIndex(best.a, order) <= firstIndex(best.b, order) ? best.a : best.b;
    merge(keep, keep === best.a ? best.b : best.a, best.w);
  }

  return foldModules(finish(clusters, edges, order), tables, edges, order);
}

/** The earlier of the two clusters' first tables, then the other's, as one ordering. */
function firstOf(a: Cluster, b: Cluster, order: ReadonlyMap<string, number>): number {
  const [x, y] = firstIndex(a, order) <= firstIndex(b, order) ? [a, b] : [b, a];
  return firstIndex(x, order) * 1_000_003 + firstIndex(y, order);
}

function firstIndex(cluster: Cluster, order: ReadonlyMap<string, number>): number {
  return order.get(cluster.tables[0]) ?? 0;
}

/** Modules of at least two tables, with the lines between them. */
function finish(clusters: readonly Cluster[], edges: readonly Edge[], order: ReadonlyMap<string, number>): SchemaModule[] {
  const named = clusters
    .filter((cluster) => cluster.tables.length > 1)
    .map((cluster) => ({ ...cluster, name: moduleName(cluster, edges, order) }));
  const seen = new Map<string, number>();
  for (const cluster of named) {
    const taken = seen.get(cluster.name) ?? 0;
    seen.set(cluster.name, taken + 1);
    if (taken > 0) cluster.name = `${cluster.name}_${taken + 1}`;
  }

  const moduleOf = new Map<string, string>();
  for (const cluster of named) for (const table of cluster.tables) moduleOf.set(table, cluster.name);

  const linkCount = new Map<string, number>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const a = moduleOf.get(edge.from);
    const b = moduleOf.get(edge.to);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
    linkCount.set(key, (linkCount.get(key) ?? 0) + 1);
  }

  const modules: SchemaModule[] = named.map((cluster) => {
    const links: ModuleLink[] = [];
    for (const [key, relationships] of linkCount) {
      const [left, right] = key.split('\0');
      const other = left === cluster.name ? right : right === cluster.name ? left : null;
      if (other) links.push({ module: other, relationships });
    }
    links.sort((a, b) => b.relationships - a.relationships || a.module.localeCompare(b.module));
    return { name: cluster.name, prefixes: prefixList(cluster, cluster.name), tables: cluster.tables, links };
  });
  modules.sort((a, b) => (order.get(a.tables[0]) ?? 0) - (order.get(b.tables[0]) ?? 0));
  return modules;
}

/** The largest prefix, or the table of the cluster that the others reference. */
function moduleName(cluster: Cluster, edges: readonly Edge[], order: ReadonlyMap<string, number>): string {
  if (cluster.prefixes.length) {
    const counts = new Map<string, number>();
    // The name is the prefix that covers the most tables. A table counts for the longest one it has.
    for (const table of cluster.tables) {
      const prefix = longestPrefix(table, cluster.prefixes);
      if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    const ranked = [...new Set(cluster.prefixes)].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
    return ranked[0];
  }
  const incoming = new Map<string, number>();
  const members = new Set(cluster.tables);
  for (const edge of edges) {
    if (edge.from === edge.to || !members.has(edge.from) || !members.has(edge.to)) continue;
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  return [...cluster.tables].sort((a, b) => (incoming.get(b) ?? 0) - (incoming.get(a) ?? 0) || (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
}

function longestPrefix(table: string, prefixes: readonly string[]): string | null {
  let best: string | null = null;
  for (const prefix of prefixes) {
    if (table === prefix || hasPrefix(table, prefix)) {
      if (!best || prefix.length > best.length) best = prefix;
    }
  }
  return best;
}

/** The prefixes of a cluster, the one that names the most of its tables first. The module's own name when it had none. */
function prefixList(cluster: Cluster, name: string): string[] {
  if (!cluster.prefixes.length) return [name];
  const counts = new Map<string, number>();
  for (const table of cluster.tables) {
    const prefix = longestPrefix(table, cluster.prefixes);
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return [...new Set(cluster.prefixes)].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

/**
 * The modules of a large schema, after the prefix groups are known.
 *
 * A module of fewer than three tables joins the module it has the most foreign keys to. A foreign
 * key into a hub does not count, or the hubs would collect every small module. With none, or with
 * a tie, it joins Other. A table with no relationship that shares a prefix with a module belongs
 * to that module. A table is in `wp` only when its name starts with `wp_`, or it has a foreign key
 * to a `wp_*` table and is not a `da_*` table, so `da_khao_sat` stays out. Past 16 modules, the
 * smallest joins Other, which keeps the schema inside the range the Modules view can show. A
 * smaller schema is left as the prefix groups named it.
 */
function foldModules(
  modules: SchemaModule[],
  tables: readonly Table[],
  edges: readonly Edge[],
  order: ReadonlyMap<string, number>,
): SchemaModule[] {
  const loose = new Set(unlinkedTables(tables));
  if (tables.length <= FOLD_FROM) {
    return modules.map((module) => ({ ...module, notLinked: module.tables.filter((name) => loose.has(name)) }));
  }

  const hubs = new Set(findHubs(tables).map((hub) => hub.table));
  const joinsWp = (name: string): boolean => {
    if (name.startsWith('wp_')) return true;
    if (name.startsWith('da_')) return false;
    return edges.some((edge) => edge.from === name && edge.to.startsWith('wp_'));
  };
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const drafts: Draft[] = modules.map((module) => ({ name: module.name, prefixes: [...module.prefixes], tables: [...module.tables] }));
  const wp = drafts.find((draft) => draft.name === 'wp');
  if (wp) {
    const leave = wp.tables.filter((name) => !joinsWp(name));
    wp.tables = wp.tables.filter((name) => joinsWp(name));
    for (const name of leave) drafts.push({ name, prefixes: [], tables: [name] });
  }
  const placed = new Set(drafts.flatMap((draft) => draft.tables));
  for (const table of tables) if (!placed.has(table.name)) drafts.push({ name: table.name, prefixes: [], tables: [table.name] });

  const ownerOf = (name: string) => drafts.find((draft) => draft.tables.includes(name));
  const absorb = (into: Draft, drop: Draft) => {
    into.tables = [...into.tables, ...drop.tables].sort(byOrder);
    into.prefixes = [...new Set([...into.prefixes, ...drop.prefixes])];
    drafts.splice(drafts.indexOf(drop), 1);
  };
  const other = (): Draft => {
    const found = drafts.find((draft) => draft.name === OTHER_NAME);
    if (found) return found;
    const made: Draft = { name: OTHER_NAME, prefixes: [], tables: [] };
    drafts.push(made);
    return made;
  };
  const prefixTarget = (name: string): Draft | null => {
    let best: Draft | null = null;
    let bestScore = 1;
    for (const draft of drafts) {
      if (draft.name === OTHER_NAME || draft.tables.includes(name)) continue;
      if (draft.name === 'wp' && !joinsWp(name)) continue;
      const score = Math.max(sharedStem(name, draft.name), ...draft.prefixes.map((prefix) => sharedStem(name, prefix)));
      if (score < 2) continue;
      if (!best || score > bestScore || (score === bestScore && draft.tables.length > best.tables.length)) {
        best = draft;
        bestScore = score;
      }
    }
    return best;
  };
  const fkTarget = (draft: Draft): Draft | null => {
    const mine = new Set(draft.tables);
    const counts = new Map<Draft, number>();
    for (const edge of edges) {
      if (!mine.has(edge.from) || hubs.has(edge.to)) continue;
      const dest = ownerOf(edge.to);
      if (!dest || dest === draft || dest.name === OTHER_NAME) continue;
      if (dest.name === 'wp' && draft.tables.some((name) => !joinsWp(name))) continue;
      counts.set(dest, (counts.get(dest) ?? 0) + 1);
    }
    let best: Draft | null = null;
    let bestCount = 0;
    let tied = false;
    for (const [dest, count] of counts) {
      if (count > bestCount) {
        best = dest;
        bestCount = count;
        tied = false;
      } else if (count === bestCount) tied = true;
    }
    return best && !tied ? best : null;
  };

  let guard = 0;
  while (drafts.some((draft) => draft.name !== OTHER_NAME && draft.tables.length < MIN_MODULE) && guard++ < 500) {
    const small = drafts
      .filter((draft) => draft.name !== OTHER_NAME && draft.tables.length < MIN_MODULE)
      .sort((a, b) => a.tables.length - b.tables.length || a.name.localeCompare(b.name))[0];
    const dest = fkTarget(small);
    if (dest) absorb(dest, small);
    else absorb(other(), small);
  }

  const sink = drafts.find((draft) => draft.name === OTHER_NAME);
  if (sink) {
    const stay: string[] = [];
    for (const name of sink.tables) {
      if (!loose.has(name)) {
        stay.push(name);
        continue;
      }
      const dest = prefixTarget(name);
      if (dest) dest.tables = [...dest.tables, name].sort(byOrder);
    }
    sink.tables = stay;
    if (!sink.tables.length) drafts.splice(drafts.indexOf(sink), 1);
  }

  guard = 0;
  while (drafts.length > MODULE_CAP && guard++ < 40) {
    const small = drafts
      .filter((draft) => draft.name !== 'wp' && draft.name !== OTHER_NAME)
      .sort((a, b) => a.tables.length - b.tables.length || a.name.localeCompare(b.name))[0];
    if (!small) break;
    absorb(other(), small);
  }

  return relink(
    drafts.filter((draft) => draft.tables.length >= MIN_MODULE),
    edges,
    order,
    loose,
  );
}

const FOLD_FROM = 80;
const MIN_MODULE = 3;
const MODULE_CAP = 16;
const OTHER_NAME = '';

interface Draft {
  name: string;
  prefixes: string[];
  tables: string[];
}

/** How many leading words of the two names are the same. `da` alone is one, and does not count. */
function sharedStem(a: string, b: string): number {
  if (!a || !b) return 0;
  const left = a.split('_');
  const right = b.split('_');
  let n = 0;
  while (n < left.length && n < right.length && left[n] === right[n]) n++;
  return n;
}

/** The lines between the folded modules, and which of their tables have no relationship. */
function relink(
  drafts: readonly Draft[],
  edges: readonly Edge[],
  order: ReadonlyMap<string, number>,
  loose: ReadonlySet<string>,
): SchemaModule[] {
  const moduleOf = new Map<string, string>();
  for (const draft of drafts) for (const table of draft.tables) moduleOf.set(table, draft.name);
  const linkCount = new Map<string, number>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const a = moduleOf.get(edge.from);
    const b = moduleOf.get(edge.to);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
    linkCount.set(key, (linkCount.get(key) ?? 0) + 1);
  }
  const modules: SchemaModule[] = drafts.map((draft) => {
    const links: ModuleLink[] = [];
    for (const [key, relationships] of linkCount) {
      const [left, right] = key.split('\0');
      const other = left === draft.name ? right : right === draft.name ? left : null;
      if (other) links.push({ module: other, relationships });
    }
    links.sort((a, b) => b.relationships - a.relationships || a.module.localeCompare(b.module));
    const tables = [...draft.tables].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    return {
      name: draft.name,
      prefixes: draft.prefixes.length ? draft.prefixes : draft.name ? [draft.name] : [],
      tables,
      notLinked: tables.filter((name) => loose.has(name)),
      links,
    };
  });
  modules.sort((a, b) => (order.get(a.tables[0]) ?? 0) - (order.get(b.tables[0]) ?? 0));
  return modules;
}

/**
 * The module as a group, so it is saved the way groups are saved now. `color` is the group's colour;
 * the tables are the module's, in its order.
 */
export function moduleGroup(module: SchemaModule, color: GroupColor): TableGroup {
  return { name: module.name, color, tables: [...module.tables] };
}

interface Reach {
  incoming: number | null;
  outgoing: number | null;
}

/**
 * The tables within `depth` steps of `name`. Incoming and outgoing are walked apart: a step out of
 * the table follows the foreign keys it holds, and a step in follows the foreign keys that point at
 * it, and a walk does not change direction. For each table, `hidden` is how many of its neighbours
 * either way are still outside this set. Empty when the schema has no table of that name. The
 * table itself is first; the others follow in the order of the schema.
 */
export function neighbourhood(tables: readonly Table[], name: string, depth: number): Neighbour[] {
  if (!tables.some((t) => t.name === name)) return [];
  const steps = Math.max(0, depth);
  const edges = edgesOf(tables);
  const out = new Map<string, string[]>();
  const into = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, from: string, to: string) => {
    if (from === to) return;
    const list = map.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    map.set(from, list);
  };
  for (const edge of edges) {
    add(out, edge.from, edge.to);
    add(into, edge.to, edge.from);
  }

  const reached = new Map<string, Reach>([[name, { incoming: 0, outgoing: 0 }]]);
  const walk = (start: readonly string[], next: Map<string, string[]>, way: 'incoming' | 'outgoing') => {
    let layer = [...start];
    for (let distance = 1; distance <= steps && layer.length; distance++) {
      const further: string[] = [];
      for (const table of layer) {
        for (const other of next.get(table) ?? []) {
          const have = reached.get(other);
          if (have && have[way] !== null && have[way]! <= distance) continue;
          if (!have) reached.set(other, { incoming: null, outgoing: null });
          const row = reached.get(other)!;
          if (row[way] === null || distance < row[way]!) {
            row[way] = distance;
            further.push(other);
          }
        }
      }
      layer = further;
    }
  };
  walk([name], into, 'incoming');
  walk([name], out, 'outgoing');

  const neighboursOf = (table: string) => new Set([...(out.get(table) ?? []), ...(into.get(table) ?? [])]);
  const order = new Map(tables.map((t, i) => [t.name, i]));
  return [...reached.entries()]
    .sort((a, b) => (a[0] === name ? -1 : b[0] === name ? 1 : (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0)))
    .map(([table, reach]) => ({
      table,
      incoming: reach.incoming,
      outgoing: reach.outgoing,
      hidden: [...neighboursOf(table)].filter((other) => !reached.has(other)).length,
    }));
}

interface Adj {
  other: string;
  hop: PathHop;
}

/** Where one side of the search reached a table, and by which step. */
interface Mark {
  hop: PathHop | null;
  depth: number;
}

/**
 * The shortest way from `a` to `b` along foreign keys, searched from both ends at once. A foreign
 * key is walked in either direction, and each step says which, with the column that joins the two
 * tables. Where several keys join the same pair, the step takes the first of them in column order.
 * Where several ways are equally short, the one that leaves each table towards the earlier table of
 * the schema is kept. Null when either table is missing or no foreign keys connect them. The way
 * from a table to itself has no steps.
 */
export function shortestPath(tables: readonly Table[], a: string, b: string): SchemaPath | null {
  if (!tables.some((t) => t.name === a) || !tables.some((t) => t.name === b)) return null;
  if (a === b) return { tables: [a], hops: [] };

  const order = new Map(tables.map((t, i) => [t.name, i]));
  const columnAt = new Map<string, number>();
  for (const table of tables) table.columns.forEach((column, index) => columnAt.set(`${table.name}.${column.name}`, index));
  const adj = new Map<string, Adj[]>();
  const link = (from: string, hop: PathHop) => {
    const list = adj.get(from) ?? [];
    if (!list.some((item) => item.other === hop.to)) list.push({ other: hop.to, hop });
    adj.set(from, list);
  };
  const ranked: Relation[] = [];
  for (const table of tables) ranked.push(...outgoingRelations(table).filter((r) => r.from.table !== r.to.table));
  ranked.sort((x, y) => (columnAt.get(`${x.from.table}.${x.from.column}`) ?? 0) - (columnAt.get(`${y.from.table}.${y.from.column}`) ?? 0));
  for (const relation of ranked) {
    link(relation.from.table, {
      from: relation.from.table,
      to: relation.to.table,
      column: relation.from.column,
      referenced: relation.to.column,
      direction: 'out',
    });
    link(relation.to.table, {
      from: relation.to.table,
      to: relation.from.table,
      column: relation.from.column,
      referenced: relation.to.column,
      direction: 'in',
    });
  }
  for (const list of adj.values()) list.sort((x, y) => (order.get(x.other) ?? 0) - (order.get(y.other) ?? 0));

  // Each side remembers the hop and the steps that reached a table, so the two halves join when they meet.
  const fromA = new Map<string, Mark>([[a, { hop: null, depth: 0 }]]);
  const fromB = new Map<string, Mark>([[b, { hop: null, depth: 0 }]]);
  const layerA = [a];
  const layerB = [b];

  const meet = (side: Map<string, Mark>, other: Map<string, Mark>, layer: string[]): string | null => {
    const next: string[] = [];
    const found: string[] = [];
    const depth = (side.get(layer[0])?.depth ?? 0) + 1;
    for (const table of [...layer].sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0))) {
      for (const { other: neighbour, hop } of adj.get(table) ?? []) {
        if (side.has(neighbour)) continue;
        side.set(neighbour, { hop, depth });
        next.push(neighbour);
        if (other.has(neighbour)) found.push(neighbour);
      }
    }
    layer.splice(0, layer.length, ...next);
    // Every table reached on this layer is the same number of steps from its end. The closest one
    // on the other side is a shortest way; an earlier table of the schema breaks a tie.
    return found.sort((x, y) => (other.get(x)!.depth - other.get(y)!.depth) || (order.get(x) ?? 0) - (order.get(y) ?? 0))[0] ?? null;
  };

  let touch: string | null = null;
  while (layerA.length && layerB.length && touch === null) {
    // The smaller side grows first, one step, and a meeting on that step is a shortest way.
    if (layerA.length <= layerB.length) touch = meet(fromA, fromB, layerA);
    else touch = meet(fromB, fromA, layerB);
  }
  if (touch === null) return null;

  const half = (side: Map<string, Mark>, start: string): PathHop[] => {
    const hops: PathHop[] = [];
    let at: string | null = start;
    while (at !== null) {
      const step: PathHop | null | undefined = side.get(at)?.hop;
      if (!step) break;
      hops.push(step);
      at = step.from;
    }
    return hops;
  };
  // `fromA` walks forward from the start; reverse it. `fromB` walks forward from the end.
  const hops = [...half(fromA, touch).reverse(), ...half(fromB, touch).map((hop) => flip(hop))];
  const path = [a];
  for (const hop of hops) path.push(hop.to);
  return { tables: path, hops };
}

/** The same join, walked the other way. */
function flip(hop: PathHop): PathHop {
  return { from: hop.to, to: hop.from, column: hop.column, referenced: hop.referenced, direction: hop.direction === 'out' ? 'in' : 'out' };
}
