import { describe, expect, it } from 'vitest';
import { filterSidebarSchemas, RECENT_LIMIT } from './sidebar';
import type { SchemaSummary } from './model';

function summary(name: string, favorite?: boolean): SchemaSummary {
  return { name, engine: 'PostgreSQL', tables: 1, version: 'v1', updated: '1h', favorite };
}

describe('filterSidebarSchemas', () => {
  const list = [summary('a'), summary('b', true), summary('c'), summary('d', true)];

  it('returns every schema for Schemas', () => {
    expect(filterSidebarSchemas(list, 'schemas').map((s) => s.name)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps only favorites, in the same order', () => {
    expect(filterSidebarSchemas(list, 'favorites').map((s) => s.name)).toEqual(['b', 'd']);
  });

  it('cuts Recent to the limit', () => {
    const many = Array.from({ length: RECENT_LIMIT + 3 }, (_, i) => summary(`s${i}`));
    expect(filterSidebarSchemas(many, 'recent')).toHaveLength(RECENT_LIMIT);
    expect(filterSidebarSchemas(many, 'recent')[0].name).toBe('s0');
  });
});
