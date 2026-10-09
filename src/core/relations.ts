import { referencingType } from './datatypes';
import { t } from './i18n';
import type { Column, OnDelete, Table } from './model';

export const ON_DELETE_ACTIONS: readonly OnDelete[] = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'];
export const DEFAULT_ON_DELETE: OnDelete = 'RESTRICT';

export interface ColumnRef {
  table: string;
  column: string;
}

/** A foreign key seen from either table: `from` is the foreign-key column, `to` the column it references. */
export interface Relation {
  from: ColumnRef;
  to: ColumnRef;
  onDelete: OnDelete;
  /** Set for a foreign key that was guessed from the names of the columns (see core/infer). */
  inferred?: true;
}

/** `orders.user_id`, as it is written in SQL and shown in the inspector. */
export function qualifiedName(ref: ColumnRef): string {
  return `${ref.table}.${ref.column}`;
}

/** The foreign keys declared on `table`. */
export function outgoingRelations(table: Table): Relation[] {
  return table.columns.flatMap((c) =>
    c.fk
      ? [
          {
            from: { table: table.name, column: c.name },
            to: { table: c.fk.table, column: c.fk.column },
            onDelete: c.fk.onDelete ?? DEFAULT_ON_DELETE,
            ...(c.fk.inferred ? { inferred: true as const } : {}),
          },
        ]
      : [],
  );
}

/** How many foreign keys `tables` have between them, the inferred ones included. */
export function countRelations(tables: readonly Table[]): number {
  return tables.reduce((n, t) => n + outgoingRelations(t).length, 0);
}

/** How many of the foreign keys of `tables` were inferred. */
export function countInferred(tables: readonly Table[]): number {
  return tables.reduce((n, t) => n + t.columns.filter((c) => c.fk?.inferred).length, 0);
}

/** The foreign keys in `tables` that reference `table`. A self-reference is both outgoing and incoming. */
export function incomingRelations(table: Table, tables: readonly Table[]): Relation[] {
  return tables.flatMap(outgoingRelations).filter((r) => r.to.table === table.name);
}

/**
 * The table called `name` and the tables one foreign key away from it, in either direction and
 * inferred ones included, in the order of `tables`. Empty when there is no such table.
 */
export function relatedTables(tables: readonly Table[], name: string): Table[] {
  const table = tables.find((t) => t.name === name);
  if (!table) return [];
  const related = new Set([name, ...outgoingRelations(table).map((r) => r.to.table)]);
  for (const r of incomingRelations(table, tables)) related.add(r.from.table);
  return tables.filter((t) => related.has(t.name));
}

/** The foreign keys that deleting `table` drops: those other tables hold on it. Its own go with it. */
export function droppedRelations(table: Table, tables: readonly Table[]): Relation[] {
  return incomingRelations(table, tables).filter((r) => r.from.table !== table.name);
}

/** The columns a foreign key on `table` can reference: the primary key of every other table. */
export function referenceTargets(table: Table, tables: readonly Table[]): ColumnRef[] {
  return tables.flatMap((t) => {
    const pk = t.name === table.name ? undefined : t.columns.find((c) => c.pk);
    return pk ? [{ table: t.name, column: pk.name }] : [];
  });
}

/** Points a column at `target`, keeping its ON DELETE action; null removes the foreign key. A reference that is chosen is no longer inferred. */
export function setReference(column: Column, target: ColumnRef | null): Column {
  if (!target) return { ...column, fk: null };
  return {
    ...column,
    fk: { table: target.table, column: target.column, onDelete: column.fk?.onDelete ?? DEFAULT_ON_DELETE },
  };
}

/** The columns of `table` a foreign key can be added to: those that have none, or only an inferred one. */
export function freeColumns(table: Table): Column[] {
  return table.columns.filter((c) => !c.fk || c.fk.inferred);
}

/** A table's name as one of its rows is called: `users` → `user`, `categories` → `category`. Only the last word may be a plural. */
function singular(name: string): string {
  if (/[^aeiou]ies$/i.test(name)) return `${name.slice(0, -3)}y`;
  if (/(?:ss|x|ch|sh)es$/i.test(name)) return name.slice(0, -2);
  if (/s$/i.test(name) && !/(?:ss|us|is)$/i.test(name)) return name.slice(0, -1);
  return name;
}

/**
 * What a new column that references `to` is called, the way relationships are inferred from names
 * (see core/infer): `user_id` for `users.id`. A key that is called after its table keeps its name:
 * `order_no` for `orders.order_no`.
 */
