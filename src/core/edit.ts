import { copyMember, renameMember } from './groups';
import { clampNodeWidth, LARGE_TABLE, lookOf, NODE_WIDTH, nodeWidth } from './layout';
import type { Column, ColumnsShown, Placement, Position, Positions, SchemaSnapshot, Table, TableGroup } from './model';
import { positionOf } from './positions';

// Every edit returns a new snapshot and leaves the input untouched. Tables that an edit does not
// change keep their identity, and an edit that cannot apply returns the snapshot it was given.

const DUPLICATE_OFFSET = 32;

/** `x`, `y` with the width and the columns shown of `like`, when it has any. */
function placed(x: number, y: number, like: Placement | undefined): Placement {
  return lookOf({ x, y }, like);
}

/** A snapshot of `tables` and `positions` with the groups of `snapshot`, or with `groups` in their place. One that has no groups gets none. */
function edited(
  snapshot: SchemaSnapshot,
  tables: Table[],
  positions: Positions,
  groups: readonly TableGroup[] | undefined = snapshot.groups,
): SchemaSnapshot {
  return groups ? { tables, positions, groups } : { tables, positions };
}

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
  return edited(snapshot, tables, snapshot.positions);
}

/** Renames a table and repoints every foreign key that references it. It stays in its group. */
export function renameTable(snapshot: SchemaSnapshot, from: string, to: string): SchemaSnapshot {
  if (from === to) return snapshot;
  if (!snapshot.tables.some((t) => t.name === from) || snapshot.tables.some((t) => t.name === to)) return snapshot;
  const tables = snapshot.tables.map((t) => {
    const renamed = t.name === from ? { ...t, name: to } : t;
    return mapColumns(renamed, (c) => (c.fk?.table === from ? { ...c, fk: { ...c.fk, table: to } } : c));
  });
  const positions = Object.fromEntries(Object.entries(snapshot.positions).map(([key, p]) => [key === from ? to : key, p]));
  return edited(snapshot, tables, positions, snapshot.groups && renameMember(snapshot.groups, from, to));
}

