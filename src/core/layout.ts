import type { Column, Placement, Position, Positions, Table } from './model';
import type { Notation } from './notation';
import { positionOf } from './positions';
import { curveBlocked, curveBounds, curvePath, pathBlocked, roundedPath, routeAround } from './route';

// Node metrics in canvas units. They mirror the design tokens (--w-node, --h-row) and the .ss-node-head height.
export const NODE_WIDTH = 228;
/** How narrow and how wide a table can be made. */
export const MIN_NODE_WIDTH = 160;
export const MAX_NODE_WIDTH = 640;
/** The widths a table is given are whole steps of this: half the grid, which the width tables have by themselves is on. */
const WIDTH_STEP = 4;
export const NODE_HEAD_HEIGHT = 33;
export const NODE_ROW_HEIGHT = 24;

export const GRID = 8;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
/** One step of the zoom buttons and of ⌘+ / ⌘−. */
export const ZOOM_STEP = 0.1;

export interface Size {
  w: number;
  h: number;
}

export interface Rect extends Position, Size {}

/** A table with more columns than this is a large one: "Collapse large tables" shows only its key columns. */
export const LARGE_TABLE = 12;

/** Whether a column is one of the keys of its table: it is a primary key, references another table, or is unique. */
export function isKeyColumn(column: Column): boolean {
  return !!column.pk || !!column.fk || !!column.unique;
}

/**
 * The columns of `table` that its place on the canvas shows, as indexes of `table.columns`: all of
 * them, only the keys, or none. A column that a foreign key can reference is a primary key or a
 * unique column, so every end of a relationship line is on a shown row.
 */
export function shownColumns(table: Table, at?: Pick<Placement, 'cols'>): number[] {
  const all = table.columns.map((_, i) => i);
  if (at?.cols === 'none') return [];
  return at?.cols === 'keys' ? all.filter((i) => isKeyColumn(table.columns[i])) : all;
}

/** Whether the table shows a row that says how many columns it leaves out: it shows the keys, and has others. */
export function hasMoreRow(table: Table, at?: Pick<Placement, 'cols'>): boolean {
  return at?.cols === 'keys' && shownColumns(table, at).length < table.columns.length;
}

/** How many rows the table at `at` draws under its head. */
function bodyRows(table: Table, at?: Pick<Placement, 'cols'>): number {
  return shownColumns(table, at).length + (hasMoreRow(table, at) ? 1 : 0);
}

/** The height of a table, with the columns that `at` shows. A table that shows none is its head alone, and its two borders. */
export function nodeHeight(table: Table, at?: Pick<Placement, 'cols'>): number {
  return at?.cols === 'none' ? NODE_HEAD_HEIGHT + 2 : NODE_HEAD_HEIGHT + bodyRows(table, at) * NODE_ROW_HEIGHT + 4 + 2;
}

/**
 * Where column `column` of `table` is among the rows it shows: its row number from 0, or -1 for a
 * column it does not show, which a relationship line then meets at the head.
 */
export function rowOf(table: Table, at: Pick<Placement, 'cols'> | undefined, column: number): number {
  return shownColumns(table, at).indexOf(column);
}

/** The placement `to` with the width and the columns shown of `like`, for a table that was moved. */
export function lookOf(to: Position, like: Placement | undefined): Placement {
  return { x: to.x, y: to.y, ...(like?.w === undefined ? {} : { w: like.w }), ...(like?.cols === undefined ? {} : { cols: like.cols }) };
}

export function snap(value: number, grid: number = GRID): number {
  return Math.round(value / grid) * grid;
}

/** How wide the table placed at `at` is: as wide as it was made, or as tables are by themselves. */
export function nodeWidth(at: Placement | undefined): number {
  return at?.w ?? NODE_WIDTH;
}

/** The width a table gets when `w` is wanted: a whole step, no narrower and no wider than a table can be. */
export function clampNodeWidth(w: number): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, snap(w, WIDTH_STEP)));
}

/**
 * The width of the table at `at` once the side `side` of it (1 right, -1 left) has been dragged
 * `dx` across the canvas. The left side lands on the grid tables are moved on.
 */
