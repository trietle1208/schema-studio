import { GRID, GRID_GAP_X, GRID_GAP_Y, GRID_ORIGIN, NODE_WIDTH, gridColumns, gridLayout, nodeHeight, snap } from './layout';
import type { Position, Positions, Table } from './model';
import { positionOf } from './positions';

// Related tables stand further apart than the tables of a grid: their relationship lines curve in the gap.
const LAYER_GAP_X = 92;
// Between two groups of tables that have nothing to do with each other.
const GROUP_GAP = 72;
// A column of tables is split before it grows much taller than a screen.
const MIN_COLUMN_HEIGHT = 1200;
// How much wider than tall the groups are packed, like the canvas.
const ASPECT = 1.5;
const SWEEPS = 8;
// What a relationship line takes of a column it passes through, between two of its tables, on top of the gap they have anyway.
const LINE_ROOM = 16;

interface Node {
  table: Table;
  h: number;
  /** The tables this one references and the tables that reference it, as indexes. */
  parents: number[];
  children: number[];
}

/** A group of related tables laid out on its own, from 0,0. */
interface Block {
  at: Map<string, Position>;
  w: number;
  h: number;
}

function up(value: number): number {
  return Math.ceil(value / GRID) * GRID;
}

/** The foreign keys between `tables`, inferred ones included. One that references its own table links nothing. */
function graph(tables: readonly Table[]): Node[] {
  const index = new Map(tables.map((t, i) => [t.name, i]));
  const nodes: Node[] = tables.map((table) => ({ table, h: nodeHeight(table), parents: [], children: [] }));
  nodes.forEach((node, i) => {
    for (const column of node.table.columns) {
      const j = column.fk ? index.get(column.fk.table) : undefined;
      if (j === undefined || j === i || node.parents.includes(j)) continue;
      node.parents.push(j);
      nodes[j].children.push(i);
    }
  });
  return nodes;
}

/** The tables that are linked to each other, directly or through other tables, as one group each. */
function groups(nodes: readonly Node[]): number[][] {
  const seen = new Set<number>();
  const found: number[][] = [];
  nodes.forEach((_, start) => {
    if (seen.has(start)) return;
    const group = [start];
    seen.add(start);
    for (let k = 0; k < group.length; k++) {
      const node = nodes[group[k]];
      for (const j of [...node.parents, ...node.children]) {
        if (seen.has(j)) continue;
        seen.add(j);
        group.push(j);
      }
    }
    found.push(group.sort((a, b) => a - b));
  });
  return found;
}

/**
 * How many steps right of the leftmost column each table of a group goes: one further than the
 * last of the tables it references. A foreign key that closes a cycle is not counted.
 */
function ranks(nodes: readonly Node[], group: readonly number[]): Map<number, number> {
  const rank = new Map<number, number>();
  const open = new Set<number>();
  const visit = (i: number): number => {
    const known = rank.get(i);
    if (known !== undefined) return known;
    open.add(i);
    let r = 0;
    for (const p of nodes[i].parents) if (!open.has(p)) r = Math.max(r, visit(p) + 1);
    open.delete(i);
    rank.set(i, r);
    return r;
  };
  group.forEach(visit);

  // A table that references nothing need not start at the far left: it goes next to the first table that references it.
  const moved = new Map<number, number>();
  for (const i of group) {
    if (rank.get(i) !== 0) continue;
    const next = Math.min(...nodes[i].children.map((c) => rank.get(c) ?? 0).filter((r) => r > 0));
    if (Number.isFinite(next)) moved.set(i, next - 1);
  }
  moved.forEach((r, i) => rank.set(i, r));
  return rank;
}

/**
 * The tables of a group as columns, left to right: referenced tables left of the tables that
 * reference them. A column that would be too tall first sends tables to the other side of the
 * tables they reference, and is split into several if it still is.
 */
function columnsOf(nodes: readonly Node[], group: readonly number[]): number[][] {
  const rank = ranks(nodes, group);
  const layers = new Map<number, number[]>();
  const layer = (r: number) => layers.get(r) ?? [];
  for (const i of group) {
    const r = rank.get(i) ?? 0;
    layers.set(r, [...layer(r), i]);
  }
  const size = (i: number) => nodes[i].h + GRID_GAP_Y;
  const heightOf = (column: readonly number[]) => column.reduce((sum, i) => sum + size(i), 0);
  const area = (NODE_WIDTH + LAYER_GAP_X) * heightOf(group);
  const limit = Math.max(MIN_COLUMN_HEIGHT, Math.sqrt(area * ASPECT));

  // A table that nothing references is as near to the tables it references on their left as on
  // their right, so the tables of a master table can stand around it.
  const across = new Set<number>();
  for (let r = Math.max(...layers.keys()); r >= 1; r--) {
    let from = heightOf(layer(r));
    let to = heightOf(layer(r - 2));
    for (const i of layer(r)) {
      if (from <= limit) break;
      const fits = to + size(i) < from;
      if (!fits || nodes[i].children.length || nodes[i].parents.some((p) => rank.get(p) !== r - 1)) continue;
      across.add(i);
      layers.set(r, layer(r).filter((j) => j !== i));
      layers.set(r - 2, [...layer(r - 2), i]);
      from -= size(i);
      to += size(i);
    }
  }

  // Which end of a split column a table belongs at: away from the next column when nothing there is linked to it.
  const end = (i: number) => (across.has(i) ? 2 : nodes[i].children.length ? 1 : 0);
  return [...layers.keys()]
    .sort((a, b) => a - b)
    .flatMap((r) => {
      const column = layer(r);
      const total = heightOf(column);
      const parts = Math.ceil(total / limit);
      if (parts <= 1) return [column];
      const split: number[][] = Array.from({ length: parts }, () => []);
      let above = 0;
      for (const i of [...column].sort((a, b) => end(a) - end(b))) {
        split[Math.min(parts - 1, Math.floor(((above + size(i) / 2) / total) * parts))].push(i);
        above += size(i);
      }
      return split;
    })
    .filter((column) => column.length > 0);
}

