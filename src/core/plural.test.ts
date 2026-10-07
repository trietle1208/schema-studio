import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import { plural } from './plural';

describe('plural', () => {
  it('adds "s" for every count but one', () => {
    expect(plural(1, 'column')).toBe('1 column');
    expect(plural(0, 'column')).toBe('0 columns');
    expect(plural(2, 'foreign key')).toBe('2 foreign keys');
  });

  it('uses the given plural when the noun is irregular', () => {
    expect(plural(1, 'index', 'indexes')).toBe('1 index');
    expect(plural(3, 'index', 'indexes')).toBe('3 indexes');
  });

  it('counts what the ecommerce sample holds', () => {
    const snapshot = ecommerceSnapshot();
    const orders = tableNamed(snapshot, 'orders');
    expect(plural(snapshot.tables.length, 'table')).toBe('5 tables');
    expect(plural(orders.columns.length, 'column')).toBe(`${orders.columns.length} columns`);
  });
});
