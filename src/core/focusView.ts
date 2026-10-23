import type { Column, Table } from './model';
import { findHubs, neighbourhood, shortestPath, type Neighbour, type SchemaModule, type SchemaPath } from './modules';
import { incomingRelations, outgoingRelations } from './relations';

// The Focus view of a large diagram. The table that is focused sits in the middle. Tables that
// reference it stand in columns on the left, one column per step, and tables it references stand
// on the right. A neighbour that still has relationships outside this set wears a +N badge; opening
// it draws those tables one step further out. A hub is a tag on the column instead of a card,
// until it is asked for.

/** How many steps the view can open. */
export const FOCUS_DEPTHS = [1, 2, 3] as const;
export type FocusDepth = (typeof FOCUS_DEPTHS)[number];

/** A card of a neighbour, and the wider card of the table in the middle. */
export const FOCUS_NODE_WIDTH = 196;
export const FOCUS_CENTER_WIDTH = 220;
/** Room between two columns for the curve of a line. */
export const FOCUS_GAP_X = 72;
export const FOCUS_GAP_Y = 16;
export const FOCUS_ORIGIN_X = 20;
/** The lane names sit above the cards, under the bar. */
export const FOCUS_LABEL_Y = 52;
export const FOCUS_TOP = 78;
export const FOCUS_HEAD = 30;
export const FOCUS_ROW = 22;
const FOCUS_BORDER = 2;
/** Room under the last card for the bar at the bottom. */
const FOCUS_PAD_BOTTOM = 88;

/** How many column rows a card shows before the rest are "+N columns". */
const CENTER_CAP = 9;
const SIDE_CAP = 3;

/** The name and tables of a Focus view. The saved record in the database also keeps its own positions. */
export interface SavedView {
  id: string;
  name: string;
  tables: string[];
}

export interface FocusOptions {
  depth: number;
  /** Neighbours whose hidden relationships are drawn one step further out. */
  expanded: ReadonlySet<string>;
  /** Tables asked for with "+ Show", a hub included. */
  revealed: ReadonlySet<string>;
  /** A hub is a tag on the column. Off, and the hub is a card. */
  hubsAsTags: boolean;
  /** A card shows its key columns only. */
  keysOnly: boolean;
}

export interface FocusColumn {
  name: string;
  type: string;
  kind: 'pk' | 'fk' | 'plain';
  /** The line to the other card leaves or arrives on this row. */
  join: boolean;
  /** Set when the foreign key is drawn as a tag instead of a line. */
  hub?: string;
}

export interface FocusNode {
  table: string;
  /**
   * 0 is the table in the middle. A negative lane is "Referenced by", that many steps out;
   * a positive lane is "References".
   */
  lane: number;
  /** The module it belongs to. Empty when it belongs to none. */
  module: string;
  columns: FocusColumn[];
  /** Columns past `columns`. */
  more: number;
  /** Every column, the count in the head. */
  total: number;
  /** Neighbours still not drawn. The +N badge; 0 hides it. */
  hidden: number;
}

export interface FocusEdge {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
}

export interface FocusGraph {
  center: string;
  nodes: FocusNode[];
  edges: FocusEdge[];
}

export interface FocusRelation {
  /** Stable for a list. */
  key: string;
  column: string;
  other: string;
  /** `out` is a foreign key of the centre; `in` points at the centre. */
  direction: 'out' | 'in';
  hub: boolean;
}

export interface PlacedFocusNode extends FocusNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 1, 2 or 3. Anything else is the nearest of those. */
export function focusDepth(depth: number): FocusDepth {
  if (depth >= 3) return 3;
  if (depth <= 1) return 1;
  return 2;
}

/** The module a saved view is named after, or the table when it belongs to none. */
export function focusViewName(modules: readonly SchemaModule[], center: string): string {
  return modules.find((module) => module.name && module.tables.includes(center))?.name || center;
}

/**
 * Keeps a view of the same name, tables replaced and the id it already had. A new name is added
 * at the end.
 */
export function upsertSavedView(views: readonly SavedView[], view: SavedView): SavedView[] {
  const index = views.findIndex((item) => item.name === view.name);
  if (index < 0) return [...views, view];
  const next = views.slice();
  next[index] = { ...views[index], tables: view.tables };
  return next;
}

