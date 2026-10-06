import type { Position, Positions } from './model';

/** The position stored for a table, ignoring keys inherited from Object.prototype (a table may be called `constructor`). */
export function positionOf(positions: Positions, name: string): Position | undefined {
  return Object.hasOwn(positions, name) ? positions[name] : undefined;
}
