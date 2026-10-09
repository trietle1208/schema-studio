import { t } from './i18n';
import type { Table } from './model';

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

/** Column errors keyed by column index. Each column reports its first problem only. */
export type ColumnErrors = Record<number, string>;

export function validateColumns(table: Table): ColumnErrors {
  const errors: ColumnErrors = {};
  const seen = new Set<string>();
  table.columns.forEach((c, i) => {
    if (!c.name || !c.name.trim()) errors[i] = t('validate.columnNameEmpty');
    else if (!IDENTIFIER.test(c.name)) errors[i] = t('validate.identifier');
    else if (seen.has(c.name)) errors[i] = t('validate.columnExists', { name: c.name, table: table.name });
    else if (!c.type) errors[i] = t('validate.typeMissing');
    seen.add(c.name);
  });
  return errors;
}

export interface Problem {
  table: string;
  /** Index of the invalid column in its table. */
  column: number;
  message: string;
}

/** Every column problem in the schema, in table and column order. */
export function findProblems(tables: readonly Table[]): Problem[] {
  return tables.flatMap((t) =>
    Object.entries(validateColumns(t)).map(([column, message]) => ({ table: t.name, column: Number(column), message })),
  );
}

/**
 * Returns the problem with a table name, or null when it is valid.
 * `otherNames` are the names of the other tables in the schema; when renaming, leave out the table's current name.
 */
export function validateTableName(name: string, otherNames: readonly string[] = []): string | null {
  if (!name || !name.trim()) return t('validate.tableNameEmpty');
  if (!IDENTIFIER.test(name)) return t('validate.identifier');
  if (otherNames.includes(name)) return t('validate.tableExists', { name });
  return null;
}

/** Returns the problem with a schema name, or null when it is valid. `otherNames` are the names already stored. */
export function validateSchemaName(name: string, otherNames: readonly string[] = []): string | null {
  if (!name || !name.trim()) return t('validate.schemaNameEmpty');
  if (!IDENTIFIER.test(name)) return t('validate.identifier');
  if (otherNames.includes(name)) return t('validate.schemaExists', { name });
  return null;
}
