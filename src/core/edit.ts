import type { Column, Position, SchemaSnapshot, Table } from './model';
import { positionOf } from './positions';

// Every edit returns a new snapshot and leaves the input untouched. Tables that an edit does not
// change keep their identity, and an edit that cannot apply returns the snapshot it was given.

const DUPLICATE_OFFSET = 32;

function mapColumns(table: Table, edit: (column: Column) => Column): Table {
  let changed = false;
  const columns = table.columns.map((c) => {
    const next = edit(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...table, columns } : table;
}

/** Replaces the table called `name` with `table`. The name itself must not change; use `renameTable` for that. */
export function updateTable(snapshot: SchemaSnapshot, name: string, table: Table): SchemaSnapshot {
  const index = snapshot.tables.findIndex((t) => t.name === name);
  if (index < 0 || table.name !== name || snapshot.tables[index] === table) return snapshot;
  const tables = snapshot.tables.slice();
  tables[index] = table;
  return { tables, positions: snapshot.positions };
}

/** Renames a table and repoints every foreign key that references it. */
export function renameTable(snapshot: SchemaSnapshot, from: string, to: string): SchemaSnapshot {
  if (from === to) return snapshot;
  if (!snapshot.tables.some((t) => t.name === from) || snapshot.tables.some((t) => t.name === to)) return snapshot;
  const tables = snapshot.tables.map((t) => {
    const renamed = t.name === from ? { ...t, name: to } : t;
    return mapColumns(renamed, (c) => (c.fk?.table === from ? { ...c, fk: { ...c.fk, table: to } } : c));
  });
  const positions = Object.fromEntries(Object.entries(snapshot.positions).map(([key, p]) => [key === from ? to : key, p]));
  return { tables, positions };
}

/** The name a copy of `name` gets: `orders_copy`, then `orders_copy2`, `orders_copy3`… */
export function copyName(tables: readonly Table[], name: string): string {
  const taken = new Set(tables.map((t) => t.name));
  let candidate = `${name}_copy`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name}_copy${n}`;
  return candidate;
}

/** Appends a copy of a table, without its foreign keys and indexes, placed just off the original. */
export function duplicateTable(
  snapshot: SchemaSnapshot,
  name: string,
  newName: string = copyName(snapshot.tables, name),
): SchemaSnapshot {
  const source = snapshot.tables.find((t) => t.name === name);
  if (!source || snapshot.tables.some((t) => t.name === newName)) return snapshot;
  const copy: Table = {
    ...source,
    name: newName,
    columns: source.columns.map((c) => ({ ...c, fk: null })),
    indexes: [],
  };
  const origin = positionOf(snapshot.positions, name) ?? { x: 0, y: 0 };
  return {
    tables: [...snapshot.tables, copy],
    positions: { ...snapshot.positions, [newName]: { x: origin.x + DUPLICATE_OFFSET, y: origin.y + DUPLICATE_OFFSET } },
  };
}

/** Removes a table and drops every foreign key that references it. */
export function deleteTable(snapshot: SchemaSnapshot, name: string): SchemaSnapshot {
  if (!snapshot.tables.some((t) => t.name === name)) return snapshot;
  const tables = snapshot.tables
    .filter((t) => t.name !== name)
    .map((t) => mapColumns(t, (c) => (c.fk?.table === name ? { ...c, fk: null } : c)));
  const positions = { ...snapshot.positions };
  delete positions[name];
  return { tables, positions };
}

/** Places a table at `position` on the canvas. */
export function moveTable(snapshot: SchemaSnapshot, name: string, position: Position): SchemaSnapshot {
  if (!snapshot.tables.some((t) => t.name === name)) return snapshot;
  const current = positionOf(snapshot.positions, name);
  if (current && current.x === position.x && current.y === position.y) return snapshot;
  return { tables: snapshot.tables, positions: { ...snapshot.positions, [name]: { x: position.x, y: position.y } } };
}
