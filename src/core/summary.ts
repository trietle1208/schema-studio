import type { Table } from './model';
import { t } from './i18n';
import { countInferred, countRelations } from './relations';

/** How many indexes `tables` have between them, primary keys included. */
export function countIndexes(tables: readonly Table[]): number {
  return tables.reduce((n, t) => n + (t.indexes?.length ?? 0), 0);
}

/** How many relationships there are, with how many of them were inferred when some were: `31 relationships (7 inferred)`. */
export function relationshipCount(relationships: number, inferred: number): string {
  const counted = t('count.relationships', { count: relationships });
  return inferred ? t('summary.inferred', { relationships: counted, count: inferred }) : counted;
}

/**
 * The counts of a schema as the design system writes them: `24 tables · 31 relationships · 18 indexes`.
 * Relationships that were inferred are counted apart as well: `31 relationships (7 inferred)`.
 */
export function summarize(tables: readonly Table[]): string {
  return [
    t('count.tables', { count: tables.length }),
    relationshipCount(countRelations(tables), countInferred(tables)),
    t('count.indexes', { count: countIndexes(tables) }),
  ].join(' · ');
}
