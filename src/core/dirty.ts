import type { Position, SchemaSnapshot } from './model';
import { positionOf } from './positions';

function samePosition(a: Position | undefined, b: Position | undefined): boolean {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y);
}

function moved(current: SchemaSnapshot, saved: SchemaSnapshot, name: string): boolean {
  return !samePosition(positionOf(current.positions, name), positionOf(saved.positions, name));
}

/**
 * Names of the tables in `current` that differ from `saved`: new, edited or moved.
 * Tables are compared by identity, so undoing back to the saved snapshot reads as clean.
 */
export function dirtyTables(current: SchemaSnapshot, saved: SchemaSnapshot): string[] {
  if (current.tables === saved.tables && current.positions === saved.positions) return [];
  const before = new Map(saved.tables.map((t) => [t.name, t]));
  return current.tables
    .filter((t) => before.get(t.name) !== t || moved(current, saved, t.name))
    .map((t) => t.name);
}

/** Whether `current` has changes that `saved` does not, including deleted tables. */
export function isDirty(current: SchemaSnapshot, saved: SchemaSnapshot): boolean {
  if (current.tables === saved.tables && current.positions === saved.positions) return false;
  return (
    current.tables.length !== saved.tables.length ||
    current.tables.some((t, i) => saved.tables[i] !== t) ||
    current.tables.some((t) => moved(current, saved, t.name))
  );
}
