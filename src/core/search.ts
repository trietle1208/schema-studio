import type { Table } from './model';

/**
 * The tables whose name, or one of whose column names, contains `query`, ignoring case.
 * A blank query returns the tables as given.
 */
export function searchTables(tables: Table[], query: string): Table[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return tables;
  return tables.filter(
    (t) => t.name.toLowerCase().includes(needle) || t.columns.some((c) => c.name.toLowerCase().includes(needle)),
  );
}
