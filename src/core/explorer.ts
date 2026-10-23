import { GROUP_COLORS, suggestGroups } from './groups';
import { nodeHeight, nodeRects, nodeWidth, NODE_WIDTH, rowCenter, rowOf } from './layout';
import type { GroupColor, Placement, Positions, Table, TableGroup } from './model';
import { positionOf } from './positions';
import { findHubs, suggestModules, unlinkedTables, type SchemaModule } from './modules';

// What the Explorer shows of a large schema, and what the canvas draws for it. The tables on the
// canvas are of the diagram, like the positions: a version keeps them and an edit undoes them, and
// DDL, migrations and the diff leave them out.

/** A schema with at most this many tables shows every table, as it did before the Explorer. */
export const SHOW_ALL_BELOW = 80;

/** How many tables a module lists before the rest are behind "Show all". */
export const MODULE_PREVIEW = 12;

/** How wide the Explorer is before it is dragged, and how narrow and wide it can be. */
export const EXPLORER_WIDTH = 300;
export const EXPLORER_MIN = 200;
export const EXPLORER_MAX = 440;

export const EXPLORER_WIDTH_KEY = 'schema-studio.explorer-width';

/** Where the filter looks: table names, column names, or both. */
export type ExplorerScope = 'all' | 'tables' | 'columns';

/** The linked tables that belong to no module. */
export const OTHER_MODULE = '';

/** The group key of a table with no relationship, in a search. */
export const UNLINKED_MODULE = '\0unlinked';

/** Lower case without accents, as `searchRows` folds text, so that "nguyen" finds "Nguyễn". */
export function foldQuery(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

/** Where `query` sits in `text` once both are folded. Null when it does not. */
export function markRange(text: string, query: string): { start: number; end: number } | null {
  const needle = foldQuery(query.trim());
  if (!needle) return null;
  const folded = foldMap(text);
  const at = folded.text.indexOf(needle);
  if (at < 0) return null;
  return { start: folded.index[at], end: folded.index[at + needle.length - 1] + 1 };
}

/** The folded text and, for each of its characters, the character of `text` it came from. */
function foldMap(text: string): { text: string; index: number[] } {
  let folded = '';
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const piece = text[i].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
    for (const ch of piece) {
      folded += ch;
      index.push(i);
    }
  }
  return { text: folded, index };
}

export interface ExplorerColumn {
  name: string;
  folded: string;
  index: number;
  /** The table and column a foreign key references. */
  references?: { table: string; column: string };
}

export interface ExplorerTable {
  name: string;
  folded: string;
  module: string;
  /** Other tables with a foreign key to this one. */
  referencedBy: number;
  columns: ExplorerColumn[];
}

/** Tables folded once, so a keystroke only compares strings. */
export interface ExplorerIndex {
  tables: ExplorerTable[];
}

export interface ColumnMatch {
  name: string;
  index: number;
  references?: { table: string; column: string };
}

export interface TableMatch {
  table: string;
  module: string;
  nameMatch: boolean;
  referencedBy: number;
  columns: ColumnMatch[];
}

export interface ModuleMatch {
  module: string;
  tables: TableMatch[];
}

export interface ExplorerSearch {
  groups: ModuleMatch[];
  /** Table-name matches and column matches, each one. */
  matches: number;
  /** The table whose name holds the query, the shortest when several do. Null when none does. */
  named: string | null;
}

/**
 * The width the Explorer gets when `width` is wanted: whole px, between its limits. `room` is what
 * the window leaves for it, which it does not exceed, as long as it stays as wide as it must be.
 */
export function clampExplorerWidth(width: number, room: number = Infinity): number {
  if (!Number.isFinite(width)) return EXPLORER_WIDTH;
  return Math.round(Math.max(EXPLORER_MIN, Math.min(width, EXPLORER_MAX, Math.max(room, EXPLORER_MIN))));
}

/** What was stored for the Explorer's width. Anything else is the width it has by itself. */
export function parseExplorerWidth(value: string | null | undefined): number {
  const width = Number(value);
  return value && Number.isFinite(width) ? clampExplorerWidth(width) : EXPLORER_WIDTH;
}

/**
 * Modules for the tree. Tables with no relationship are left out of every module: they are the
 * Not linked group. Linked tables that fell into no module are one group of their own, named
 * `OTHER_MODULE`.
 */
export function explorerModules(tables: readonly Table[], modules: readonly SchemaModule[] = suggestModules(tables)): {
  modules: { name: string; tables: string[] }[];
  unlinked: string[];
} {
  const loose = new Set(unlinkedTables(tables));
  const placed = new Set<string>();
  const list = modules
    .map((module) => {
      const members = module.tables.filter((name) => !loose.has(name));
      for (const name of members) placed.add(name);
      return { name: module.name, tables: members };
    })
    .filter((module) => module.tables.length > 0);
  const rest = tables.map((t) => t.name).filter((name) => !loose.has(name) && !placed.has(name));
  if (rest.length) list.push({ name: OTHER_MODULE, tables: rest });
  return { modules: list, unlinked: tables.map((t) => t.name).filter((name) => loose.has(name)) };
}

