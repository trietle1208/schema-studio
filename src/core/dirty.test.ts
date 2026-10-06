import { describe, expect, it } from 'vitest';
import { dirtyTables, isDirty } from './dirty';
import { deleteTable, duplicateTable, moveTable, renameTable, updateTable } from './edit';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';

describe('isDirty and dirtyTables', () => {
  it('reads the saved snapshot as clean', () => {
    const saved = ecommerceSnapshot();
    expect(isDirty(saved, saved)).toBe(false);
    expect(dirtyTables(saved, saved)).toEqual([]);
  });

  it('marks an edited table', () => {
    const saved = ecommerceSnapshot();
    const orders = tableNamed(saved, 'orders');
    const current = updateTable(saved, 'orders', { ...orders, comment: 'One row per checkout.' });
    expect(isDirty(current, saved)).toBe(true);
    expect(dirtyTables(current, saved)).toEqual(['orders']);
  });

  it('marks a moved table, and clears it when the table is put back', () => {
    const saved = ecommerceSnapshot();
    const moved = moveTable(saved, 'payments', { x: 40, y: 352 });
    expect(isDirty(moved, saved)).toBe(true);
    expect(dirtyTables(moved, saved)).toEqual(['payments']);

    const back = moveTable(moved, 'payments', { x: 24, y: 336 });
    expect(back.positions).not.toBe(saved.positions);
    expect(isDirty(back, saved)).toBe(false);
    expect(dirtyTables(back, saved)).toEqual([]);
  });

  it('marks a renamed table and every table whose foreign key followed it', () => {
    const saved = ecommerceSnapshot();
    const current = renameTable(saved, 'orders', 'purchases');
    expect(isDirty(current, saved)).toBe(true);
    expect(dirtyTables(current, saved)).toEqual(['purchases', 'order_items', 'payments']);
  });

  it('marks a duplicated table', () => {
    const saved = ecommerceSnapshot();
    const current = duplicateTable(saved, 'products');
    expect(isDirty(current, saved)).toBe(true);
    expect(dirtyTables(current, saved)).toEqual(['products_copy']);
  });

  it('is dirty after deleting a table nothing references, with no table to mark', () => {
    const saved = ecommerceSnapshot();
    const current = deleteTable(saved, 'payments');
    expect(isDirty(current, saved)).toBe(true);
    expect(dirtyTables(current, saved)).toEqual([]);
  });

  it('marks the tables that lost a foreign key to a deleted table', () => {
    const saved = ecommerceSnapshot();
    const current = deleteTable(saved, 'products');
    expect(dirtyTables(current, saved)).toEqual(['order_items']);
  });
});
