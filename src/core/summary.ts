import type { Table } from './model';
import { plural } from './plural';
import { countInferred, countRelations } from './relations';

/** How many indexes `tables` have between them, primary keys included. */
export function countIndexes(tables: readonly Table[]): number {
  return tables.reduce((n, t) => n + (t.indexes?.length ?? 0), 0);
}

/**
 * The counts of a schema as the design system writes them: `24 tables · 31 relationships · 18 indexes`.
 * Relationships that were inferred are counted apart as well: `31 relationships (7 inferred)`.
 */
export function summarize(tables: readonly Table[]): string {
  const inferred = countInferred(tables);
  return [
    plural(tables.length, 'table'),
    `${plural(countRelations(tables), 'relationship')}${inferred ? ` (${inferred} inferred)` : ''}`,
    plural(countIndexes(tables), 'index', 'indexes'),
  ].join(' · ');
}
