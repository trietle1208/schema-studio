import type { SchemaSnapshot, Table } from '../model';
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
