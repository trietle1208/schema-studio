import { explorerModules, SHOW_ALL_BELOW } from './explorer';
import type { Table, TableGroup } from './model';
import { findHubs, suggestModules, type SchemaModule } from './modules';
import { outgoingRelations } from './relations';

// The Modules view of a large diagram: one card per module, and a line between two modules as
// thick as the foreign keys that run between them. The card's height is the sum of the pieces
// drawn in `.ss-modcard` (bar, head, prefixes, the three sample rows, the "+N" row, and the
// action row of the selected card), border included, so a row of cards does not overlap the next.

/** What the diagram shows. Focus lays its lanes out in `focusView`. */
export type DiagramView = 'modules' | 'tables' | 'focus';

/** A module card is this wide, in the grid of the Modules view. */
export const MODULE_CARD_WIDTH = 196;

/** The gap between two cards, and the margin the first card keeps from the canvas. */
export const MODULE_CARD_GAP_X = 20;
export const MODULE_CARD_GAP_Y = 36;
export const MODULE_CARD_ORIGIN_X = 28;
export const MODULE_CARD_ORIGIN_Y = 84;

/** How many tables a card names before the rest are "+N tables". */
export const MODULE_SAMPLE = 3;

const CARD_BORDER = 2;
const CARD_BAR = 4;
const CARD_HEAD = 34;
const CARD_PREFIX = 16;
const CARD_LIST_CHROME = 8 + 1 + 6 + 10;
const CARD_ROW = 16;
const CARD_ROW_GAP = 3;
const CARD_ACTION = 26;

/** A schema of more than 80 tables opens on Modules. A smaller one opens on Tables. */
export function defaultDiagramView(tableCount: number): DiagramView {
  return tableCount > SHOW_ALL_BELOW ? 'modules' : 'tables';
}

/** How many columns of cards fit in a canvas of `width`. Nothing measured yet is five, as the reference does. */
export function moduleColumns(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 5;
  const pitch = MODULE_CARD_WIDTH + MODULE_CARD_GAP_X;
  const room = width - MODULE_CARD_ORIGIN_X;
  if (room < MODULE_CARD_WIDTH) return 1;
  return Math.max(1, Math.floor((room + MODULE_CARD_GAP_X) / pitch));
}

/**
 * The height of a card. `tableCount` is how many tables it stands for, so three of them and a
 * "+N" row when there are more. The selected card is taller by its action row.
 */
export function moduleCardHeight(tableCount: number, hasPrefixes: boolean, selected: boolean): number {
  const samples = Math.min(MODULE_SAMPLE, Math.max(0, tableCount));
  const rows = samples + (tableCount > MODULE_SAMPLE ? 1 : 0);
  const list = CARD_LIST_CHROME + rows * CARD_ROW + Math.max(0, rows - 1) * CARD_ROW_GAP;
  return CARD_BORDER + CARD_BAR + CARD_HEAD + (hasPrefixes ? CARD_PREFIX : 0) + list + (selected ? CARD_ACTION : 0);
}

/** `da_nhan_vien* · da_phong_ban*`, the prefixes a card writes under its name. */
export function prefixLine(prefixes: readonly string[]): string {
  return prefixes.map((prefix) => (prefix.endsWith('*') ? prefix : `${prefix}*`)).join(' · ');
}

/** Whether two lists hold the same tables, in any order. */
export function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((name) => set.has(name));
}

/** The saved group whose tables are exactly the module's, when one was renamed or coloured. */
export function savedModuleGroup(groups: readonly TableGroup[], tables: readonly string[]): TableGroup | undefined {
  return groups.find((group) => sameMembers(group.tables, tables));
}

export interface ModuleCardModel {
  /** The module's own name. Empty for the linked tables that fell into no module. */
  name: string;
  /** Its tables that have a relationship. The ones with none stay in Not linked. */
  tables: string[];
  prefixes: string[];
  /** Up to three tables that stand for it: the ones the others reference, then the order of the schema. */
  sample: string[];
  /** Tables past `sample`. */
  more: number;
}