export function draggedWidth(at: Placement, side: 1 | -1, dx: number): number {
  if (side === 1) return clampNodeWidth(nodeWidth(at) + dx);
  return clampNodeWidth(at.x + nodeWidth(at) - snap(at.x + dx));
}

/**
 * Where the table at `at` is once it is `w` wide: its left side stays where it is, or its right
 * side when it is the left one that was dragged (`side` -1). The width tables have by themselves
 * is not kept, so a table that is made that wide again is as it was.
 */
export function widened(at: Placement, w: number, side: 1 | -1 = 1): Placement {
  const width = clampNodeWidth(w);
  const x = side === 1 ? at.x : at.x + nodeWidth(at) - width;
  return { x, y: at.y, ...(width === NODE_WIDTH ? {} : { w: width }), ...(at.cols === undefined ? {} : { cols: at.cols }) };
}

// A table as the styles lay it out, for the width its text takes: a character of the mono face is
// 0.6 of its size wide (12px, the count of the columns 11px). A row has 10px and the border at
// either side, the glyph of a key (14px), the name, the type and the flag (18px), 6px between
// them; the head has the icon (14px), the name, the dot of unsaved changes and the count, 7px
// between them.
const CHAR = 7.2;
const COUNT_CHAR = 6.6;
const ROW_CHROME = 2 * 11 + 14 + 6 + 6 + 6 + 18;
const HEAD_CHROME = 2 * 11 + 14 + 7 + 7 + 6 + 7;

