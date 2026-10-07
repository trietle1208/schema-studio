import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot, previousSnapshot } from '../core/fixtures/testing';
import { postgresGenerator } from '../core/generate/postgres';
import { db, type SchemaRecord, type VersionRecord } from '../db/db';
import { createSchema, listVersions, saveVersion } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { selectDirty, useSchemaStore } from '../store/schema';
import { memoryAddress } from '../store/testing';
import { useUiStore, type Dialog } from '../store/ui';
import { go, startRouting } from './navigation';
import { exportDiff, exportVersion, generateMigration, requestRestore, restoreVersion } from './versionActions';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const exported = () => (ui().dialog as Extract<Dialog, { kind: 'export' }>).schema;

let shop: SchemaRecord;
let v1: VersionRecord;
let v2: VersionRecord;

// ecommerce with the two versions of the design, open in the workspace on its version history.
beforeEach(async () => {
  await resetDatabase();
  shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, previousSnapshot(), 'Imported from ecommerce_prod.sql');
  await saveVersion(shop.id, ecommerceSnapshot(), 'Normalize order line items');
  [v2, v1] = await listVersions(shop.id);
  useUiStore.setState({ dialog: null, toast: null, search: '' });
  await startRouting(memoryAddress('#/schemas/ecommerce/history'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('exportVersion', () => {
  it('opens the Export Schema dialog for the saved version, not for what is in the workspace', () => {
    schema().deleteTable('payments');
    exportVersion(v1);
    expect(exported()).toEqual({
      id: shop.id,
      name: 'ecommerce',
      engine: 'PostgreSQL',
      version: 1,
      tables: v1.snapshot.tables,
      unsaved: false,
    });
  });
});

describe('generateMigration', () => {
  it('opens the Export Schema dialog set to the migration between the two versions', () => {
    generateMigration(v1, v2);
    expect(exported()).toMatchObject({ id: shop.id, version: 2, tables: v2.snapshot.tables, unsaved: false, migrateFrom: 1 });
  });

  it('goes either way', () => {
    generateMigration(v2, v1);
    expect(exported()).toMatchObject({ version: 1, tables: v1.snapshot.tables, migrateFrom: 2 });
  });
});

describe('exportDiff', () => {
  it('downloads the comparison as a unified diff named after both versions', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:diff';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    exportDiff(v1, v2);

    expect(link.download).toBe('ecommerce_v1_v2.diff');
    expect(blobs[0].type).toBe('text/x-diff');
    const text = await blobs[0].text();
    expect(text.startsWith('--- a/ecommerce_v1.sql\n+++ b/ecommerce_v2.sql\n@@ -2,6 +2,7 @@\n')).toBe(true);
    expect(text).toContain('+  avatar_url  TEXT,\n');
    // Every line of the new DDL that is not in the old one is there, however far from a change.
    const added = text.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
    const removed = text.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
    const lines = (tables: typeof v1.snapshot.tables) => postgresGenerator.generate(tables).trimEnd().split('\n').length;
    expect(added - removed).toBe(lines(v2.snapshot.tables) - lines(v1.snapshot.tables));
    expect(ui().toast).toMatchObject({ title: 'Exported ecommerce_v1_v2.diff' });
  });
});

describe('restoreVersion', () => {
  it('is confirmed in a dialog first', async () => {
    requestRestore(1);
    expect(ui().dialog).toEqual({ kind: 'restore-version', version: 1 });
    expect(await db.versions.count()).toBe(2);
  });

  it('saves the earlier version as the next one and shows it in the workspace', async () => {
    requestRestore(1);
    await restoreVersion(1);

    expect(ui().dialog).toBeNull();
    expect((await listVersions(shop.id)).map((v) => [v.version, v.message])).toEqual([
      [3, 'Restored from v1'],
      [2, 'Normalize order line items'],
      [1, 'Imported from ecommerce_prod.sql'],
    ]);
    expect(schema()).toMatchObject({ id: shop.id, version: 3 });
    expect(schema().tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'payments', 'legacy_orders']);
    expect(selectDirty(schema())).toBe(false);
    expect(ui().toast).toMatchObject({ title: 'Restored v1 as v3', description: 'ecommerce · 5 tables' });
    // The history stays on screen.
    expect(ui().route).toEqual({ screen: 'history', schema: 'ecommerce' });
  });

  it('drops the unsaved changes of the workspace', async () => {
    schema().deleteTable('payments');
    await restoreVersion(1);
    expect(schema().tables).toHaveLength(5);
    expect(selectDirty(schema())).toBe(false);
    expect(useSchemaStore.temporal.getState().pastStates).toEqual([]);
  });

  it('leaves the workspace alone when another schema was opened meanwhile', async () => {
    await createSchema({ name: 'blog', engine: 'PostgreSQL' }, { tables: [], positions: {} });
    const restoring = restoreVersion(1);
    go({ screen: 'workspace', schema: 'blog' });
    await restoring;
    await vi.waitFor(() => expect(schema().name).toBe('blog'));
    expect(schema().tables).toEqual([]);
    expect((await listVersions(shop.id)).map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it('says so when the version cannot be written, and changes nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await restoreVersion(7);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not restore version' });
    expect(schema().version).toBe(2);
    expect(await db.versions.count()).toBe(2);
  });
});
