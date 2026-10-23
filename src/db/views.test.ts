import { beforeEach, describe, expect, it } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { db } from './db';
import { createSchema, deleteSchema } from './schemas';
import { resetDatabase } from './testing';
import {
  deleteDiagramView,
  DiagramViewError,
  listDiagramViews,
  placeDiagramView,
  renameDiagramView,
  restoreDiagramView,
  saveDiagramView,
  upsertDiagramView,
} from './views';

beforeEach(resetDatabase);

const ids = async (name: string) => (await createSchema({ name, engine: 'PostgreSQL' }, ecommerceSnapshot())).id;

const pay = { tables: ['orders', 'payments'], positions: { orders: { x: 10, y: 20 }, payments: { x: 40, y: 50, w: 240 } } };
const staff = { tables: ['users'], positions: { users: { x: 1, y: 2 } } };

describe('saved views', () => {
  it('keeps a view with its own positions, oldest first, and only within the schema', async () => {
    const a = await ids('a');
    const b = await ids('b');
    await saveDiagramView(a, { name: 'Staff', ...staff }, 2000);
    const first = await saveDiagramView(a, { name: 'Pay', ...pay }, 1000);
    await saveDiagramView(b, { name: 'Pay', tables: ['users'], positions: { users: { x: 9, y: 9 } } }, 3000);

    const views = await listDiagramViews(a);
    expect(views.map((view) => view.name)).toEqual(['Pay', 'Staff']);
    expect(views[0]).toMatchObject({ id: first.id, schemaId: a, ...pay, at: 1000 });
    expect(await listDiagramViews(b)).toHaveLength(1);
    expect((await listDiagramViews(b))[0].positions).toEqual({ users: { x: 9, y: 9 } });
  });

  it('refuses a blank name and one the schema already has', async () => {
    const a = await ids('a');
    await saveDiagramView(a, { name: 'Pay', ...pay });
    await expect(saveDiagramView(a, { name: '  ', ...staff })).rejects.toMatchObject({ problem: 'empty' });
    await expect(saveDiagramView(a, { name: 'Pay', ...staff })).rejects.toBeInstanceOf(DiagramViewError);
    expect(await listDiagramViews(a)).toHaveLength(1);
  });

  it('replaces a view of the same name and keeps its id and time', async () => {
    const a = await ids('a');
    const saved = await saveDiagramView(a, { name: 'Pay', tables: ['orders'], positions: { orders: { x: 0, y: 0 } } }, 1000);
    const again = await upsertDiagramView(a, { name: 'Pay', ...pay }, 9000);
    expect(again.id).toBe(saved.id);
    expect(again.at).toBe(1000);
    expect(again.tables).toEqual(pay.tables);
    expect(again.positions).toEqual(pay.positions);
    expect(await listDiagramViews(a)).toHaveLength(1);

    const added = await upsertDiagramView(a, { name: 'Staff', ...staff }, 3000);
    expect(added.id).not.toBe(saved.id);
    expect((await listDiagramViews(a)).map((view) => view.name)).toEqual(['Pay', 'Staff']);
  });
});

describe('renaming, moving and deleting a view', () => {
  it('renames a view, refuses a name another has, and leaves the order alone', async () => {
    const a = await ids('a');
    const first = await saveDiagramView(a, { name: 'Pay', ...pay }, 1000);
    await saveDiagramView(a, { name: 'Staff', ...staff }, 2000);

    const renamed = await renameDiagramView(a, first.id, 'Billing');
    expect(renamed?.name).toBe('Billing');
    expect((await listDiagramViews(a)).map((view) => view.name)).toEqual(['Billing', 'Staff']);
    expect(await renameDiagramView(a, first.id, 'Billing')).toMatchObject({ name: 'Billing' });
    await expect(renameDiagramView(a, first.id, 'Staff')).rejects.toMatchObject({ problem: 'taken' });
    await expect(renameDiagramView(a, first.id, '   ')).rejects.toMatchObject({ problem: 'empty' });
    expect(await renameDiagramView(a, 9999, 'Gone')).toBeNull();
  });

  it('moves the tables of a view and leaves the other views where they are', async () => {
    const a = await ids('a');
    const payView = await saveDiagramView(a, { name: 'Pay', ...pay }, 1000);
    const staffView = await saveDiagramView(a, { name: 'Staff', ...staff }, 2000);
    await placeDiagramView(a, payView.id, { orders: { x: 80, y: 90 }, payments: { x: 100, y: 110, w: 200 } });
    await placeDiagramView(a, 9999, { users: { x: 1, y: 1 } });

    const views = await listDiagramViews(a);
    expect(views[0].positions).toEqual({ orders: { x: 80, y: 90 }, payments: { x: 100, y: 110, w: 200 } });
    expect(views[1]).toMatchObject({ id: staffView.id, positions: staff.positions });
  });

  it('removes one view and puts it back with the same id and time', async () => {
    const a = await ids('a');
    const keep = await saveDiagramView(a, { name: 'Staff', ...staff }, 1000);
    const drop = await saveDiagramView(a, { name: 'Pay', ...pay }, 2000);

    const removed = await deleteDiagramView(a, drop.id);
    expect(removed).toEqual(drop);
    expect((await listDiagramViews(a)).map((view) => view.name)).toEqual(['Staff']);
    expect(await deleteDiagramView(a, drop.id)).toBeNull();

    await restoreDiagramView(removed!);
    const views = await listDiagramViews(a);
    expect(views.map((view) => [view.id, view.name, view.at])).toEqual([
      [keep.id, 'Staff', 1000],
      [drop.id, 'Pay', 2000],
    ]);
    expect(views[1].positions).toEqual(pay.positions);
  });
});

describe('removing views with a schema', () => {
  it('goes with the schema, and only with that one', async () => {
    const a = await ids('a');
    const b = await ids('b');
    await saveDiagramView(a, { name: 'Pay', ...pay });
    await saveDiagramView(b, { name: 'Staff', ...staff });

    await deleteSchema(a);
    expect(await db.views.count()).toBe(1);
    expect((await listDiagramViews(b)).map((view) => view.name)).toEqual(['Staff']);
    expect(await listDiagramViews(a)).toEqual([]);
  });
});
