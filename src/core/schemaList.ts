/** The database engines a schema can be for, in the order the list filters by them. */
export const ENGINES: readonly string[] = ['PostgreSQL', 'MySQL', 'ClickHouse', 'SQLite'];

/** What the schema list needs to know about a schema. */
export interface SchemaListItem {
  name: string;
  description?: string;
  engine: string;
  tables: number;
  relationships: number;
  version: number;
  /** Milliseconds since the epoch. */
  updatedAt: number;
}

export type SchemaSortKey = 'name' | 'engine' | 'tables' | 'relationships' | 'version' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface SchemaSort {
  key: SchemaSortKey;
  dir: SortDirection;
}

/** The schema saved last comes first. */
export const DEFAULT_SCHEMA_SORT: SchemaSort = { key: 'updatedAt', dir: 'desc' };

/** The direction a sort starts in: text from A to Z, numbers and times from the largest or latest. */
export function initialSortDirection(key: SchemaSortKey): SortDirection {
  return key === 'name' || key === 'engine' ? 'asc' : 'desc';
}

/**
 * The schemas for `engine` whose name or description contains `query`, ignoring case.
 * A blank query matches every schema, and so does leaving out the engine.
 */
export function filterSchemas<T extends SchemaListItem>(schemas: readonly T[], query: string, engine?: string): T[] {
  const needle = query.trim().toLowerCase();
  return schemas.filter(
    (s) =>
      (engine === undefined || s.engine === engine) &&
      (!needle || s.name.toLowerCase().includes(needle) || !!s.description?.toLowerCase().includes(needle)),
  );
}

function compare(a: string | number, b: string | number): number {
  return typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : a < b ? -1 : a > b ? 1 : 0;
}

/** A sorted copy of `schemas`. Schemas that are equal under the sort are listed by name. */
export function sortSchemas<T extends SchemaListItem>(schemas: readonly T[], sort: SchemaSort): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return schemas.slice().sort((a, b) => sign * compare(a[sort.key], b[sort.key]) || compare(a.name, b.name));
}

/**
 * The item `step` places after `current` in `items`, stopping at either end. With nothing selected,
 * or a selection that is no longer listed, stepping forward gives the first item and back the last.
 */
export function stepSelection<T>(items: readonly T[], current: T | null, step: 1 | -1): T | null {
  if (!items.length) return null;
  const index = current === null ? -1 : items.indexOf(current);
  if (index < 0) return step > 0 ? items[0] : items[items.length - 1];
  return items[Math.min(items.length - 1, Math.max(0, index + step))];
}
