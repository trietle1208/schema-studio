import type { SchemaSummary } from './model';

export type SidebarNav = 'schemas' | 'recent' | 'favorites';

/** How many schemas the Recent view keeps. */
export const RECENT_LIMIT = 8;

/**
 * The schemas a sidebar nav shows. `schemas` is already newest-first. Favorites keep that order;
 * Recent is the same list cut to `RECENT_LIMIT`.
 */
export function filterSidebarSchemas(schemas: readonly SchemaSummary[], nav: SidebarNav): SchemaSummary[] {
  if (nav === 'favorites') return schemas.filter((s) => s.favorite);
  if (nav === 'recent') return schemas.slice(0, RECENT_LIMIT);
  return [...schemas];
}
