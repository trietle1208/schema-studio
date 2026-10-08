import type { Position, Positions, Table } from './model';
import { positionOf } from './positions';
import { curveBlocked, curvePath, roundedPath, routeAround } from './route';

// Node metrics in canvas units. They mirror the design tokens (--w-node, --h-row) and the .ss-node-head height.
export const NODE_WIDTH = 228;
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

export function nodeHeight(table: Table): number {
  return NODE_HEAD_HEIGHT + table.columns.length * NODE_ROW_HEIGHT + 4 + 2;
}

export function snap(value: number, grid: number = GRID): number {
  return Math.round(value / grid) * grid;
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

/** A relationship line. `a` is the referenced column (one), `b` the foreign-key column (many). */
export interface Edge {
  id: string;
  from: string;
  to: string;
  a: Anchor;
  b: Anchor;
  /** Set for a foreign key that was inferred, which is drawn dashed. */
  inferred?: true;
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

/**
 * The marks at the two ends of a relationship line, each as the `d` of an SVG path: one bar at the
 * referenced (one) end, a crow's foot at the foreign-key (many) end.
 */
export function edgeEndPaths({ a, b }: Ends): { one: string; many: string } {
  const bar = a.x + a.side * 8;
  const foot = b.x + b.side * 9;
  return {
    one: `M${bar} ${a.y - 5} V${a.y + 5}`,
    many: `M${foot} ${b.y} L${b.x} ${b.y - 5} M${foot} ${b.y} L${b.x} ${b.y + 5} M${foot} ${b.y} L${b.x} ${b.y}`,
  };
}

// A line that goes around tables keeps this far from them. Lines to different columns keep
// different distances, one of `LANES`, so that two of them in one gap do not run as one line; the
// widest still leaves a way through the gap between two tables of a grid.
const CLEARANCE = 10;
const LANE_GAP = 4;
const LANES = 3;

function rowY(position: Position, row: number): number {
  return position.y + NODE_HEAD_HEIGHT + row * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2 + 1;
}

/** The two ends of a relationship line: `a` at the referenced column, `b` at the foreign-key column. */
export interface Ends {
  a: Anchor;
  b: Anchor;
}

/**
 * The ends of the line for a foreign key on row `row` of the table at `pt` that references row
 * `referencedRow` of the table at `pr`: out of the sides that face each other, or out of the right
 * side of both tables when one is over the other.
 */
export function edgeEnds(pt: Position, row: number, pr: Position, referencedRow: number): Ends {
  const fy = rowY(pt, row);
  const ry = rowY(pr, referencedRow);
  if (pr.x + NODE_WIDTH + 24 <= pt.x) {
    return { a: { x: pr.x + NODE_WIDTH, y: ry, side: 1 }, b: { x: pt.x, y: fy, side: -1 } };
  }
  if (pt.x + NODE_WIDTH + 24 <= pr.x) {
    return { a: { x: pr.x, y: ry, side: -1 }, b: { x: pt.x + NODE_WIDTH, y: fy, side: 1 } };
  }
  return { a: { x: pr.x + NODE_WIDTH, y: ry, side: 1 }, b: { x: pt.x + NODE_WIDTH, y: fy, side: 1 } };
}

/**
 * The ends of the line for a foreign key that is being drawn from row `row` of the table at `pt`
 * while the pointer, at the canvas point `to`, is on no column it can end on. Like the line of a
 * relationship it leaves the left side of the table for a point left of it and the right side for
 * any other, which it loops back to when the point is not past that side.
 */
export function drawnEnds(pt: Position, row: number, to: Position): Ends {
  const right = pt.x + NODE_WIDTH;
  const y = rowY(pt, row);
  if (to.x < pt.x) return { a: { x: to.x, y: to.y, side: 1 }, b: { x: pt.x, y, side: -1 } };
  return { a: { x: to.x, y: to.y, side: to.x < right ? 1 : -1 }, b: { x: right, y, side: 1 } };
}

/**
 * One edge per foreign key whose two tables are both present and placed. An edge whose curve would
 * run behind a table goes around the tables instead, when there is a way around.
 */
export function computeEdges(tables: readonly Table[], positions: Positions): Edge[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const rects = nodeRects(tables, positions);
  /** The referenced columns of the edges that go around, in the order they are met: each has a lane. */
  const lanes = new Map<string, number>();
  const edges: Edge[] = [];
  for (const table of tables) {
    table.columns.forEach((column, i) => {
      const fk = column.fk;
      const referenced = fk ? byName.get(fk.table) : undefined;
      const pt = positionOf(positions, table.name);
      const pr = referenced ? positionOf(positions, referenced.name) : undefined;
      if (!fk || !referenced || !pt || !pr) return;

      const row = Math.max(
        0,
        referenced.columns.findIndex((c) => c.name === fk.column),
      );
      const ends = edgeEnds(pt, i, pr, row);
      let via: Position[] | null = null;
      if (curveBlocked(ends.a, ends.b, rects)) {
        const key = `${referenced.name}:${row}`;
        const lane = lanes.get(key) ?? lanes.size;
        const clearance = CLEARANCE + (lane % LANES) * LANE_GAP;
        via = routeAround(ends.a, ends.b, rects, clearance) ?? (clearance > CLEARANCE ? routeAround(ends.a, ends.b, rects, CLEARANCE) : null);
        if (via) lanes.set(key, lane);
      }
      edges.push({
        id: `${table.name}:${i}`,
        from: referenced.name,
        to: table.name,
        ...ends,
        ...(fk.inferred ? { inferred: true as const } : {}),
        ...(via ? { via } : {}),
      });
    });
  }
  return edges;
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
    return p ? [{ name: t.name, x: p.x, y: p.y, w: NODE_WIDTH, h: nodeHeight(t) }] : [];
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
 */
export function gridLayout(tables: readonly Table[], columns: number = gridColumns(tables.length)): Positions {
  const count = Math.max(1, Math.floor(columns));
  /** Where the next table of each column goes. */
  const bottoms = new Array<number>(count).fill(GRID_ORIGIN);
  const positions: Positions = {};
  for (const table of tables) {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const y = snap(bottoms[column]);
    positions[table.name] = { x: snap(GRID_ORIGIN + column * (NODE_WIDTH + GRID_GAP_X)), y };
    bottoms[column] = y + nodeHeight(table) + GRID_GAP_Y;
  }
  return positions;
}
