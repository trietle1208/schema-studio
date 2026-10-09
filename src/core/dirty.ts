import { groupOf, groupsOf, sameGroups } from './groups';
import { nodeWidth } from './layout';
import type { Placement, SchemaSnapshot } from './model';
import { positionOf } from './positions';

function samePosition(a: Placement | undefined, b: Placement | undefined): boolean {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && nodeWidth(a) === nodeWidth(b));
}

function moved(current: SchemaSnapshot, saved: SchemaSnapshot, name: string): boolean {
  return !samePosition(positionOf(current.positions, name), positionOf(saved.positions, name));
}

/** Whether a table is in another group than it was, or in one that has another name or colour. */
function regrouped(current: SchemaSnapshot, saved: SchemaSnapshot, name: string): boolean {
  const now = groupOf(groupsOf(current), name);
  const before = groupOf(groupsOf(saved), name);
  return now?.name !== before?.name || now?.color !== before?.color;
}

/** Whether the two snapshots have their tables, positions and groups in common, as they do when nothing was edited. */
function identical(current: SchemaSnapshot, saved: SchemaSnapshot): boolean {
  return current.tables === saved.tables && current.positions === saved.positions && groupsOf(current) === groupsOf(saved);
}

/**
 * Names of the tables in `current` that differ from `saved`: new, edited, moved, resized or put in another group.
 * Tables are compared by identity, so undoing back to the saved snapshot reads as clean.
 */
export function dirtyTables(current: SchemaSnapshot, saved: SchemaSnapshot): string[] {
  if (identical(current, saved)) return [];
  const before = new Map(saved.tables.map((t) => [t.name, t]));
  return current.tables
    .filter((t) => before.get(t.name) !== t || moved(current, saved, t.name) || regrouped(current, saved, t.name))
    .map((t) => t.name);
}

/** Whether `current` has changes that `saved` does not, including deleted tables and changed groups. */
export function isDirty(current: SchemaSnapshot, saved: SchemaSnapshot): boolean {
  if (identical(current, saved)) return false;
  return (
    current.tables.length !== saved.tables.length ||
    current.tables.some((t, i) => saved.tables[i] !== t) ||
    current.tables.some((t) => moved(current, saved, t.name)) ||
    !sameGroups(groupsOf(current), groupsOf(saved))
  );
}