/** The table whose name is `query`, ignoring case and accents. Null when it is not exact. */
export function matchTableName(tables: readonly Table[], query: string): string | null {
  const needle = fold(query.trim());
  if (!needle) return null;
  return tables.find((table) => fold(table.name) === needle)?.name ?? null;
}

/** Tables whose names hold `query`, in the order of the schema, at most `limit`. */
export function suggestTables(tables: readonly Table[], query: string, limit = 8): string[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const names: string[] = [];
  for (const table of tables) {
    if (!fold(table.name).includes(needle)) continue;
    names.push(table.name);
    if (names.length >= limit) break;
  }
  return names;
}

/** Refs out, refs in, and how many other tables are within two steps. */
export function focusStats(tables: readonly Table[], name: string): { refsOut: number; refsIn: number; twoHop: number } {
  const table = tables.find((item) => item.name === name);
  if (!table) return { refsOut: 0, refsIn: 0, twoHop: 0 };
  const refsOut = outgoingRelations(table).filter((relation) => relation.to.table !== name).length;
  const refsIn = incomingRelations(table, tables).filter((relation) => relation.from.table !== name).length;
  return { refsOut, refsIn, twoHop: Math.max(0, neighbourhood(tables, name, 2).length - 1) };
}

/** The relationships of `name`: its foreign keys first, then the ones that point at it. */
export function focusRelations(tables: readonly Table[], name: string): FocusRelation[] {
  const table = tables.find((item) => item.name === name);
  if (!table) return [];
  const hubs = new Set(findHubs(tables).map((hub) => hub.table));
  const rows: FocusRelation[] = [];
  for (const relation of outgoingRelations(table)) {
    if (relation.to.table === name) continue;
    rows.push({
      key: `out:${relation.from.column}`,
      column: relation.from.column,
      other: relation.to.table,
      direction: 'out',
      hub: hubs.has(relation.to.table),
    });
  }
  for (const relation of incomingRelations(table, tables)) {
    if (relation.from.table === name) continue;
    rows.push({
      key: `in:${relation.from.table}.${relation.from.column}`,
      column: relation.from.column,
      other: relation.from.table,
      direction: 'in',
      hub: false,
    });
  }
  return rows;
}

/** The columns a path walks, each once, in the order of the steps. */
export function pathVia(path: SchemaPath): string {
  return [...new Set(path.hops.map((hop) => hop.column))].join(', ');
}

/**
 * The cards and the lines of Focus. Null when the schema has no table of that name. Incoming
 * steps stand on the left and outgoing steps on the right. A hub stays out of the cards while
 * tags are on, unless it was asked for; opening a badge draws the neighbours that badge counts.
 */