/** The width at which the table shows its name and the name and type of every column it shows whole, as far as a table can be that wide. */
export function fittingWidth(table: Table, at?: Pick<Placement, 'cols'>): number {
  const schema = table.schema && table.schema !== 'public' ? `${table.schema}.` : '';
  const head = HEAD_CHROME + (schema + (table.name || 'unnamed')).length * CHAR + String(table.columns.length).length * COUNT_CHAR;
  const rows = shownColumns(table, at).map((i) => {
    const c = table.columns[i];
    return ROW_CHROME + ((c.name || 'unnamed').length + (c.type || '—').length + (c.nullable ? 1 : 0)) * CHAR;
  });
  // To a tenth of a px first: the sum of the characters is not exact.
  const widest = Math.round(Math.max(head, ...rows) * 10) / 10;
  return clampNodeWidth(Math.ceil(widest / WIDTH_STEP) * WIDTH_STEP);
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The zoom after one toolbar step of `delta`, kept to whole percents and within the limits. */
export function stepZoom(zoom: number, delta: number): number {
  return clampZoom(Math.round((zoom + delta) * 100) / 100);
}

/** Where an edge meets a node: a point on its left (-1) or right (+1) side. */
export interface Anchor extends Position {
  side: 1 | -1;
}

/** Whether no two rows of `table` can hold the same value in `column`: it is unique, or the only column of the primary key. */
function isSingle(table: Table, column: Column): boolean {
  return !!column.unique || (!!column.pk && table.columns.filter((c) => c.pk).length === 1);
}

/** A relationship line. `a` is the referenced column (one), `b` the foreign-key column (many). */
export interface Edge {
  id: string;
  from: string;
  to: string;
  a: Anchor;
  b: Anchor;
  /** Set for a foreign key that was inferred, which is drawn dashed. */
  inferred?: true;
  /** Set when the foreign-key column may be empty: a row need not reference the other table. */
  optional?: true;
  /** Set when the foreign-key column is unique: a row of the referenced table is referenced by one row at most, a one-to-one relationship. */
  single?: true;
  /**
   * The corners of the line, from `a` to `b`, when it goes around the tables that stand between
   * its two ends (see core/route). Left out for a line that is the curve between them.
   */
  via?: Position[];
}

/** The line between two ends as the `d` of an SVG path: through the corners of `via`, or else the curve between them. */
export function edgePath(a: Anchor, b: Anchor, via?: readonly Position[]): string {
  return via ? roundedPath(via) : curvePath(a, b);
}

/** The radius of the ring that marks "zero" at an end of a relationship line (see `edgeMarks`). */
export const RING_RADIUS = 3.5;

/** The marks at the two ends of a relationship line: strokes, as the `d` of SVG paths, and the centres of rings. */
export interface EdgeMarks {
  paths: string[];
  rings: Position[];
}

/** What the marks of a line need to know about it besides where it ends. */
export interface EdgeKind extends Ends {
  optional?: true;
  single?: true;
}

/**
 * The marks at the two ends of a relationship line. Simple: one bar at the referenced (one) end, a
 * crow's foot at the foreign-key (many) end. Crow's foot: at the referenced end two bars (exactly
 * one), or a bar and a ring (zero or one) when the foreign-key column may be empty; at the other
 * end a foot and a ring (zero or many), or a bar and a ring (zero or one) when the column is unique.
 */
export function edgeMarks({ a, b, optional, single }: EdgeKind, notation: Notation = 'crowsfoot'): EdgeMarks {
  const bar = (end: Anchor, distance: number) => `M${end.x + end.side * distance} ${end.y - 5} V${end.y + 5}`;
  const foot = (end: Anchor, apex: number) => {
    const x = end.x + end.side * apex;
    return `M${x} ${end.y} L${end.x} ${end.y - 5} M${x} ${end.y} L${end.x} ${end.y + 5} M${x} ${end.y} L${end.x} ${end.y}`;
  };
  if (notation === 'simple') return { paths: [bar(a, 8), foot(b, 9)], rings: [] };

  const ring = (end: Anchor, distance: number): Position => ({ x: end.x + end.side * distance, y: end.y });
  const one = optional ? [bar(a, 7)] : [bar(a, 7), bar(a, 12)];
  const paths = single ? [...one, bar(b, 7)] : [...one, foot(b, 10)];
  return { paths, rings: [...(optional ? [ring(a, 14)] : []), ring(b, single ? 14 : 14.5)] };
}

// A line that goes around tables keeps this far from them. Lines to different columns keep
// different distances, one of `LANES`, so that two of them in one gap do not run as one line; the
// widest still leaves a way through the gap between two tables of a grid.
const CLEARANCE = 10;
const LANE_GAP = 4;
const LANES = 3;

/** The height of a row of a table at `position`; of the head for the row -1, a column the table does not show. */
function rowY(position: Position, row: number): number {
  if (row < 0) return position.y + NODE_HEAD_HEIGHT / 2 + 1;
  return position.y + NODE_HEAD_HEIGHT + row * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2 + 1;
}

/** The two ends of a relationship line: `a` at the referenced column, `b` at the foreign-key column. */
export interface Ends {
  a: Anchor;
  b: Anchor;
}

/**
 * The ends of the line for a foreign key on row `row` of the table at `pt` that references row
 * `referencedRow` of the table at `pr` (rows are those a table shows, see `rowOf`; -1 is its head): out of the sides that face each other, or out of the right
 * side of both tables when one is over the other.
 */
export function edgeEnds(pt: Placement, row: number, pr: Placement, referencedRow: number): Ends {
  const fy = rowY(pt, row);
  const ry = rowY(pr, referencedRow);
  const tRight = pt.x + nodeWidth(pt);
  const rRight = pr.x + nodeWidth(pr);
  if (rRight + 24 <= pt.x) {
    return { a: { x: rRight, y: ry, side: 1 }, b: { x: pt.x, y: fy, side: -1 } };
  }
  if (tRight + 24 <= pr.x) {
    return { a: { x: pr.x, y: ry, side: -1 }, b: { x: tRight, y: fy, side: 1 } };
  }
  return { a: { x: rRight, y: ry, side: 1 }, b: { x: tRight, y: fy, side: 1 } };
}

/**
 * The ends of the line for a foreign key that is being drawn from row `row` of the table at `pt`
 * while the pointer, at the canvas point `to`, is on no column it can end on. Like the line of a
 * relationship it leaves the left side of the table for a point left of it and the right side for
 * any other, which it loops back to when the point is not past that side.
 */
export function drawnEnds(pt: Placement, row: number, to: Position): Ends {
  const right = pt.x + nodeWidth(pt);
  const y = rowY(pt, row);
  if (to.x < pt.x) return { a: { x: to.x, y: to.y, side: 1 }, b: { x: pt.x, y, side: -1 } };
  return { a: { x: to.x, y: to.y, side: to.x < right ? 1 : -1 }, b: { x: right, y, side: 1 } };
}

/** The lines of a diagram, and how many of the lines that go behind a table were left as curves because the time given to look for a way around them ran out. */
export interface EdgeSet {
  edges: Edge[];
  pending: number;
}

/** How long and how much `routeEdges` may search for ways around tables. Without a limit it finds a way for every line. */
export interface RouteLimit {
  /** The most lines a way around is searched for. */
  searches?: number;
  /** How long after the call begins no more searches are begun, in ms. */
  ms?: number;
}

/** The side of the squares that `RectIndex` sorts rectangles into, in canvas units. */
const INDEX_CELL = 512;

/** Finds the rectangles near a place without looking at all of them: they are sorted into squares of the canvas. */
class RectIndex {
  private cells = new Map<number, Rect[]>();

  constructor(rects: readonly Rect[]) {
    for (const r of rects) this.each(r, (key) => (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(r));
  }

  private each(box: Rect, visit: (key: number) => void) {
    const x1 = Math.floor(box.x / INDEX_CELL);
    const x2 = Math.floor((box.x + box.w) / INDEX_CELL);
    const y1 = Math.floor(box.y / INDEX_CELL);
    const y2 = Math.floor((box.y + box.h) / INDEX_CELL);
    for (let cy = y1; cy <= y2; cy++) for (let cx = x1; cx <= x2; cx++) visit(cy * 65536 + cx);
  }

  /** The rectangles that touch the inside of `box`. */
  near(box: Rect): Rect[] {
    const found = new Set<Rect>();
    this.each(box, (key) => this.cells.get(key)?.forEach((r) => intersects(r, box) && found.add(r)));
    return [...found];
  }
}

const sameAnchor = (p: Anchor, q: Anchor) => p.x === q.x && p.y === q.y && p.side === q.side;
const intersects = (r: Rect, box: Rect) => r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y;

/**
 * One edge per foreign key whose two tables are both present and placed. A line whose curve would
 * run behind a table goes around the tables instead, when there is a way around.
 *
 * `previous` is the lines of an earlier call: a line that has the same ends and does not run behind
 * a table now is kept as it was, itself and not a copy, so that only the lines the change touched
 * are searched for again. Searching is the costly part: when `limit` runs out, the lines still to
 * search for are drawn as the curve they would have been, and counted in `pending`. Calling again
 * with the lines that came back finishes the job.
 */
export function routeEdges(tables: readonly Table[], positions: Positions, previous: readonly Edge[] = [], limit: RouteLimit = {}): EdgeSet {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const before = new Map(previous.map((e) => [e.id, e]));
  const rects = nodeRects(tables, positions);
  const index = new RectIndex(rects);
  /** The referenced columns of the edges that go around, in the order they are met: each has a lane. */
  const lanes = new Map<string, number>();
  const edges: Edge[] = [];
  const deadline = limit.ms === undefined ? Infinity : performance.now() + limit.ms;
  let searches = 0;
  let pending = 0;
  for (const table of tables) {
    table.columns.forEach((column, i) => {
      const fk = column.fk;
      const referenced = fk ? byName.get(fk.table) : undefined;
      const pt = positionOf(positions, table.name);
      const pr = referenced ? positionOf(positions, referenced.name) : undefined;
      if (!fk || !referenced || !pt || !pr) return;

      const target = Math.max(
        0,
        referenced.columns.findIndex((c) => c.name === fk.column),
      );
      const row = rowOf(referenced, pr, target);
      const ends = edgeEnds(pt, rowOf(table, pt, i), pr, row);
      const id = `${table.name}:${i}`;
      const flags = {
        ...(fk.inferred ? { inferred: true as const } : {}),
        ...(column.nullable ? { optional: true as const } : {}),
        ...(isSingle(table, column) ? { single: true as const } : {}),
      };

      // Only the tables next to the line can be in its way.
      const old = before.get(id);
      const reach = old?.via ? boundsOf(old.via) : curveBounds(ends.a, ends.b);
      const nearby = index.near(reach);
      const kept =
        old && old.from === referenced.name && old.to === table.name && sameAnchor(old.a, ends.a) && sameAnchor(old.b, ends.b) &&
        !(old.via ? pathBlocked(old.via, nearby) : curveBlocked(ends.a, ends.b, nearby));
      if (kept) {
        const same = !!old.inferred === !!flags.inferred && !!old.optional === !!flags.optional && !!old.single === !!flags.single;
        edges.push(same ? old : { id, from: referenced.name, to: table.name, ...ends, ...flags, ...(old.via ? { via: old.via } : {}) });
        return;
      }

      let via: Position[] | null = null;
      if (curveBlocked(ends.a, ends.b, nearby)) {
        const out = (limit.searches !== undefined && searches >= limit.searches) || (deadline !== Infinity && performance.now() > deadline);
        if (out) pending++;
        else {
          searches++;
          const key = `${referenced.name}:${target}`;
          const lane = lanes.get(key) ?? lanes.size;
          const clearance = CLEARANCE + (lane % LANES) * LANE_GAP;
          via = routeAround(ends.a, ends.b, rects, clearance) ?? (clearance > CLEARANCE ? routeAround(ends.a, ends.b, rects, CLEARANCE) : null);
          if (via) lanes.set(key, lane);
        }
      }
      edges.push({ id, from: referenced.name, to: table.name, ...ends, ...flags, ...(via ? { via } : {}) });
    });
  }
  return { edges, pending };
}

/** The rectangle that holds the points. */
function boundsOf(points: readonly Position[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Every line of the diagram, with a way around the tables for each one that needs it. */
export function computeEdges(tables: readonly Table[], positions: Positions): Edge[] {
  return routeEdges(tables, positions).edges;
}

/** The part of the canvas that is on screen, in canvas units. */
export function viewRect(offset: Position, zoom: number, view: Size): Rect {
  return { x: (0 - offset.x) / zoom, y: (0 - offset.y) / zoom, w: view.w / zoom, h: view.h / zoom };
}

/** The pan offset that keeps the canvas point under `point` (screen px) in place while the zoom changes. */
export function zoomAt(offset: Position, zoom: number, nextZoom: number, point: Position): Position {
  const k = nextZoom / zoom;
  return { x: point.x - (point.x - offset.x) * k, y: point.y - (point.y - offset.y) * k };
}

/** The canvas rectangle of every table that has a position. */
export function nodeRects(tables: readonly Table[], positions: Positions): (Rect & { name: string })[] {
  return tables.flatMap((t) => {
    const p = positionOf(positions, t.name);
    return p ? [{ name: t.name, x: p.x, y: p.y, w: nodeWidth(p), h: nodeHeight(t, p) }] : [];
  });
}

/** The rectangle with `a` and `b` at two opposite corners, whichever way it was dragged. */
export function rectBetween(a: Position, b: Position): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/** The names of the placed tables that `rect` covers any part of, in the order of `tables`. */
export function tablesInRect(tables: readonly Table[], positions: Positions, rect: Rect): string[] {
  return nodeRects(tables, positions)
    .filter((n) => n.x <= rect.x + rect.w && rect.x <= n.x + n.w && n.y <= rect.y + rect.h && rect.y <= n.y + n.h)
    .map((n) => n.name);
}

export interface View {
  zoom: number;
  offset: Position;
}

/**
 * The zoom and pan that centre every placed table in a canvas of `view` screen px, `pad` px from its edges.
 * Small diagrams are not enlarged past 100%. With no placed table the view resets.
 */
export function fitView(tables: readonly Table[], positions: Positions, view: Size, pad: number = 48): View {
  const placed = nodeRects(tables, positions);
  if (!placed.length) return { zoom: 1, offset: { x: 0, y: 0 } };
  const minX = Math.min(...placed.map((r) => r.x));
  const minY = Math.min(...placed.map((r) => r.y));
  const w = Math.max(...placed.map((r) => r.x + r.w)) - minX;
  const h = Math.max(...placed.map((r) => r.y + r.h)) - minY;
  const zoom = clampZoom(Math.min(1, (view.w - pad * 2) / w, (view.h - pad * 2) / h));
  return {
    zoom,
    offset: { x: Math.round((view.w - w * zoom) / 2 - minX * zoom), y: Math.round((view.h - h * zoom) / 2 - minY * zoom) },
  };
}

/** How a minimap draws the canvas: the canvas point at its top left corner and its px for one canvas unit. */
export interface MinimapScale {
  origin: Position;
  scale: number;
}

export interface MinimapLayout extends MinimapScale {
  nodes: (Rect & { name: string })[];
  viewport: Rect;
}

/**
 * Scales the placed tables and the visible area to fit a minimap of `size`. Null when no table is placed.
 * With `held` they are drawn at that scale instead, whether they fit or not: the picture stays as it
 * is while the visible area is dragged over it.
 */
export function minimapLayout(
  tables: readonly Table[],
  positions: Positions,
  view: Rect,
  size: Size,
  held?: MinimapScale | null,
  pad: number = 8,
): MinimapLayout | null {
  const placed = nodeRects(tables, positions);
  if (!placed.length) return null;

  let { origin, scale } = held ?? { origin: { x: 0, y: 0 }, scale: 0 };
  if (!held) {
    const all: Rect[] = [...placed, view];
    const minX = Math.min(...all.map((r) => r.x));
    const minY = Math.min(...all.map((r) => r.y));
    const maxX = Math.max(...all.map((r) => r.x + r.w));
    const maxY = Math.max(...all.map((r) => r.y + r.h));
    scale = Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2) / (maxY - minY));
    origin = { x: minX - pad / scale, y: minY - pad / scale };
  }
  const fit = (r: Rect): Rect => ({
    x: (r.x - origin.x) * scale,
    y: (r.y - origin.y) * scale,
    w: r.w * scale,
    h: r.h * scale,
  });
  return { origin, scale, nodes: placed.map((n) => ({ name: n.name, ...fit(n) })), viewport: fit(view) };
}

/** The canvas point that a minimap draws at `point`, in its px. */
export function minimapPoint(map: MinimapScale, point: Position): Position {
  return { x: map.origin.x + point.x / map.scale, y: map.origin.y + point.y / map.scale };
}

/** The pan offset that puts the canvas point `point` in the middle of a canvas of `view` screen px. Whole px, which keeps the text sharp. */
export function centreOn(point: Position, zoom: number, view: Size): Position {
  return { x: Math.round(view.w / 2 - point.x * zoom), y: Math.round(view.h / 2 - point.y * zoom) };
}

const NEW_TABLE_OFFSET = 32;

/**
 * Where a new table goes when no place was pointed at: the middle of `view`, the visible part of
 * the canvas, stepped down and right until no table sits at that very spot. Snapped to the grid.
 */
export function newTablePosition(positions: Positions, view: Rect): Position {
  const taken = new Set(Object.values(positions).map((p) => `${p.x},${p.y}`));
  let x = snap(view.x + (view.w - NODE_WIDTH) / 2);
  let y = snap(view.y + (view.h - (NODE_HEAD_HEIGHT + NODE_ROW_HEIGHT)) / 2);
  while (taken.has(`${x},${y}`)) {
    x += NEW_TABLE_OFFSET;
    y += NEW_TABLE_OFFSET;
  }
  return { x, y };
}

export const GRID_ORIGIN = 24;
// The gaps of the ecommerce sample: columns of nodes 280 apart, and room for the relationship lines between rows.
export const GRID_GAP_X = 52;
export const GRID_GAP_Y = 40;

/** How many columns a grid of `count` tables gets: wider than it is tall, like the canvas. */
export function gridColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count * 1.5)));
}

/**
 * Positions for tables that have none, such as imported ones: a grid filled row by row. Tables
 * differ in height, so each one goes under the column that is shortest so far, which keeps the
 * grid compact; tables of one height simply fill the rows from left to right. Snapped to the grid.
 * The columns are `width` wide, for tables that are wider than tables are by themselves. `looks`
 * has the tables that show fewer columns than they have, which are as short as they show.
 */
export function gridLayout(
  tables: readonly Table[],
  columns: number = gridColumns(tables.length),
  width: number = NODE_WIDTH,
  looks: Positions = {},
): Positions {
  const count = Math.max(1, Math.floor(columns));
  /** Where the next table of each column goes. */
  const bottoms = new Array<number>(count).fill(GRID_ORIGIN);
  const positions: Positions = {};
  for (const table of tables) {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const y = snap(bottoms[column]);
    positions[table.name] = { x: snap(GRID_ORIGIN + column * (width + GRID_GAP_X)), y };
    bottoms[column] = y + nodeHeight(table, positionOf(looks, table.name)) + GRID_GAP_Y;
  }
  return positions;
}
