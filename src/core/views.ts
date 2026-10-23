import type { Table } from './model';
import type { Positions } from './model';
import { sameNames, shownList } from './explorer';
import { positionOf } from './positions';

/**
 * A saved view of the diagram: which tables it shows, and where those tables sit. The positions
 * belong to the view. The diagram's own positions stay as they are.
 */
export interface DiagramViewData {
  name: string;
  tables: string[];
  positions: Positions;
}

/** Why a view cannot be saved or renamed under this name. */
export type DiagramViewProblem = 'empty' | 'taken';

/**
 * `empty` when the name is blank. `taken` when another view of the list already has it, compared
 * as it is written. `exceptId` is the view being renamed, which may keep its name.
 */
export function diagramViewProblem(
  name: string,
  views: readonly { id?: number; name: string }[],
  exceptId?: number,
): DiagramViewProblem | null {
  const next = name.trim();
  if (!next) return 'empty';
  if (views.some((view) => view.name === next && view.id !== exceptId)) return 'taken';
  return null;
}

/** The placements of `names`, copied, so a later edit of the diagram does not change the view. */
export function pickPositions(positions: Positions, names: readonly string[]): Positions {
  const out: Positions = {};
  for (const name of names) {
    const place = positionOf(positions, name);
    if (place) out[name] = { ...place };
  }
  return out;
}

/**
 * The diagram with a view's placements laid over it. A table the view places uses that placement,
 * width included. The others stay where the diagram has them. Neither argument is changed.
 */
export function overlayPositions(base: Positions, extra: Positions): Positions {
  let next: Positions | null = null;
  for (const [name, place] of Object.entries(extra)) {
    if (!next) next = { ...base };
    next[name] = { ...place };
  }
  return next ?? base;
}

/**
 * Whether the canvas is showing this view: the same tables, in the order of the schema. A name
 * the schema no longer has is left out of both sides.
 */
export function viewIsShowing(tables: readonly Table[], viewTables: readonly string[], showing: readonly string[]): boolean {
  return sameNames(shownList(tables, viewTables), shownList(tables, showing));
}

/** ⌘1 is the first view. Past the ninth, or a number the list does not reach, is null. */
export function viewAt<T>(views: readonly T[], index: number): T | null {
  if (index < 1 || index > 9) return null;
  return views[index - 1] ?? null;
}

/**
 * Lines that end on a hub, dropped. `from` is the table the foreign key references (see
 * `computeEdges`). An empty set returns the same list.
 */
export function hideHubEdges<T extends { from: string }>(edges: readonly T[], hubs: ReadonlySet<string>): readonly T[] {
  if (hubs.size === 0) return edges;
  let dropped = false;
  const kept: T[] = [];
  for (const edge of edges) {
    if (hubs.has(edge.from)) dropped = true;
    else kept.push(edge);
  }
  return dropped ? kept : edges;
}
