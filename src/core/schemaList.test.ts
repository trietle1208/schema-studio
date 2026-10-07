import { describe, expect, it } from 'vitest';
import {
  filterSchemas,
  initialSortDirection,
  sortSchemas,
  stepSelection,
  type SchemaListItem,
} from './schemaList';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 6, 8, 14).getTime();

// The schemas of the prototype's list screen (design-system/components/bundle.js, `sample.schemas`).
const schemas: SchemaListItem[] = [
  { name: 'ecommerce', description: 'Orders, catalogue, payments', engine: 'PostgreSQL', tables: 24, relationships: 31, version: 12, updatedAt: NOW - 2 * HOUR },
  { name: 'blog', description: 'Posts, authors, comments, tags', engine: 'PostgreSQL', tables: 12, relationships: 14, version: 4, updatedAt: NOW - DAY },
  { name: 'analytics', description: 'Event ingestion and daily rollups', engine: 'ClickHouse', tables: 18, relationships: 6, version: 8, updatedAt: NOW - 3 * DAY },
  { name: 'inventory', description: 'Warehouses and stock movements', engine: 'MySQL', tables: 15, relationships: 19, version: 6, updatedAt: NOW - 7 * DAY },
  { name: 'billing', engine: 'PostgreSQL', tables: 9, relationships: 11, version: 3, updatedAt: NOW - 14 * DAY },
  { name: 'auth_service', description: 'Sessions and refresh tokens', engine: 'SQLite', tables: 6, relationships: 5, version: 2, updatedAt: NOW - 39 * DAY },
];
const names = (list: SchemaListItem[]) => list.map((s) => s.name);

describe('filterSchemas', () => {
  it('returns every schema for a blank query and no engine', () => {
    expect(filterSchemas(schemas, '')).toEqual(schemas);
    expect(filterSchemas(schemas, '   ')).toEqual(schemas);
  });

  it('matches the name or the description, ignoring case', () => {
    expect(names(filterSchemas(schemas, 'ING'))).toEqual(['analytics', 'billing']);
    expect(names(filterSchemas(schemas, 'tokens'))).toEqual(['auth_service']);
    expect(names(filterSchemas(schemas, ' Orders '))).toEqual(['ecommerce']);
    expect(filterSchemas(schemas, 'warehouse_x')).toEqual([]);
  });

  it('keeps the schemas of one engine', () => {
    expect(names(filterSchemas(schemas, '', 'PostgreSQL'))).toEqual(['ecommerce', 'blog', 'billing']);
    expect(names(filterSchemas(schemas, 'b', 'PostgreSQL'))).toEqual(['blog', 'billing']);
    expect(filterSchemas(schemas, '', 'SQL Server')).toEqual([]);
  });
});

describe('sortSchemas', () => {
  it('lists the schema saved last first by default', () => {
    const shuffled = [schemas[3], schemas[0], schemas[5], schemas[2], schemas[1], schemas[4]];
    expect(names(sortSchemas(shuffled, { key: 'updatedAt', dir: 'desc' }))).toEqual(names(schemas));
    expect(names(sortSchemas(shuffled, { key: 'updatedAt', dir: 'asc' }))).toEqual(names(schemas).reverse());
  });

  it('sorts by name, table count, relationships and version', () => {
    expect(names(sortSchemas(schemas, { key: 'name', dir: 'asc' }))).toEqual([
      'analytics',
      'auth_service',
      'billing',
      'blog',
      'ecommerce',
      'inventory',
    ]);
    expect(names(sortSchemas(schemas, { key: 'tables', dir: 'desc' }))[0]).toBe('ecommerce');
    expect(names(sortSchemas(schemas, { key: 'relationships', dir: 'asc' }))[0]).toBe('auth_service');
    // Numbers, not text: v12 is after v8.
    expect(sortSchemas(schemas, { key: 'version', dir: 'desc' }).map((s) => s.version)).toEqual([12, 8, 6, 4, 3, 2]);
  });

  it('lists schemas that are equal under the sort by name, in either direction', () => {
    const byEngine = ['analytics', 'inventory', 'billing', 'blog', 'ecommerce', 'auth_service'];
    expect(names(sortSchemas(schemas, { key: 'engine', dir: 'asc' }))).toEqual(byEngine);
    expect(names(sortSchemas(schemas, { key: 'engine', dir: 'desc' }))).toEqual([
      'auth_service',
      'billing',
      'blog',
      'ecommerce',
      'inventory',
      'analytics',
    ]);
  });

  it('leaves the list it was given as it is', () => {
    const before = names(schemas);
    sortSchemas(schemas, { key: 'name', dir: 'asc' });
    expect(names(schemas)).toEqual(before);
  });
});

describe('initialSortDirection', () => {
  it('starts text at A and numbers and times at the top', () => {
    expect(initialSortDirection('name')).toBe('asc');
    expect(initialSortDirection('engine')).toBe('asc');
    expect(initialSortDirection('tables')).toBe('desc');
    expect(initialSortDirection('version')).toBe('desc');
    expect(initialSortDirection('updatedAt')).toBe('desc');
  });
});

describe('stepSelection', () => {
  const list = names(schemas);

  it('moves one item and stops at the ends', () => {
    expect(stepSelection(list, 'blog', 1)).toBe('analytics');
    expect(stepSelection(list, 'blog', -1)).toBe('ecommerce');
    expect(stepSelection(list, 'ecommerce', -1)).toBe('ecommerce');
    expect(stepSelection(list, 'auth_service', 1)).toBe('auth_service');
  });

  it('starts from the near end when nothing in the list is selected', () => {
    expect(stepSelection(list, null, 1)).toBe('ecommerce');
    expect(stepSelection(list, null, -1)).toBe('auth_service');
    expect(stepSelection(list, 'filtered_out', 1)).toBe('ecommerce');
  });

  it('selects nothing in an empty list', () => {
    expect(stepSelection([], 'blog', 1)).toBeNull();
  });
});
