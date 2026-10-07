import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot } from './fixtures/testing';
import { searchTables } from './search';

const found = (query: string) => searchTables(ecommerceSnapshot().tables, query).map((t) => t.name);

describe('searchTables', () => {
  it('returns the tables as given for a blank query', () => {
    const { tables } = ecommerceSnapshot();
    expect(searchTables(tables, '')).toBe(tables);
    expect(searchTables(tables, '   ')).toBe(tables);
  });

  it('matches part of a table name', () => {
    expect(found('pay')).toEqual(['payments']);
    expect(found('order')).toEqual(['orders', 'order_items', 'payments']);
  });

  it('matches a column name', () => {
    expect(found('sku')).toEqual(['products']);
    expect(found('user_id')).toEqual(['orders']);
    expect(found('created_at')).toEqual(['users', 'orders']);
  });

  it('ignores case and surrounding spaces', () => {
    expect(found('  USERS ')).toEqual(['users']);
    expect(found('Avatar_URL')).toEqual(['users']);
  });

  it('returns nothing when no table matches', () => {
    expect(found('invoice')).toEqual([]);
  });
});