/**
 * Tops for the tables of one column, in order: as near to `wanted` as they get without two of them
 * closer than the row gap (least squares).
 */
function stack(heights: readonly number[], wanted: readonly number[]): number[] {
  // With the room for the tables above taken off, the tops only have to be in order, which is an
  // isotonic regression: runs that are out of order share their mean.
  const offsets: number[] = [];
  let above = 0;
  for (const h of heights) {
    offsets.push(above);
    above += h + GRID_GAP_Y;
  }
  const runs: { sum: number; count: number }[] = [];
  wanted.forEach((y, k) => {
    let run = { sum: y - offsets[k], count: 1 };
    for (let last = runs[runs.length - 1]; last && last.sum / last.count >= run.sum / run.count; last = runs[runs.length - 1]) {
      runs.pop();
      run = { sum: last.sum + run.sum, count: last.count + run.count };
    }
    runs.push(run);
  });
  const tops: number[] = [];
  for (const run of runs) {
    for (let n = 0; n < run.count; n++) tops.push(run.sum / run.count + offsets[tops.length]);
  }
  return tops;
}

/**
 * Lays out one group of related tables: referenced tables to the left of the tables that reference
 * them, and each table at the height of the tables it is linked to, so that the lines are short
 * and seldom cross. A line between two tables that are more than a column apart has a place in
 * each column between them, like a table that is only `LINE_ROOM` high: the tables of that column
 * leave it a gap to pass through.
 */
function block(nodes: readonly Node[], group: readonly number[]): Block {
  const columns = columnsOf(nodes, group);
  const columnOf = new Map<number, number>();
  columns.forEach((column, c) => {
    for (const i of column) columnOf.set(i, c);
  });

  // The tables by their indexes, and after them the places of the lines.
  const heights = new Map<number, number>(group.map((i) => [i, nodes[i].h]));
  const links = new Map<number, number[]>(group.map((i) => [i, []]));
  const link = (a: number, b: number) => {
    links.get(a)?.push(b);
    links.get(b)?.push(a);
  };
  let places = nodes.length;
  for (const i of group) {
    for (const p of nodes[i].parents) {
      const from = columnOf.get(p) ?? 0;
      const to = columnOf.get(i) ?? 0;
      let last = p;
      for (let c = Math.min(from, to) + 1; c < Math.max(from, to); c++) {
        const place = places++;
        // With the gap under it, it takes `LINE_ROOM` of the column.
        heights.set(place, LINE_ROOM - GRID_GAP_Y);
        links.set(place, []);
        columnOf.set(place, c);
        columns[c].push(place);
        link(last, place);
        last = place;
      }
      link(last, i);
    }
  }

  const height = (i: number) => heights.get(i) ?? 0;
  const top = new Map<number, number>();
  const centre = (i: number) => (top.get(i) ?? 0) + height(i) / 2;
  const settle = (column: number[], wanted: (i: number) => number) => {
    const tops = stack(
      column.map(height),
      column.map((i) => wanted(i) - height(i) / 2),
    );
    column.forEach((i, k) => top.set(i, tops[k]));
  };

  for (const column of columns) settle(column, () => 0);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const order = columns.map((_, c) => (sweep % 2 ? columns.length - 1 - c : c));
    for (const c of order) {
      const column = columns[c];
      const wanted = new Map<number, number>();
      for (const i of column) {
        const linked = (links.get(i) ?? []).filter((j) => columnOf.get(j) !== c);
        wanted.set(i, linked.length ? linked.reduce((sum, j) => sum + centre(j), 0) / linked.length : centre(i));
      }
      column.sort((a, b) => (wanted.get(a) ?? 0) - (wanted.get(b) ?? 0));
      settle(column, (i) => wanted.get(i) ?? 0);
    }
  }

  // Onto the grid, without giving up any of the gap between two tables.
  for (const column of columns) {
    let next = -Infinity;
    for (const i of column) {
      const y = Math.max(snap(top.get(i) ?? 0), up(next));
      top.set(i, y);
      next = y + height(i) + GRID_GAP_Y;
    }
  }
  const minY = Math.min(...group.map((i) => top.get(i) ?? 0));
  const at = new Map<string, Position>();
  let h = 0;
  columns.forEach((column, c) => {
    for (const i of column) {
      if (i >= nodes.length) continue;
      const y = (top.get(i) ?? 0) - minY;
      at.set(nodes[i].table.name, { x: snap(c * (NODE_WIDTH + LAYER_GAP_X)), y });
      h = Math.max(h, y + nodes[i].h);
    }
  });
  return { at, w: snap((columns.length - 1) * (NODE_WIDTH + LAYER_GAP_X)) + NODE_WIDTH, h };
}