/** The name a copy of `name` gets: `orders_copy`, then `orders_copy2`, `orders_copy3`… */
export function copyName(tables: readonly Table[], name: string): string {
  const taken = new Set(tables.map((t) => t.name));
  let candidate = `${name}_copy`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name}_copy${n}`;
  return candidate;
}

/** Appends a copy of a table, without its foreign keys and indexes, placed just off the original, as wide as it and in its group. */
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
  return edited(
    snapshot,
    [...snapshot.tables, copy],
    { ...snapshot.positions, [newName]: placed(origin.x + DUPLICATE_OFFSET, origin.y + DUPLICATE_OFFSET, origin) },
    snapshot.groups && copyMember(snapshot.groups, name, newName),
  );
}

/** The name a new table gets: `new_table`, then `new_table2`, `new_table3`… */
export function newTableName(tables: readonly Table[]): string {
  const taken = new Set(tables.map((t) => t.name));
  let candidate = 'new_table';
  for (let n = 2; taken.has(candidate); n++) candidate = `new_table${n}`;
  return candidate;
}

/** What a new table starts as: an `id` primary key, to be renamed and filled in. */
export function newTable(name: string): Table {
  return { name, columns: [{ name: 'id', type: 'BIGSERIAL', nullable: false, pk: true }], indexes: [] };
}

/** Appends `table`, placed at `position` on the canvas. */
export function addTable(snapshot: SchemaSnapshot, table: Table, position: Position): SchemaSnapshot {
  if (snapshot.tables.some((t) => t.name === table.name)) return snapshot;
  return edited(snapshot, [...snapshot.tables, table], { ...snapshot.positions, [table.name]: { x: position.x, y: position.y } });
}

/** Removes a table, from its group too, and drops every foreign key that references it. */
export function deleteTable(snapshot: SchemaSnapshot, name: string): SchemaSnapshot {
  if (!snapshot.tables.some((t) => t.name === name)) return snapshot;
  const tables = snapshot.tables
    .filter((t) => t.name !== name)
    .map((t) => mapColumns(t, (c) => (c.fk?.table === name ? { ...c, fk: null } : c)));
  const positions = { ...snapshot.positions };
  delete positions[name];
  return edited(snapshot, tables, positions, snapshot.groups && renameMember(snapshot.groups, name, null));
}

/** Places a table at `position` on the canvas. */
export function moveTable(snapshot: SchemaSnapshot, name: string, position: Position): SchemaSnapshot {
  return moveTables(snapshot, { [name]: position });
}

/** Places each table named in `moves` at its position there, as when several are dragged together. A table stays as wide as it is. */
export function moveTables(snapshot: SchemaSnapshot, moves: Positions): SchemaSnapshot {
  const known = new Set(snapshot.tables.map((t) => t.name));
  const moved = Object.entries(moves).filter(([name, to]) => {
    const from = positionOf(snapshot.positions, name);
    return known.has(name) && (!from || from.x !== to.x || from.y !== to.y);
  });
  if (!moved.length) return snapshot;
  const next = Object.fromEntries(moved.map(([name, to]) => [name, placed(to.x, to.y, positionOf(snapshot.positions, name))]));
  return edited(snapshot, snapshot.tables, { ...snapshot.positions, ...next });
}

/**
 * Makes each table named in `sizes` as wide as it is there, and puts it where it is there: a table
 * whose left side was dragged has moved with it (see `widened` in core/layout). A table that has
 * no place on the canvas is left out.
 */
export function resizeTables(snapshot: SchemaSnapshot, sizes: Positions): SchemaSnapshot {
  const known = new Set(snapshot.tables.map((t) => t.name));
  const resized = Object.entries(sizes).filter(([name, to]) => {
    const from = positionOf(snapshot.positions, name);
    return known.has(name) && !!from && (from.x !== to.x || from.y !== to.y || nodeWidth(from) !== nodeWidth(to));
  });
  if (!resized.length) return snapshot;
  const next = Object.fromEntries(
    resized.map(([name, to]): [string, Placement] => {
      const w = clampNodeWidth(nodeWidth(to));
      // The columns a table shows are not changed by its width.
      const look = lookOf({ x: to.x, y: to.y }, { ...positionOf(snapshot.positions, name), x: 0, y: 0, w: w === NODE_WIDTH ? undefined : w });
      return [name, look];
    }),
  );
  return edited(snapshot, snapshot.tables, { ...snapshot.positions, ...next });
}

/** What the tables of a schema show of their columns: every column, the keys only, none, or the keys only for tables that have more than `LARGE_TABLE` columns. */
export type ColumnsChoice = 'all' | ColumnsShown | 'large';

/**
 * Makes the tables called `names` (all of them when `names` is left out) show their columns as
 * `choice` says. `large` shows the keys of a table that has more than `LARGE_TABLE` columns and
 * every column of the others. A table that has no place on the canvas is left out, and a snapshot
 * in which nothing changes is returned as it is.
 */
export function showColumns(snapshot: SchemaSnapshot, choice: ColumnsChoice, names?: readonly string[]): SchemaSnapshot {
  const wanted = names ? new Set(names) : null;
  const next: Positions = {};
  for (const table of snapshot.tables) {
    const from = positionOf(snapshot.positions, table.name);
    if (!from || (wanted && !wanted.has(table.name))) continue;
    const shown = choice === 'large' ? (table.columns.length > LARGE_TABLE ? 'keys' : 'all') : choice;
    if ((from.cols ?? 'all') === shown) continue;
    const rest: Placement = { x: from.x, y: from.y, ...(from.w === undefined ? {} : { w: from.w }) };
    next[table.name] = shown === 'all' ? rest : { ...rest, cols: shown };
  }
  if (!Object.keys(next).length) return snapshot;
  return edited(snapshot, snapshot.tables, { ...snapshot.positions, ...next });
}
