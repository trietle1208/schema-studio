import { describe, expect, it } from 'vitest';
import { ecommerceSql } from '../fixtures/sql';
import { IMPORT_ENGINES, parserFor } from './index';

describe('parserFor', () => {
  it('gives the PostgreSQL parser', () => {
    const parser = parserFor('PostgreSQL');
    expect(parser?.engine).toBe('PostgreSQL');
    const outcome = parser?.parse(ecommerceSql);
    expect(outcome?.ok && outcome.tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'order_items', 'payments']);
  });

  it('has no parser for the engines that cannot be imported yet', () => {
    expect(parserFor('MySQL')).toBeNull();
    expect(parserFor('postgresql')).toBeNull();
    expect(IMPORT_ENGINES).toEqual(['PostgreSQL']);
  });
});
