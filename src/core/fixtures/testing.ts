import { computeEdges, nodeRects } from '../layout';
import type { Positions, SchemaSnapshot, Table } from '../model';
import { curveBlocked } from '../route';
import { ecommercePositions, ecommerceTables } from './ecommerce';
import { ecommercePreviousPositions, ecommercePreviousTables } from './versions';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** A frozen copy of the ecommerce sample, so a test fails if an edit mutates its input. */
export function ecommerceSnapshot(): SchemaSnapshot {
  return deepFreeze(structuredClone({ tables: ecommerceTables, positions: ecommercePositions }));
}

/**
 * The tables of the sample as a database that declares no foreign keys has them once they are
 * inferred: the same four relationships, each marked as inferred. Frozen like the sample.
 */
export function inferredTables(): Table[] {
  return deepFreeze(
    ecommerceTables.map((t) => ({
      ...t,
      columns: t.columns.map((c) => (c.fk ? { ...c, fk: { table: c.fk.table, column: c.fk.column, inferred: true } } : { ...c })),
    })),
  );
}

/** A frozen copy of the version before the sample (see fixtures/versions). */
export function previousSnapshot(): SchemaSnapshot {
  return deepFreeze(structuredClone({ tables: ecommercePreviousTables, positions: ecommercePreviousPositions }));
}

/** A copy of `tables` with `edit` applied to the table called `name`. */
export function withTable(tables: readonly Table[], name: string, edit: (table: Table) => Table): Table[] {
  if (!tables.some((t) => t.name === name)) throw new Error(`No table "${name}" to edit.`);
  return tables.map((t) => (t.name === name ? edit(t) : t));
}

/** A copy of `table` with `changes` made to the column called `name`. */
export function withColumn(table: Table, name: string, changes: Partial<Table['columns'][number]>): Table {
  if (!table.columns.some((c) => c.name === name)) throw new Error(`No column "${name}" in ${table.name}.`);
  return { ...table, columns: table.columns.map((c) => (c.name === name ? { ...c, ...changes } : c)) };
}

export function tableNamed(snapshot: SchemaSnapshot, name: string): Table {
  const table = snapshot.tables.find((t) => t.name === name);
  if (!table) throw new Error(`No table "${name}" in the snapshot.`);
  return table;
}

/**
 * The ids of the relationship lines that run behind a table as they are drawn: a curve that does,
 * or a line around the tables one of whose stretches does.
 */
export function linesBehind(tables: readonly Table[], positions: Positions): string[] {
  const rects = nodeRects(tables, positions);
  const through = (x1: number, y1: number, x2: number, y2: number) =>
    rects.some((r) => Math.max(x1, x2) > r.x && Math.min(x1, x2) < r.x + r.w && Math.max(y1, y2) > r.y && Math.min(y1, y2) < r.y + r.h);
  return computeEdges(tables, positions)
    .filter((e) => (e.via ? e.via.some((p, k) => k > 0 && through(e.via![k - 1].x, e.via![k - 1].y, p.x, p.y)) : curveBlocked(e.a, e.b, rects)))
    .map((e) => e.id);
}
