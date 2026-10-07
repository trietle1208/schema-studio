import type { Position, Positions, Table } from './model';
import { positionOf } from './positions';

// Node metrics in canvas units. They mirror the design tokens (--w-node, --h-row) and the .ss-node-head height.
export const NODE_WIDTH = 228;
export const NODE_HEAD_HEIGHT = 33;
export const NODE_ROW_HEIGHT = 24;

export const GRID = 8;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

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
}

export function edgePath(a: Anchor, b: Anchor): string {
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2);
  return `M${a.x} ${a.y} C${a.x + a.side * dx} ${a.y} ${b.x + b.side * dx} ${b.y} ${b.x} ${b.y}`;
}

function rowY(position: Position, row: number): number {
  return position.y + NODE_HEAD_HEIGHT + row * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2 + 1;
}

/** One edge per foreign key whose two tables are both present and placed. */
export function computeEdges(tables: readonly Table[], positions: Positions): Edge[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
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
      const fy = rowY(pt, i);
      const ry = rowY(pr, row);
      let a: Anchor;
      let b: Anchor;
      if (pr.x + NODE_WIDTH + 24 <= pt.x) {
        a = { x: pr.x + NODE_WIDTH, y: ry, side: 1 };
        b = { x: pt.x, y: fy, side: -1 };
      } else if (pt.x + NODE_WIDTH + 24 <= pr.x) {
        a = { x: pr.x, y: ry, side: -1 };
        b = { x: pt.x + NODE_WIDTH, y: fy, side: 1 };
      } else {
        a = { x: pr.x + NODE_WIDTH, y: ry, side: 1 };
        b = { x: pt.x + NODE_WIDTH, y: fy, side: 1 };
      }
      edges.push({ id: `${table.name}:${i}`, from: referenced.name, to: table.name, a, b });
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

export interface MinimapLayout {
  nodes: (Rect & { name: string })[];
  viewport: Rect;
}

/** Scales the placed tables and the visible area to fit a minimap of `size`. Null when no table is placed. */
export function minimapLayout(
  tables: readonly Table[],
  positions: Positions,
  view: Rect,
  size: Size,
  pad: number = 8,
): MinimapLayout | null {
  const placed = nodeRects(tables, positions);
  if (!placed.length) return null;

  const all: Rect[] = [...placed, view];
  const minX = Math.min(...all.map((r) => r.x));
  const minY = Math.min(...all.map((r) => r.y));
  const maxX = Math.max(...all.map((r) => r.x + r.w));
  const maxY = Math.max(...all.map((r) => r.y + r.h));
  const scale = Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2) / (maxY - minY));
  const fit = (r: Rect): Rect => ({
    x: pad + (r.x - minX) * scale,
    y: pad + (r.y - minY) * scale,
    w: r.w * scale,
    h: r.h * scale,
  });
  return { nodes: placed.map((n) => ({ name: n.name, ...fit(n) })), viewport: fit(view) };
}
