import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, inferredTables } from './fixtures/testing';
import { countIndexes, summarize } from './summary';

describe('countIndexes', () => {
  it('counts every index of every table, primary keys included', () => {
    expect(countIndexes(ecommerceSnapshot().tables)).toBe(11);
  });

  it('counts none for a table without indexes', () => {
    expect(countIndexes([{ name: 'notes', columns: [] }])).toBe(0);
  });
});

describe('summarize', () => {
  it('joins the counts of the ecommerce sample with middle dots', () => {
    expect(summarize(ecommerceSnapshot().tables)).toBe('5 tables · 4 relationships · 11 indexes');
  });

  it('uses the singular for one of each', () => {
    const { tables } = ecommerceSnapshot();
    const payments = tables.filter((t) => t.name === 'payments');
    expect(summarize(payments)).toBe('1 table · 1 relationship · 1 index');
    expect(summarize([])).toBe('0 tables · 0 relationships · 0 indexes');
  });

  it('says how many of the relationships were inferred', () => {
    expect(summarize(inferredTables())).toBe('5 tables · 4 relationships (4 inferred) · 11 indexes');
    const mixed = [...ecommerceSnapshot().tables.slice(0, 2), ...inferredTables().slice(2)];
    expect(summarize(mixed)).toBe('5 tables · 4 relationships (3 inferred) · 11 indexes');
  });
});
