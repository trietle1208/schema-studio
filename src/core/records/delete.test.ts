import { describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import type { Column, Table } from '../model';
import { planDelete } from './delete';
import type { RecordData } from './fields';
import { seedRecords, type Row } from '.';

const data: RecordData = seedRecords(ecommerceTables, 1);
const col = (type: string, rest: Partial<Column> = {}): Column => ({ name: 'c', type, nullable: false, ...rest });
const node = (onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT', nullable = true): Table => ({
  name: 'node',
  columns: [col('INT', { name: 'id', pk: true }), col('INT', { name: 'parent_id', nullable, fk: { table: 'node', column: 'id', onDelete } })],
});
const rows: Row[] = [{ id: 1, parent_id: null }, { id: 2, parent_id: 1 }, { id: 3, parent_id: 2 }, { id: 4, parent_id: null }];

describe('planDelete', () => {
  it('takes along the rows of a CASCADE key, and the rows that point at those', () => {
    const order = data.orders[0];
    const items = data.order_items.filter((x) => x.order_id === order.id);
    const plan = planDelete(ecommerceTables, data, 'orders', [order]);
    expect(plan.effects.find((e) => e.table === 'order_items')).toEqual({ table: 'order_items', column: 'order_id', count: items.length, rule: 'CASCADE', blocked: false });
    expect(plan.changes.orders).toHaveLength(data.orders.length - 1);
    expect(plan.changes.order_items).toEqual(data.order_items.filter((x) => x.order_id !== order.id));
  });

  it('blocks on RESTRICT, and plans no change', () => {
    const product = data.products.find((p) => data.order_items.some((x) => x.product_id === p.id))!;
    const plan = planDelete(ecommerceTables, data, 'products', [product]);
    expect(plan.blocked).toBe(true);
    expect(plan.effects).toEqual([{ table: 'order_items', column: 'product_id', count: data.order_items.filter((x) => x.product_id === product.id).length, rule: 'RESTRICT', blocked: true }]);
    expect(plan.changes).toEqual({});
  });

  it('has no effect where nothing points at the rows', () => {
    const lonely = { ...data.products[0], id: 999999 };
    expect(planDelete(ecommerceTables, { ...data, products: [...data.products, lonely] }, 'products', [lonely])).toMatchObject({ effects: [], blocked: false });
  });

  it('follows a cascade through a table that points at itself', () => {
    const plan = planDelete([node('CASCADE')], { node: rows }, 'node', [rows[0]]);
    expect(plan.effects).toEqual([{ table: 'node', column: 'parent_id', count: 2, rule: 'CASCADE', blocked: false }]);
    expect(plan.changes.node).toEqual([rows[3]]);
  });

  it('sets the column to NULL on SET NULL, and blocks when the column cannot be', () => {
    const plan = planDelete([node('SET NULL')], { node: rows }, 'node', [rows[0]]);
    expect(plan.changes.node).toEqual([{ id: 2, parent_id: null }, rows[2], rows[3]]);
    expect(plan.blocked).toBe(false);
    const strict = planDelete([node('SET NULL', false)], { node: rows }, 'node', [rows[0]]);
    expect(strict.blocked).toBe(true);
    expect(strict.effects[0]).toMatchObject({ rule: 'SET NULL', blocked: true });
  });

  it('does not count rows that are deleted together', () => {
    expect(planDelete([node('RESTRICT')], { node: rows }, 'node', [rows[0], rows[1], rows[2]])).toMatchObject({ effects: [], blocked: false });
    expect(planDelete([node('RESTRICT')], { node: rows }, 'node', [rows[0], rows[1]]).blocked).toBe(true);
  });
});