export function referenceColumnName(to: ColumnRef): string {
  const row = singular(to.table);
  return to.column.toLowerCase().startsWith(row.toLowerCase()) ? to.column : `${row}_${to.column}`;
}

/**
 * `tables` with a declared foreign key from the column `from` to the column `to`. A column the
 * table of `from` does not have yet is added to it, nullable and with the type that references
 * `to`; a column that has a foreign key gets this one in its place. `tables` themselves when
 * either table or the column `to` is missing, or when `from` has no name.
 */
export function addForeignKey(tables: Table[], from: ColumnRef, to: ColumnRef, onDelete: OnDelete = DEFAULT_ON_DELETE): Table[] {
  const target = tables.find((t) => t.name === to.table)?.columns.find((c) => c.name === to.column);
  if (!target || !from.column.trim() || !tables.some((t) => t.name === from.table)) return tables;
  const fk = { table: to.table, column: to.column, onDelete };
  return tables.map((t) => {
    if (t.name !== from.table) return t;
    if (!t.columns.some((c) => c.name === from.column)) {
      return { ...t, columns: [...t.columns, { name: from.column, type: referencingType(target.type), nullable: true, fk }] };
    }
    return { ...t, columns: t.columns.map((c) => (c.name === from.column ? { ...c, fk } : c)) };
  });
}

/**
 * Why a foreign key cannot be drawn from the column `from` to the column `to`, in the words the
 * canvas says it in while the line is dragged; null when it can be. A foreign key ends on a column
 * of another table that is its primary key or unique, which is what a database lets one reference.
 * A column that references `to` already has nothing to gain, unless that reference was inferred:
 * drawing it declares it.
 */
export function referenceProblem(tables: readonly Table[], from: ColumnRef, to: ColumnRef): string | null {
  const find = (ref: ColumnRef) => tables.find((t) => t.name === ref.table)?.columns.find((c) => c.name === ref.column);
  if (!from.column.trim()) return t('validate.columnNameEmpty');
  const column = find(from);
  if (!column) return t('validate.columnMissing', { name: from.column, table: from.table });
  if (from.table === to.table) return t('reference.sameTable');
  const target = find(to);
  if (!target) return t('validate.columnMissing', { name: to.column, table: to.table });
  if (!target.pk && !target.unique) return t('reference.notKey', { column: qualifiedName(to) });
  if (column.fk && !column.fk.inferred && column.fk.table === to.table && column.fk.column === to.column) {
    return t('reference.exists', { from: qualifiedName(from), to: qualifiedName(to) });
  }
  return null;
}

export function setOnDelete(column: Column, onDelete: OnDelete): Column {
  return column.fk ? { ...column, fk: { ...column.fk, onDelete } } : column;
}

/** Makes the inferred foreign key of a column one that is declared, so that it is written to the database. */
export function declareReference(column: Column): Column {
  if (!column.fk?.inferred) return column;
  const { table, column: referenced, onDelete } = column.fk;
  return { ...column, fk: { table, column: referenced, onDelete: onDelete ?? DEFAULT_ON_DELETE } };
}

/** The foreign keys of `tables` that were inferred, in the order of the tables and their columns. */
export function inferredRelations(tables: readonly Table[]): Relation[] {
  return tables.flatMap(outgoingRelations).filter((r) => r.inferred);
}

/**
 * `tables` with `edit` applied to every column that has an inferred foreign key, or to the column
 * `only` alone. A table without such a column is itself.
 */
function mapInferred(tables: readonly Table[], edit: (column: Column) => Column, only?: ColumnRef): Table[] {
  return tables.map((t) => {
    const meant = (c: Column) => !!c.fk?.inferred && (!only || (only.table === t.name && only.column === c.name));
    return t.columns.some(meant) ? { ...t, columns: t.columns.map((c) => (meant(c) ? edit(c) : c)) } : t;
  });
}

/**
 * `tables` with their inferred foreign keys as declared ones, for a script that is to create them.
 * With `only`, the foreign-key column of one of them, the others stay inferred.
 */
export function declareInferred(tables: readonly Table[], only?: ColumnRef): Table[] {
  return mapInferred(tables, declareReference, only);
}

/** `tables` without their inferred foreign keys, or without the one on the column `only`. */
export function removeInferred(tables: readonly Table[], only?: ColumnRef): Table[] {
  return mapInferred(tables, (c) => ({ ...c, fk: null }), only);
}