/** The tables that have no relationship, as a grid of `columns`. */
function gridBlock(tables: readonly Table[], columns: number): Block {
  const grid = gridLayout(tables, columns);
  const at = new Map<string, Position>();
  let w = 0;
  let h = 0;
  for (const table of tables) {
    const p = positionOf(grid, table.name);
    if (!p) continue;
    at.set(table.name, { x: p.x - GRID_ORIGIN, y: p.y - GRID_ORIGIN });
    w = Math.max(w, p.x - GRID_ORIGIN + NODE_WIDTH);
    h = Math.max(h, p.y - GRID_ORIGIN + nodeHeight(table));
  }
  return { at, w, h };
}

/**
 * Puts the groups side by side in rows no wider than `limit`, like words on a page, and the grid
 * of the `loose` tables after them. A grid that gets a row to itself is as wide as the rows above.
 */
function pack(related: readonly Block[], loose: readonly Table[], limit: number): Block {
  const at = new Map<string, Position>();
  let x = 0;
  let y = 0;
  let row = 0;
  let w = 0;
  const fits = (b: Block) => x === 0 || x + b.w <= limit;
  const put = (b: Block) => {
    if (!fits(b)) {
      y = up(y + row + GROUP_GAP);
      x = 0;
      row = 0;
    }
    b.at.forEach((p, name) => at.set(name, { x: x + p.x, y: y + p.y }));
    w = Math.max(w, x + b.w);
    x = up(x + b.w + GROUP_GAP);
    row = Math.max(row, b.h);
  };
  related.forEach(put);
  if (loose.length) {
    const columns = gridColumns(loose.length);
    const grid = gridBlock(loose, columns);
    const across = Math.floor((w + GRID_GAP_X) / (NODE_WIDTH + GRID_GAP_X));
    put(fits(grid) ? grid : gridBlock(loose, Math.max(columns, across)));
  }
  return { at, w, h: y + row };
}

/**
 * Positions for every table, chosen from the relationships: each group of related tables reads
 * from left to right, from the tables that are referenced to the tables that reference them, the
 * largest group first. Tables without any relationship follow in a grid. The positions the tables
 * had play no part, so arranging twice changes nothing. Snapped to the grid.
 */
export function arrangeTables(tables: readonly Table[]): Positions {
  const nodes = graph(tables);
  const related: Block[] = [];
  const loose: Table[] = [];
  for (const group of groups(nodes)) {
    if (group.length === 1) loose.push(tables[group[0]]);
    else related.push(block(nodes, group));
  }
  related.sort((a, b) => b.at.size - a.at.size);

  // Of the row widths that put one group more on the first row each, the one that leaves the diagram nearest to the shape of the canvas.
  let whole: Block | null = null;
  let best = Infinity;
  let limit = 0;
  for (const b of [...related, ...(loose.length ? [gridBlock(loose, gridColumns(loose.length))] : [])]) {
    limit = up(limit + b.w + GROUP_GAP);
    const packed = pack(related, loose, limit);
    const off = Math.abs(Math.log(packed.w / packed.h / ASPECT));
    if (off < best) {
      best = off;
      whole = packed;
    }
  }

  const positions: Positions = {};
  for (const table of tables) {
    const p = whole?.at.get(table.name);
    if (p) positions[table.name] = { x: GRID_ORIGIN + p.x, y: GRID_ORIGIN + p.y };
  }
  return positions;
}

/**
 * The positions with the tables called `names` arranged among themselves, as `arrangeTables` does
 * a whole schema, and every other table where it was. Only the relationships between those tables
 * count. They keep the top left corner of the area they took up, so they stay where they were on
 * the canvas, and arranging them twice changes nothing.
 */
export function arrangeOnly(tables: readonly Table[], positions: Positions, names: readonly string[]): Positions {
  const wanted = new Set(names);
  const chosen = tables.filter((t) => wanted.has(t.name));
  const arranged = Object.entries(arrangeTables(chosen));
  const were = chosen.flatMap((t) => positionOf(positions, t.name) ?? []);
  if (!arranged.length) return positions;
  const corner = (points: readonly Position[]) => ({
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
  });
  const from = corner(arranged.map(([, p]) => p));
  // Tables that were never placed have no corner to keep.
  const to = were.length ? corner(were) : from;
  const placed = arranged.map(([name, p]) => [name, { x: snap(to.x) + p.x - from.x, y: snap(to.y) + p.y - from.y }]);
  return { ...positions, ...Object.fromEntries(placed) };
}
