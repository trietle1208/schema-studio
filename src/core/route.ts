import type { Anchor, Rect } from './layout';
import type { Position } from './model';

// A relationship line is a curve between its two ends (see `edgePath` in core/layout). When that
// curve would run behind a table, the line goes around instead: out of the side of each end, then
// along horizontal and vertical lines through the gaps between the tables, with rounded corners.

/** How far the curve reaches out of the side of a table before it turns: half the way to the other end, and at least this. */
const CURVE_REACH = 36;
/** How many points of the curve are looked at to tell whether it runs behind a table. */
const SAMPLES = 24;
/** A curve may touch the edge of a table; it is behind it from this far in. */
const INSIDE = 2;
/** What a corner costs, in canvas units of length: a line makes a detour of this much to save one. */
const BEND = 48;
/** How far past its two ends a line looks for a way around, before it looks over the whole canvas. */
const REACH = 260;
const CORNER_RADIUS = 8;
/**
 * The most points a search looks through (the crossings of the lines along the sides of the tables
 * it may run between). A line whose search would be larger stays the curve it was, which a diagram of
 * hundreds of tables could not afford to route around for every line.
 */
const MAX_POINTS = 160_000;

/** The four points of the curve between two ends: the ends and the two that pull it out of the sides. */
function controls(a: Anchor, b: Anchor): [Position, Position, Position, Position] {
  const dx = Math.max(CURVE_REACH, Math.abs(b.x - a.x) / 2);
  return [a, { x: a.x + a.side * dx, y: a.y }, { x: b.x + b.side * dx, y: b.y }, b];
}

