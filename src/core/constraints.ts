import type { Index, Table } from './model';
import { outgoingRelations, type Relation } from './relations';

// What a table comes to in a database. The flags of a column say what its constraints are;
// `indexes` gives them their names. So a primary-key or unique index that no longer matches the
// columns' flags does not count, and neither does a foreign key to a column that is not there.

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name) => b.includes(name));
}

export interface PrimaryKey {
  name: string;
  columns: string[];
  /** A key of one column with the name the database would give it, so it can be written on the column. */
  inline: boolean;
}

/** The primary key the columns' flags describe, named and ordered by the table's primary-key index when that still fits. */
export function primaryKey(table: Table): PrimaryKey | null {
  const flagged = table.columns.filter((c) => c.pk).map((c) => c.name);
  if (!flagged.length) return null;
  const index = table.indexes?.find((i) => i.type === 'PRIMARY KEY' && sameNames(i.columns, flagged));
  const fallback = `${table.name}_pkey`;
  const name = index?.name ?? fallback;
  return { columns: index?.columns ?? flagged, name, inline: flagged.length === 1 && name === fallback };
}

/**
 * The indexes of a table that are written as CREATE INDEX, and the reason for each one that cannot
 * be. The primary key is a constraint, not one of them.
 */
export function writtenIndexes(table: Table): { indexes: Index[]; left: string[] } {
  const columns = new Map(table.columns.map((c) => [c.name, c]));
  const indexes: Index[] = [];
  const left: string[] = [];
  for (const index of table.indexes ?? []) {
    if (index.type === 'PRIMARY KEY') continue;
    const missing = index.columns.find((name) => !columns.has(name));
    // A unique index on one column goes with that column's flag: without the flag it is not written.
    const dropped = index.type === 'UNIQUE' && index.columns.length === 1 && !columns.get(index.columns[0])?.unique;
    if (missing !== undefined) left.push(`Index ${index.name} was left out: column ${missing} does not exist in ${table.name}.`);
    else if (!index.columns.length) left.push(`Index ${index.name} was left out: it has no columns.`);
    else if (!dropped) indexes.push(index);
  }
  return { indexes, left };
}

/** The unique columns that no index of `indexes` makes unique: their constraint is written on the column. */
export function uniqueColumns(table: Table, indexes: readonly Index[] = writtenIndexes(table).indexes): string[] {
  const indexed = new Set(indexes.filter((i) => i.type === 'UNIQUE' && i.columns.length === 1).map((i) => i.columns[0]));
  return table.columns.filter((c) => c.unique && !c.pk && !indexed.has(c.name)).map((c) => c.name);
}

/** The foreign keys of `tables` whose referenced column exists, so that they can be written. */
export function writtenRelations(tables: readonly Table[]): Relation[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  return tables
    .flatMap(outgoingRelations)
    .filter((r) => byName.get(r.to.table)?.columns.some((c) => c.name === r.to.column));
}
