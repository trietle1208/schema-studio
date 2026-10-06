import type { Table } from './model';

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

const INVALID_IDENTIFIER = 'Use letters, digits and underscores; start with a letter.';

/** Column errors keyed by column index. Each column reports its first problem only. */
export type ColumnErrors = Record<number, string>;

export function validateColumns(table: Table): ColumnErrors {
  const errors: ColumnErrors = {};
  const seen = new Set<string>();
  table.columns.forEach((c, i) => {
    if (!c.name || !c.name.trim()) errors[i] = 'Column name cannot be empty.';
    else if (!IDENTIFIER.test(c.name)) errors[i] = INVALID_IDENTIFIER;
    else if (seen.has(c.name)) errors[i] = `Column "${c.name}" already exists in ${table.name}.`;
    else if (!c.type) errors[i] = 'Choose a data type.';
    seen.add(c.name);
  });
  return errors;
}

/**
 * Returns the problem with a table name, or null when it is valid.
 * `otherNames` are the names of the other tables in the schema; when renaming, leave out the table's current name.
 */
export function validateTableName(name: string, otherNames: readonly string[] = []): string | null {
  if (!name || !name.trim()) return 'Table name cannot be empty.';
  if (!IDENTIFIER.test(name)) return INVALID_IDENTIFIER;
  if (otherNames.includes(name)) return `Table "${name}" already exists.`;
  return null;
}
