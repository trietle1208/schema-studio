import type { SchemaSnapshot, Table } from '../model';
import { ecommercePositions, ecommerceTables } from './ecommerce';

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

export function tableNamed(snapshot: SchemaSnapshot, name: string): Table {
  const table = snapshot.tables.find((t) => t.name === name);
  if (!table) throw new Error(`No table "${name}" in the snapshot.`);
  return table;
}