/** The curve between two ends, as the `d` of an SVG path. */
export function curvePath(a: Anchor, b: Anchor): string {
  const [p0, p1, p2, p3] = controls(a, b);
  return `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
}

/** The rectangle the curve between two ends stays inside: its four control points hold it. */
export function curveBounds(a: Anchor, b: Anchor): Rect {
  const points = controls(a, b);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Whether a line through `points`, a stretch after the other, runs behind one of `rects`: one of its stretches crosses the inside of a table. */
export function pathBlocked(points: readonly Position[], rects: readonly Rect[]): boolean {
  for (let k = 1; k < points.length; k++) {
    const p = points[k - 1];
    const q = points[k];
    const left = Math.min(p.x, q.x);
    const right = Math.max(p.x, q.x);
    const top = Math.min(p.y, q.y);
    const bottom = Math.max(p.y, q.y);
    if (rects.some((r) => right > r.x + INSIDE && left < r.x + r.w - INSIDE && bottom > r.y + INSIDE && top < r.y + r.h - INSIDE)) return true;
  }
  return false;
}

/** Whether the curve between two ends runs behind one of `rects`. */
export function curveBlocked(a: Anchor, b: Anchor, rects: readonly Rect[]): boolean {
  const [p0, p1, p2, p3] = controls(a, b);
  for (let k = 1; k < SAMPLES; k++) {
    const t = k / SAMPLES;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    if (rects.some((r) => x > r.x + INSIDE && x < r.x + r.w - INSIDE && y > r.y + INSIDE && y < r.y + r.h - INSIDE)) return true;
  }
  return false;
}

/** The moves of a line: right, down, left, up. */
const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;

/** A min-heap of numbers, each with the key it was pushed with. */
class Queue {
  private items: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number) {
    const { items, keys } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      items[i] = items[parent];
      keys[i] = keys[parent];
      i = parent;
    }
    items[i] = item;
    keys[i] = key;
  }

  pop(): number {
    const { items, keys } = this;
    const top = items[0];
    const last = items.pop() as number;
    const lastKey = keys.pop() as number;
    if (items.length) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= items.length) break;
        if (child + 1 < items.length && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= lastKey) break;
        items[i] = items[child];
        keys[i] = keys[child];
        i = child;
      }
      items[i] = last;
      keys[i] = lastKey;
    }
    return top;
  }
}

const ascending = (values: readonly number[]) => [...new Set(values)].sort((p, q) => p - q);

/** The index of the first number of the sorted `values` that is not less than `value`. */
function lowerBound(values: readonly number[], value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The index of the first number of the sorted `values` that is greater than `value`. */
function upperBound(values: readonly number[], value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

// A search needs a few arrays as long as its points are many. They are kept from one search to the
// next, as hundreds of lines of a diagram are searched for one after the other.
let costs = new Float64Array(0);
let origins = new Int32Array(0);
let visited = new Uint8Array(0);
let shut = new Uint8Array(0);

function scratch(states: number, points: number) {
  if (costs.length < states) {
    costs = new Float64Array(states);
    origins = new Int32Array(states);
    visited = new Uint8Array(states);
  }
  if (shut.length < points * 2) shut = new Uint8Array(points * 2);
  costs.fill(Infinity, 0, states);
  origins.fill(-1, 0, states);
  visited.fill(0, 0, states);
  shut.fill(0, 0, points * 2);
}

/** The way from `from` to `to` among `walls`, which it may run along and not through, inside `area`; null when there is none. */
function wayThrough(from: Position, to: Position, leave: 1 | -1, walls: readonly Rect[], area: Rect | null): Position[] | null {
  const near = area
    ? walls.filter((w) => w.x < area.x + area.w && w.x + w.w > area.x && w.y < area.y + area.h && w.y + w.h > area.y)
    : walls;
  const within = (v: number, low: number, size: number) => !area || (v >= low && v <= low + size);
  // A line turns where a wall begins or ends, and at the height or the side of its two ends.
  const xs = ascending([from.x, to.x, ...near.flatMap((w) => [w.x, w.x + w.w])].filter((x) => within(x, area?.x ?? 0, area?.w ?? 0)));
  const ys = ascending([from.y, to.y, ...near.flatMap((w) => [w.y, w.y + w.h])].filter((y) => within(y, area?.y ?? 0, area?.h ?? 0)));
  const inWall = (x: number, y: number) => near.some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);

  const cols = xs.length;
  const rows = ys.length;
  if (cols * rows > MAX_POINTS) return null;
  if (inWall(from.x, from.y) || inWall(to.x, to.y)) return null;
  const start = lowerBound(ys, from.y) * cols + lowerBound(xs, from.x);
  const goal = lowerBound(ys, to.y) * cols + lowerBound(xs, to.x);

  // No wall begins or ends between two lines next to each other, so a way between two points is
  // free when the walls do not cover it: found once for every wall instead of for every step.
  // `shut[2p]` is the way from point p to the point on its right, `shut[2p + 1]` the way down.
  scratch(cols * rows * 4, cols * rows);
  for (const w of near) {
    const left = lowerBound(xs, w.x);
    const right = upperBound(xs, w.x + w.w) - 1;
    const top = lowerBound(ys, w.y);
    const bottom = upperBound(ys, w.y + w.h) - 1;
    // Along a line strictly inside the wall, the ways between the sides of the wall are covered.
    for (let j = upperBound(ys, w.y); j < lowerBound(ys, w.y + w.h); j++) {
      for (let i = left; i < right; i++) shut[2 * (j * cols + i)] = 1;
    }
    for (let i = upperBound(xs, w.x); i < lowerBound(xs, w.x + w.w); i++) {
      for (let j = top; j < bottom; j++) shut[2 * (j * cols + i) + 1] = 1;
    }
  }

  // A state is a point with the direction the line came to it in.
  const cost = costs;
  const came = origins;
  const done = visited;
  const ahead = (state: number) => {
    const point = state >> 2;
    return Math.abs(xs[point % cols] - to.x) + Math.abs(ys[(point / cols) | 0] - to.y);
  };
  const queue = new Queue();
  const first = start * 4 + (leave === 1 ? 0 : 2);
  cost[first] = 0;
  queue.push(first, ahead(first));

  while (queue.size) {
    const state = queue.pop();
    if (done[state]) continue;
    done[state] = 1;
    const point = state >> 2;
    const d = state & 3;
    if (point === goal) {
      const points: Position[] = [];
      for (let s = state; s >= 0; s = came[s]) points.push({ x: xs[(s >> 2) % cols], y: ys[((s >> 2) / cols) | 0] });
      return points.reverse();
    }
    const i = point % cols;
    const j = (point / cols) | 0;
    for (let n = 0; n < 4; n++) {
      // A line does not turn back on itself.
      if (n === (d + 2) % 4) continue;
      const ni = i + DIRECTIONS[n].x;
      const nj = j + DIRECTIONS[n].y;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      // The way to the next point is the one stored for the point on the left or above.
      const covered = n === 0 ? shut[2 * point] : n === 1 ? shut[2 * point + 1] : n === 2 ? shut[2 * (point - 1)] : shut[2 * (point - cols) + 1];
      if (covered) continue;
      const next = (nj * cols + ni) * 4 + n;
      const total = cost[state] + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (n === d ? 0 : BEND);
      if (total >= cost[next]) continue;
      cost[next] = total;
      came[next] = state;
      queue.push(next, total + ahead(next));
    }
  }
  return null;
}

/** The points without the ones that lie on the line between the point before and the point after. */
function corners(points: readonly Position[]): Position[] {
  return points.filter((p, k) => {
    const before = points[k - 1];
    const after = points[k + 1];
    if (!before || !after) return true;
    return !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y));
  });
}

/**
 * The corners of a line from `a` to `b` that runs around `rects`, no nearer to any of them than
 * `clearance`: from `a` and to `b` out of their sides, and between them along horizontal and
 * vertical lines, as short as it gets with few corners. Both ends are in the list. Null when there
 * is no such line, as when a table stands right against one of the ends.
 */
export function routeAround(a: Anchor, b: Anchor, rects: readonly Rect[], clearance: number): Position[] | null {
  const walls = rects.map((r) => ({ x: r.x - clearance, y: r.y - clearance, w: r.w + 2 * clearance, h: r.h + 2 * clearance }));
  const from = { x: a.x + a.side * clearance, y: a.y };
  const to = { x: b.x + b.side * clearance, y: b.y };
  const near: Rect = {
    x: Math.min(from.x, to.x) - REACH,
    y: Math.min(from.y, to.y) - REACH,
    w: Math.abs(to.x - from.x) + 2 * REACH,
    h: Math.abs(to.y - from.y) + 2 * REACH,
  };
  const way = wayThrough(from, to, a.side, walls, near) ?? wayThrough(from, to, a.side, walls, null);
  return way && corners([{ x: a.x, y: a.y }, ...way, { x: b.x, y: b.y }]);
}

/** A line through `points` with its corners rounded, as the `d` of an SVG path. */
export function roundedPath(points: readonly Position[], radius: number = CORNER_RADIUS): string {
  if (!points.length) return '';
  const length = (p: Position, q: Position) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
  /** The point `r` from `p` on the way to `q`. */
  const toward = (p: Position, q: Position, r: number) => {
    const l = length(p, q) || 1;
    return `${p.x + ((q.x - p.x) / l) * r} ${p.y + ((q.y - p.y) / l) * r}`;
  };
  let d = `M${points[0].x} ${points[0].y}`;
  for (let k = 1; k < points.length - 1; k++) {
    const p = points[k];
    // A corner takes no more than half of the line on either side of it.
    const r = Math.min(radius, length(points[k - 1], p) / 2, length(p, points[k + 1]) / 2);
    d += ` L${toward(p, points[k - 1], r)} Q${p.x} ${p.y} ${toward(p, points[k + 1], r)}`;
  }
  const last = points[points.length - 1];
  return points.length > 1 ? `${d} L${last.x} ${last.y}` : d;
}
