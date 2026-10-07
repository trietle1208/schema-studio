import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { db } from '../db/db';
import { createSchema } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, useSchemaStore } from './schema';
import { openLastSchema } from './startup';
import { useUiStore } from './ui';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const names = () => schema().tables.map((t) => t.name);

beforeEach(async () => {
  await resetDatabase();
  schema().load({ name: 'ecommerce', engine: 'PostgreSQL', ...ecommerceSnapshot() });
  useUiStore.setState({ screen: 'workspace', dialog: null, toast: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openLastSchema', () => {
  it('starts on the schema list while nothing is stored, and stores nothing', async () => {
    await openLastSchema();

    expect(ui().screen).toBe('schemas');
    expect(ui().toast).toBeNull();
    expect(schema().id).toBeNull();
    expect(await db.schemas.count()).toBe(0);
  });

  it('opens what was saved last in the workspace, as after a reload', async () => {
    await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: [], positions: {} });
    const shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
    await openLastSchema();
    expect(schema()).toMatchObject({ id: shop.id, name: 'ecommerce', version: 1 });

    schema().deleteTable('payments');
    schema().moveTable('users', { x: 40, y: 48 });
    schema().endMove();
    await schema().save();
    schema().deleteTable('orders');
    useUiStore.setState({ screen: 'schemas' });

    await openLastSchema();

    expect(ui().screen).toBe('workspace');
    expect(schema()).toMatchObject({ id: shop.id, name: 'ecommerce', version: 2, saving: false });
    expect(names()).toEqual(['users', 'orders', 'order_items', 'products']);
    expect(schema().positions.users).toEqual({ x: 40, y: 48 });
    expect(selectDirty(schema())).toBe(false);
  });

  it('keeps the sample open, unsaved, and says so when the database cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useUiStore.setState({ screen: 'schemas' });
    db.close();

    await openLastSchema();

    expect(ui().screen).toBe('workspace');
    expect(schema().id).toBeNull();
    expect(names()).toHaveLength(5);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open saved schemas' });
  });
});