export function focusGraph(
  tables: readonly Table[],
  center: string,
  modules: readonly SchemaModule[],
  options: FocusOptions,
): FocusGraph | null {
  if (!tables.some((table) => table.name === center)) return null;
  const depth = focusDepth(options.depth);
  const names = new Set(tables.map((table) => table.name));
  const hubs = new Set(findHubs(tables).map((hub) => hub.table));
  const moduleOf = new Map<string, string>();
  for (const module of modules) for (const name of module.tables) moduleOf.set(name, module.name);
  const order = new Map(tables.map((table, index) => [table.name, index]));
  const neighbours = neighbourMap(tables, names);

  const steps = options.revealed.size > 0 ? 32 : options.expanded.size > 0 ? depth + 1 : depth;
  const far = neighbourhood(tables, center, steps);
  const lane = new Map<string, number>();
  const accounted = new Set<string>();
  const tagged = (name: string) => options.hubsAsTags && hubs.has(name) && name !== center && !options.revealed.has(name);

  for (const item of far) {
    const side = sideOf(item, center);
    if (side === null) continue;
    const dist = Math.abs(side);
    if (dist > depth && !options.revealed.has(item.table)) continue;
    if (tagged(item.table) && dist <= depth) accounted.add(item.table);
    else lane.set(item.table, side);
  }
  lane.set(center, 0);

  for (const name of options.expanded) {
    const base = lane.get(name);
    if (base === undefined || base === 0) continue;
    const dir = base < 0 ? -1 : 1;
    for (const other of neighbours.get(name) ?? []) {
      if (lane.has(other) || accounted.has(other)) continue;
      lane.set(other, base + dir);
    }
  }
  for (const name of lane.keys()) accounted.add(name);

  const edges: FocusEdge[] = [];
  for (const table of tables) {
    if (!lane.has(table.name)) continue;
    for (const relation of outgoingRelations(table)) {
      if (relation.from.table === relation.to.table || !lane.has(relation.to.table)) continue;
      edges.push({
        from: relation.from.table,
        to: relation.to.table,
        fromColumn: relation.from.column,
        toColumn: relation.to.column,
      });
    }
  }

  const joins = new Map<string, Set<string>>();
  const mark = (table: string, column: string) => {
    const set = joins.get(table) ?? new Set<string>();
    set.add(column);
    joins.set(table, set);
  };
  for (const edge of edges) {
    mark(edge.from, edge.fromColumn);
    mark(edge.to, edge.toColumn);
  }

  const hiddenOf = (name: string) => {
    let count = 0;
    for (const other of neighbours.get(name) ?? []) if (!accounted.has(other)) count += 1;
    return count;
  };

  const nodes: FocusNode[] = [...lane.entries()]
    .sort((a, b) => a[1] - b[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([table, at]) => {
      const source = tables.find((item) => item.name === table)!;
      const preview = previewColumns(source, at === 0 ? 'center' : 'side', joins.get(table) ?? new Set(), (column) => {
        const target = column.fk?.table;
        return target && options.hubsAsTags && hubs.has(target) && !lane.has(target) ? target : undefined;
      }, options.keysOnly);
      return {
        table,
        lane: at,
        module: moduleOf.get(table) ?? '',
        columns: preview.columns,
        more: preview.more,
        total: source.columns.length,
        hidden: hiddenOf(table),
      };
    });

  return { center, nodes, edges };
}

/** The height of a card, border included. */
export function focusNodeHeight(columns: number, more: number): number {
  return FOCUS_BORDER + FOCUS_HEAD + Math.max(0, columns) * FOCUS_ROW + (more > 0 ? FOCUS_ROW : 0);
}

/** Cards in columns. A column is as tall as its cards, and the columns share one midline. */
export function placeFocus(nodes: readonly FocusNode[]): { nodes: PlacedFocusNode[]; width: number; height: number } {
  const lanes = new Map<number, FocusNode[]>();
  for (const node of nodes) {
    const list = lanes.get(node.lane) ?? [];
    list.push(node);
    lanes.set(node.lane, list);
  }
  const ids = [...lanes.keys()].sort((a, b) => a - b);
  const heights = new Map<number, number>();
  for (const id of ids) {
    const list = lanes.get(id)!;
    const stack = list.reduce((sum, node) => sum + focusNodeHeight(node.columns.length, node.more), 0);
    heights.set(id, stack + FOCUS_GAP_Y * Math.max(0, list.length - 1));
  }
  const maxH = Math.max(0, ...heights.values());
  const xOf = new Map<number, number>();
  let x = FOCUS_ORIGIN_X;
  for (const id of ids) {
    xOf.set(id, x);
    x += (id === 0 ? FOCUS_CENTER_WIDTH : FOCUS_NODE_WIDTH) + FOCUS_GAP_X;
  }
  const placed: PlacedFocusNode[] = [];
  for (const id of ids) {
    const width = id === 0 ? FOCUS_CENTER_WIDTH : FOCUS_NODE_WIDTH;
    let y = FOCUS_TOP + (maxH - (heights.get(id) ?? 0)) / 2;
    for (const node of lanes.get(id)!) {
      const height = focusNodeHeight(node.columns.length, node.more);
      placed.push({ ...node, x: xOf.get(id)!, y, width, height });
      y += height + FOCUS_GAP_Y;
    }
  }
  const width = Math.max(FOCUS_ORIGIN_X * 2 + FOCUS_CENTER_WIDTH, x - FOCUS_GAP_X + FOCUS_ORIGIN_X);
  return { nodes: placed, width, height: FOCUS_TOP + maxH + FOCUS_PAD_BOTTOM };
}

/** Where a column row sits, or the middle of the head when the column is not shown. */
export function focusColumnY(node: PlacedFocusNode, column: string): number {
  const index = node.columns.findIndex((item) => item.name === column);
  const top = node.y + FOCUS_BORDER / 2;
  if (index < 0) return top + FOCUS_HEAD / 2;
  return top + FOCUS_HEAD + index * FOCUS_ROW + FOCUS_ROW / 2;
}

/** A dashed curve from the foreign-key row to the column it references. */
export function focusLines(nodes: readonly PlacedFocusNode[], edges: readonly FocusEdge[]): { key: string; d: string }[] {
  const at = new Map(nodes.map((node) => [node.table, node]));
  const lines: { key: string; d: string }[] = [];
  for (const edge of edges) {
    const from = at.get(edge.from);
    const to = at.get(edge.to);
    if (!from || !to) continue;
    const y1 = focusColumnY(from, edge.fromColumn);
    const y2 = focusColumnY(to, edge.toColumn);
    const fromLeft = from.x + from.width / 2 <= to.x + to.width / 2;
    const x1 = fromLeft ? from.x + from.width : from.x;
    const x2 = fromLeft ? to.x : to.x + to.width;
    const bend = Math.max(48, Math.abs(x2 - x1) / 2);
    const c1 = x1 < x2 ? x1 + bend : x1 - bend;
    const c2 = x1 < x2 ? x2 - bend : x2 + bend;
    lines.push({
      key: `${edge.from}.${edge.fromColumn}->${edge.to}.${edge.toColumn}`,
      d: `M${x1} ${y1} C${c1} ${y1} ${c2} ${y2} ${x2} ${y2}`,
    });
  }
  return lines;
}

/** The shortest way, or null when the name is not a table or nothing joins the two. */
export function focusPath(tables: readonly Table[], from: string, to: string): SchemaPath | null {
  return shortestPath(tables, from, to);
}

function sideOf(item: Neighbour, center: string): number | null {
  if (item.table === center) return 0;
  const incoming = item.incoming;
  const outgoing = item.outgoing;
  if (incoming !== null && incoming > 0 && (outgoing === null || incoming <= outgoing)) return -incoming;
  if (outgoing !== null && outgoing > 0) return outgoing;
  return null;
}

/** Other tables one foreign key away, itself excluded. */
function neighbourMap(tables: readonly Table[], names: ReadonlySet<string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    if (from === to || !names.has(to)) return;
    const list = map.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    map.set(from, list);
  };
  for (const table of tables) {
    for (const relation of outgoingRelations(table)) {
      add(relation.from.table, relation.to.table);
      add(relation.to.table, relation.from.table);
    }
  }
  return map;
}

