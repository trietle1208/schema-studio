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
          },
        ]
      : [],
  );
}

/** How many foreign keys `tables` declare between them. */
export function countRelations(tables: readonly Table[]): number {
  return tables.reduce((n, t) => n + outgoingRelations(t).length, 0);
}

/** The foreign keys in `tables` that reference `table`. A self-reference is both outgoing and incoming. */
export function incomingRelations(table: Table, tables: readonly Table[]): Relation[] {
  return tables.flatMap(outgoingRelations).filter((r) => r.to.table === table.name);
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

/** Points a column at `target`, keeping its ON DELETE action; null removes the foreign key. */
export function setReference(column: Column, target: ColumnRef | null): Column {
  if (!target) return { ...column, fk: null };
  return {
    ...column,
    fk: { table: target.table, column: target.column, onDelete: column.fk?.onDelete ?? DEFAULT_ON_DELETE },
  };
}

export function setOnDelete(column: Column, onDelete: OnDelete): Column {
  return column.fk ? { ...column, fk: { ...column.fk, onDelete } } : column;
}
