import type { Column, Table } from './model';

// Column edits on one table. Like the edits in edit.ts they never mutate their input, and an edit
// that cannot apply returns the value it was given.

/** The blank column "Add column" appends. It is invalid until it gets a name. */
export function draftColumn(): Column {
  return { name: '', type: 'TEXT', nullable: true, draft: true };
}

export function addColumn(table: Table, column: Column = draftColumn()): Table {
  return { ...table, columns: [...table.columns, column] };
}

export function setColumn(table: Table, index: number, column: Column): Table {
  if (!(index in table.columns) || table.columns[index] === column) return table;
  const columns = table.columns.slice();
  columns[index] = column;
  return { ...table, columns };
}

export function removeColumn(table: Table, index: number): Table {
  if (!(index in table.columns)) return table;
  return { ...table, columns: table.columns.filter((_, i) => i !== index) };
}

/** A primary key is always NOT NULL; taking the key away leaves the column NOT NULL. */
export function setPrimaryKey(column: Column, pk: boolean): Column {
  return { ...column, pk, nullable: pk ? false : column.nullable };
}

/** Primary-key columns stay NOT NULL. */
export function setNullable(column: Column, nullable: boolean): Column {
  return column.pk ? column : { ...column, nullable };
}

/** Drops the draft mark from every column, once the schema is saved. Tables without drafts keep their identity. */
export function clearDrafts(tables: Table[]): Table[] {
  if (!tables.some((t) => t.columns.some((c) => c.draft))) return tables;
  return tables.map((t) =>
    t.columns.some((c) => c.draft)
      ? {
          ...t,
          columns: t.columns.map((c) => {
            if (!c.draft) return c;
            const column = { ...c };
            delete column.draft;
            return column;
          }),
        }
      : t,
  );
}