/**
 * The three tables that stand for a module: referenced by the most other tables first, and the
 * order of `members` where two are referenced alike.
 */
export function representativeTables(tables: readonly Table[], members: readonly string[], limit = MODULE_SAMPLE): string[] {
  const set = new Set(members);
  const incoming = new Map<string, number>();
  for (const table of tables) {
    for (const relation of outgoingRelations(table)) {
      if (relation.from.table === relation.to.table || !set.has(relation.to.table)) continue;
      incoming.set(relation.to.table, (incoming.get(relation.to.table) ?? 0) + 1);
    }
  }
  return members
    .map((name, index) => ({ name, index, count: incoming.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((item) => item.name);
}

/** One card per module the Explorer lists, unlinked tables left out. */
export function moduleCards(tables: readonly Table[], modules: readonly SchemaModule[] = suggestModules(tables)): ModuleCardModel[] {
  const tree = explorerModules(tables, modules);
  return tree.modules.map((module) => {
    const source = modules.find((item) => item.name === module.name);
    const sample = representativeTables(tables, module.tables);
    return {
      name: module.name,
      tables: module.tables,
      prefixes: source?.prefixes ?? [],
      sample,
      more: Math.max(0, module.tables.length - sample.length),
    };
  });
}

export interface ModuleEdge {
  from: string;
  to: string;
  relationships: number;
}

export interface ModuleEdgeOptions {
  /** Leave out a foreign key that points at a hub. The bar opens with this on. */
  hideHubs: boolean;
  /** Count only the foreign keys that were inferred. */
  inferredOnly: boolean;
}

/**
 * One line per pair of modules, as many foreign keys as run between them. A reference to a hub is
 * left out while hub lines are hidden, and a declared foreign key is left out of Inferred only.
 * The names are in order, so the line has one direction.
 */
export function moduleEdges(
  tables: readonly Table[],
  cards: readonly Pick<ModuleCardModel, 'name' | 'tables'>[],
  options: ModuleEdgeOptions,
): ModuleEdge[] {
  const moduleOf = new Map<string, string>();
  for (const card of cards) for (const name of card.tables) moduleOf.set(name, card.name);
  const hubs = options.hideHubs ? new Set(findHubs(tables).map((hub) => hub.table)) : null;
  const count = new Map<string, number>();
  for (const table of tables) {
    for (const relation of outgoingRelations(table)) {
      if (relation.from.table === relation.to.table) continue;
      if (options.inferredOnly && !relation.inferred) continue;
      if (hubs?.has(relation.to.table)) continue;
      const from = moduleOf.get(relation.from.table);
      const to = moduleOf.get(relation.to.table);
      if (!from || !to || from === to) continue;
      const key = from < to ? `${from}\0${to}` : `${to}\0${from}`;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  return [...count.entries()]
    .map(([key, relationships]) => {
      const [from, to] = key.split('\0');
      return { from, to, relationships };
    })
    .sort((a, b) => b.relationships - a.relationships || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

/** How thick a line of `relationships` foreign keys is drawn: one pixel, plus a quarter pixel each. */
export function moduleLineWidth(relationships: number): number {
  return 1 + relationships / 4;
}

/**
 * A module fades when another is selected and no line joins the two. Nothing is selected, or the
 * module is the selected one, and it stays as it is.
 */
export function moduleDimmed(name: string, selected: string | null, edges: readonly Pick<ModuleEdge, 'from' | 'to'>[]): boolean {
  if (!selected || name === selected) return false;
  return !edges.some((edge) => (edge.from === selected && edge.to === name) || (edge.to === selected && edge.from === name));
}

export interface ModulePlacement {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cards in a grid, a row as tall as its tallest card. `columns` is at least one. `originY` is where the first row starts. */
export function placeModules(
  cards: readonly Pick<ModuleCardModel, 'name' | 'tables' | 'prefixes'>[],
  columns: number,
  selected: string | null,
  originY: number = MODULE_CARD_ORIGIN_Y,
): ModulePlacement[] {
  const cols = Math.max(1, Math.floor(columns) || 1);
  const placed: ModulePlacement[] = [];
  let y = originY;
  for (let i = 0; i < cards.length; i += cols) {
    const row = cards.slice(i, i + cols);
    const heights = row.map((card) => moduleCardHeight(card.tables.length, card.prefixes.length > 0, card.name === selected));
    row.forEach((card, column) => {
      placed.push({
        name: card.name,
        x: MODULE_CARD_ORIGIN_X + column * (MODULE_CARD_WIDTH + MODULE_CARD_GAP_X),
        y,
        width: MODULE_CARD_WIDTH,
        height: heights[column],
      });
    });
    y += Math.max(...heights) + MODULE_CARD_GAP_Y;
  }
  return placed;
}

/** The stage the cards sit on. `padBottom` is the room under the last row. */
export function moduleStageSize(placed: readonly ModulePlacement[], padBottom = 72): { width: number; height: number } {
  let width = MODULE_CARD_ORIGIN_X + MODULE_CARD_WIDTH + MODULE_CARD_ORIGIN_X;
  let height = MODULE_CARD_ORIGIN_Y;
  for (const card of placed) {
    width = Math.max(width, card.x + card.width + MODULE_CARD_ORIGIN_X);
    height = Math.max(height, card.y + card.height + padBottom);
  }
  return { width, height };
}

export interface ModuleLineLayout extends ModuleEdge {
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  /** The selected module is one end, so the line is drawn in the accent colour. */
  active: boolean;
}

/** A line from the middle of one card to the middle of the other, with its count at the midpoint. */
export function layoutModuleLines(
  placed: readonly ModulePlacement[],
  edges: readonly ModuleEdge[],
  selected: string | null,
): ModuleLineLayout[] {
  const at = new Map(placed.map((card) => [card.name, card]));
  const lines: ModuleLineLayout[] = [];
  for (const edge of edges) {
    const from = at.get(edge.from);
    const to = at.get(edge.to);
    if (!from || !to || edge.relationships <= 0) continue;
    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height / 2;
    const x2 = to.x + to.width / 2;
    const y2 = to.y + to.height / 2;
    lines.push({
      ...edge,
      width: moduleLineWidth(edge.relationships),
      x1,
      y1,
      x2,
      y2,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
      active: selected !== null && (edge.from === selected || edge.to === selected),
    });
  }
  return lines;
}

export type ModuleDirection = 'left' | 'right' | 'up' | 'down';

/** The card the arrow keys move to from `selected`: along its row, or the nearest card of the next row. */
export function moduleStep(
  placed: readonly Pick<ModulePlacement, 'name' | 'x' | 'y'>[],
  selected: string,
  direction: ModuleDirection,
): string | null {
  const current = placed.find((card) => card.name === selected);
  if (!current) return placed[0]?.name ?? null;
  const others = placed.filter((card) => card.name !== selected);
  const nearer = (list: typeof others, score: (card: (typeof others)[number]) => number) =>
    list.reduce<(typeof others)[number] | null>((best, card) => (!best || score(card) < score(best) ? card : best), null);
  if (direction === 'left' || direction === 'right') {
    const row = others.filter((card) => card.y === current.y && (direction === 'left' ? card.x < current.x : card.x > current.x));
    return nearer(row, (card) => Math.abs(card.x - current.x))?.name ?? null;
  }
  const column = others.filter((card) => (direction === 'up' ? card.y < current.y : card.y > current.y));
  return nearer(column, (card) => Math.abs(card.y - current.y) * 10_000 + Math.abs(card.x - current.x))?.name ?? null;
}