function previewColumns(
  table: Table,
  role: 'center' | 'side',
  joins: ReadonlySet<string>,
  hubOf: (column: Column) => string | undefined,
  keysOnly: boolean,
): { columns: FocusColumn[]; more: number } {
  const rows: FocusColumn[] = [];
  const seen = new Set<string>();
  const add = (column: Column) => {
    if (seen.has(column.name)) return;
    seen.add(column.name);
    const hub = hubOf(column);
    rows.push({
      name: column.name,
      type: column.type,
      kind: column.pk ? 'pk' : column.fk ? 'fk' : 'plain',
      join: joins.has(column.name),
      ...(hub ? { hub } : {}),
    });
  };
  for (const column of table.columns) if (column.pk) add(column);
  if (role === 'center') {
    for (const column of table.columns) if (column.fk) add(column);
  } else {
    for (const column of table.columns) if (column.fk && joins.has(column.name)) add(column);
  }
  const cap = role === 'center' ? CENTER_CAP : SIDE_CAP;
  if (!keysOnly) {
    for (const column of table.columns) {
      if (rows.length >= cap) break;
      if (!column.pk && !column.fk) add(column);
    }
  }
  const columns = rows.slice(0, cap);
  return { columns, more: Math.max(0, table.columns.length - columns.length) };
}

/** Lower case without accents, as the Explorer's filter folds a name. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}