/** The colour of a module: the group of the same name when there is one, otherwise the next group colour. */
export function moduleColor(name: string, index: number, groups: readonly TableGroup[]): GroupColor {
  const saved = name ? groups.find((g) => g.name === name)?.color : undefined;
  if (saved) return saved;
  const at = ((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length;
  return GROUP_COLORS[at];
}

/**
 * The tables on the canvas when `shown` was never set: every table of a schema of at most
 * `SHOW_ALL_BELOW`, and otherwise the largest module, without the tables that have no relationship.
 * Null means every table.
 */
export function implicitShown(tables: readonly Table[], modules: readonly SchemaModule[]): string[] | null {
  if (tables.length <= SHOW_ALL_BELOW) return null;
  const loose = new Set(unlinkedTables(tables));
  let best: readonly string[] = [];
  for (const module of modules) {
    const members = module.tables.filter((name) => !loose.has(name));
    if (members.length > best.length) best = members;
  }
  return best.length ? [...best] : null;
}

/** The tables on the canvas: `shown` when it was set, and the default otherwise. In the order of the schema. */
export function visibleNames(tables: readonly Table[], modules: readonly SchemaModule[], shown: readonly string[] | undefined): string[] {
  const want = shown ? new Set(shown) : null;
  if (want) return tables.map((t) => t.name).filter((name) => want.has(name));
  const implicit = implicitShown(tables, modules);
  if (!implicit) return tables.map((t) => t.name);
  const keep = new Set(implicit);
  return tables.map((t) => t.name).filter((name) => keep.has(name));
}

/** How many of `members` are on the canvas, and how many the module has. */
export function shownCount(members: readonly string[], shown: ReadonlySet<string>): { shown: number; total: number } {
  let count = 0;
  for (const name of members) if (shown.has(name)) count++;
  return { shown: count, total: members.length };
}

/** `names` in the order of the schema, dropping any that are not a table of it. */
export function shownList(tables: readonly Table[], names: readonly string[]): string[] {
  const want = new Set(names);
  return tables.map((t) => t.name).filter((name) => want.has(name));
}

export function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/**
 * What to store for a visibility edit. Undefined keeps the default, so a schema that shows every
 * table, or only its largest module, is not a change until the set is a different one.
 */
export function nextShown(
  tables: readonly Table[],
  modules: readonly SchemaModule[],
  current: readonly string[] | undefined,
  names: readonly string[],
): readonly string[] | undefined | null {
  const next = shownList(tables, names);
  const implicit = implicitShown(tables, modules);
  const cleared = implicit ? sameNames(next, implicit) : next.length === tables.length;
  if (cleared) return current ? undefined : null;
  if (current && sameNames(current, next)) return null;
  if (!current && sameNames(next, visibleNames(tables, modules, undefined))) return null;
  return next;
}

/** The index the filter searches. Built once for a schema, not on each keystroke. */
export function indexExplorer(tables: readonly Table[], modules: readonly SchemaModule[] = suggestModules(tables)): ExplorerIndex {
  const { modules: list, unlinked } = explorerModules(tables, modules);
  const moduleOf = new Map<string, string>();
  for (const module of list) for (const name of module.tables) moduleOf.set(name, module.name);
  for (const name of unlinked) moduleOf.set(name, UNLINKED_MODULE);
  const incoming = new Map<string, number>();
  for (const table of tables) {
    for (const column of table.columns) {
      const to = column.fk?.table;
      if (!to || to === table.name) continue;
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }
  }
  return {
    tables: tables.map((table) => ({
      name: table.name,
      folded: foldQuery(table.name),
      module: moduleOf.get(table.name) ?? OTHER_MODULE,
      referencedBy: incoming.get(table.name) ?? 0,
      columns: table.columns.map((column, index) => ({
        name: column.name,
        folded: foldQuery(column.name),
        index,
        ...(column.fk ? { references: { table: column.fk.table, column: column.fk.column } } : {}),
      })),
    })),
  };
}

/** The modules, then the tables, whose names or columns hold `query`. The first groups are the ones to open. */
export function searchExplorer(index: ExplorerIndex, query: string, scope: ExplorerScope = 'all'): ExplorerSearch {
  const needle = foldQuery(query.trim());
  const groups: ModuleMatch[] = [];
  const byModule = new Map<string, TableMatch[]>();
  let matches = 0;
  let named: { name: string; length: number } | null = null;
  if (!needle) return { groups, matches, named: null };

  const names = scope !== 'columns';
  const columns = scope !== 'tables';
  for (const table of index.tables) {
    const nameMatch = names && table.folded.includes(needle);
    const found: ColumnMatch[] = columns
      ? table.columns
          .filter((column) => column.folded.includes(needle))
          .map((column) => ({
            name: column.name,
            index: column.index,
            ...(column.references ? { references: column.references } : {}),
          }))
      : [];
    if (!nameMatch && !found.length) continue;
    if (nameMatch) {
      matches++;
      if (!named || table.name.length < named.length) named = { name: table.name, length: table.name.length };
    }
    matches += found.length;
    const row: TableMatch = {
      table: table.name,
      module: table.module,
      nameMatch,
      referencedBy: table.referencedBy,
      columns: found,
    };
    const list = byModule.get(table.module) ?? [];
    list.push(row);
    byModule.set(table.module, list);
  }
  for (const [module, tables] of byModule) groups.push({ module, tables });
  return { groups, matches, named: named?.name ?? null };
}

/** How many of the matched tables are already on the canvas. */
export function matchesOnCanvas(search: ExplorerSearch, shown: ReadonlySet<string>): number {
  let count = 0;
  for (const group of search.groups) for (const table of group.tables) if (shown.has(table.table)) count++;
  return count;
}

/** The names of the matched tables, in the order of the groups. */
export function matchedTables(search: ExplorerSearch): string[] {
  return search.groups.flatMap((group) => group.tables.map((table) => table.table));
}

export interface CanvasStub {
  table: string;
  module: string;
}

/**
 * One stub for each table that is not on the canvas and that a shown table references, hubs
 * excluded. A table referenced twice is still one stub. In the order of the schema.
 */
export function canvasStubs(
  tables: readonly Table[],
  modules: readonly SchemaModule[],
  shown: ReadonlySet<string>,
  hubs: ReadonlySet<string> = new Set(findHubs(tables).map((hub) => hub.table)),
): CanvasStub[] {
  const moduleOf = new Map<string, string>();
  for (const module of modules) for (const name of module.tables) moduleOf.set(name, module.name);
  const known = new Set(tables.map((t) => t.name));
  const found = new Set<string>();
  for (const table of tables) {
    if (!shown.has(table.name)) continue;
    for (const column of table.columns) {
      const to = column.fk?.table;
      if (!to || to === table.name || shown.has(to) || hubs.has(to) || !known.has(to)) continue;
      found.add(to);
    }
  }
  return tables.filter((t) => found.has(t.name)).map((t) => ({ table: t.name, module: moduleOf.get(t.name) ?? OTHER_MODULE }));
}

export interface StubLink {
  from: string;
  column: number;
  to: string;
}

/** A foreign key from a shown table to a stub, one for each column. */
export function stubLinks(tables: readonly Table[], shown: ReadonlySet<string>, stubs: ReadonlySet<string>): StubLink[] {
  const links: StubLink[] = [];
  for (const table of tables) {
    if (!shown.has(table.name)) continue;
    table.columns.forEach((column, index) => {
      const to = column.fk?.table;
      if (to && stubs.has(to)) links.push({ from: table.name, column: index, to });
    });
  }
  return links;
}

export interface PlacedStub extends CanvasStub {
  x: number;
  y: number;
}

const STUB_GAP = 16;
const STUB_HEIGHT = 32;

/** Stubs in a column just to the right of the shown tables. */
export function placeStubs(tables: readonly Table[], positions: Positions, stubs: readonly CanvasStub[]): PlacedStub[] {
  const rects = nodeRects(tables, positions);
  let right = 0;
  let top = Infinity;
  for (const rect of rects) {
    right = Math.max(right, rect.x + rect.w);
    top = Math.min(top, rect.y);
  }
  if (!Number.isFinite(top)) top = 48;
  const x = (rects.length ? right : 24) + 64;
  return stubs.map((stub, i) => ({ ...stub, x, y: top + i * (STUB_HEIGHT + STUB_GAP) }));
}

/** The point `locate` pans to: the middle of the table, or of its stub when it is not drawn. */
export function locatePoint(
  tables: readonly Table[],
  positions: Positions,
  name: string,
  stubs: readonly PlacedStub[] = [],
): { x: number; y: number } | null {
  const table = tables.find((t) => t.name === name);
  const at = table ? positionOf(positions, name) : undefined;
  if (table && at) return { x: at.x + nodeWidth(at) / 2, y: at.y + nodeHeight(table, at) / 2 };
  const stub = stubs.find((s) => s.table === name);
  return stub ? { x: stub.x + NODE_WIDTH / 2, y: stub.y + STUB_HEIGHT / 2 } : null;
}

/** Where a stub line leaves the foreign-key column: the right side of that row. */
export function stubAnchor(at: Placement, table: Table, column: number): { x: number; y: number } {
  return { x: at.x + nodeWidth(at), y: rowCenter(at, rowOf(table, at, column)) };
}

export interface PrefixBucket {
  /** The prefix, with a star when it is not itself a table. Empty for the tables that share none. */
  label: string;
  tables: string[];
}

/**
 * The unlinked tables by the prefix of their names, as `suggestGroups` gathers them, and the ones
 * it leaves over last. A prefix that is not a table of its own is marked with a star.
 */
export function prefixBuckets(names: readonly string[]): PrefixBucket[] {
  const suggestions = suggestGroups(names.map((name) => ({ name, columns: [] })));
  const taken = new Set(suggestions.flatMap((s) => s.tables));
  const buckets: PrefixBucket[] = suggestions.map((s) => ({
    label: names.includes(s.name) ? s.name : `${s.name}*`,
    tables: s.tables,
  }));
  const rest = names.filter((name) => !taken.has(name));
  if (rest.length) buckets.push({ label: '', tables: rest });
  return buckets;
}
