import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { db } from '../db/db';
import { listSchemas } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, useSchemaStore } from './schema';
import { openLastSchema } from './startup';
import { useUiStore } from './ui';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

beforeEach(async () => {
  await resetDatabase();
  await openLastSchema();
  useUiStore.setState({ dialog: null, toast: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openLastSchema', () => {
  it('stores the ecommerce sample as v1 on first run and opens it', async () => {
    expect(schema()).toMatchObject({ name: 'ecommerce', engine: 'PostgreSQL', version: 1, saving: false });
    expect(schema().id).not.toBeNull();
    expect(schema().tables).toEqual(ecommerceSnapshot().tables);
    expect(selectDirty(schema())).toBe(false);
    expect(ui().toast).toBeNull();
    expect((await listSchemas()).map((s) => [s.name, s.version])).toEqual([['ecommerce', 1]]);
  });

  it('opens what was saved last, as after a reload', async () => {
    schema().deleteTable('payments');
    schema().moveTable('users', { x: 40, y: 48 });
    schema().endMove();
    await schema().save();
    schema().deleteTable('orders');

    await openLastSchema();

    expect(schema().version).toBe(2);
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products']);
    expect(schema().positions.users).toEqual({ x: 40, y: 48 });
    expect(selectDirty(schema())).toBe(false);
    expect((await listSchemas()).map((s) => [s.name, s.version])).toEqual([['ecommerce', 2]]);
  });

  it('keeps the open schema and says so when the database cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    schema().load({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
    db.close();

    await openLastSchema();

    expect(schema().id).toBeNull();
    expect(names()).toHaveLength(5);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open saved schemas' });
  });
});
