import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { postgresGenerator } from '../core/generate/postgres';
import { db, type SchemaRecord } from '../db/db';
import { createSchema } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { useSchemaStore } from '../store/schema';
import { memoryAddress } from '../store/testing';
import { useUiStore, type Dialog } from '../store/ui';
import { copyExport, exportFile, requestExport, requestExportStored } from './exportActions';
import { startRouting } from './navigation';

const schema = () => useSchemaStore.getState();
const ui = () => useUiStore.getState();
const exported = () => (ui().dialog as Extract<Dialog, { kind: 'export' }>).schema;

let shop: SchemaRecord;
let blog: SchemaRecord;

// Two stored schemas, with ecommerce (saved last) open in the workspace.
beforeEach(async () => {
  await resetDatabase();
  blog = await createSchema({ name: 'blog', engine: 'MySQL' }, { tables: ecommerceSnapshot().tables.slice(0, 2), positions: {} });
  shop = await createSchema({ name: 'ecommerce', engine: 'PostgreSQL' }, ecommerceSnapshot());
  useUiStore.setState({ dialog: null, toast: null, search: '' });
  await startRouting(memoryAddress());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('requestExport', () => {
  it('opens the Export Schema dialog for the schema in the workspace', () => {
    requestExport();
    expect(ui().dialog).toEqual({
      kind: 'export',
      schema: { name: 'ecommerce', engine: 'PostgreSQL', version: 1, tables: schema().tables, unsaved: false },
    });
  });

  it('exports the tables as they are, unsaved changes included', () => {
    schema().deleteTable('payments');
    requestExport();
    expect(exported().unsaved).toBe(true);
    expect(exported().tables.map((t) => t.name)).toEqual(['users', 'orders', 'order_items', 'products']);
  });

  it('has no version for a schema that is not stored yet', () => {
    schema().load({ name: 'draft', engine: 'PostgreSQL', tables: ecommerceSnapshot().tables, positions: {} });
    requestExport();
    expect(exported()).toMatchObject({ name: 'draft', version: null, unsaved: false });
  });
});

describe('requestExportStored', () => {
  it('opens the dialog for the current version of a schema that is not open', async () => {
    await requestExportStored(blog);
    expect(exported()).toMatchObject({ name: 'blog', engine: 'MySQL', version: 1, unsaved: false });
    expect(exported().tables.map((t) => t.name)).toEqual(['users', 'orders']);
    // The workspace keeps its schema.
    expect(schema().id).toBe(shop.id);
  });

  it('exports what is stored, not the unsaved changes of the open schema', async () => {
    schema().deleteTable('payments');
    await requestExportStored(shop);
    expect(exported().unsaved).toBe(false);
    expect(exported().tables).toHaveLength(5);
  });

  it('says so when the schema is gone or cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.schemas.delete(blog.id);
    await requestExportStored(blog);
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Schema not found' });

    db.close();
    await requestExportStored(shop);
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not open schema' });
  });
});

describe('exportFile', () => {
  it('downloads the file, closes the dialog and names the file in a toast', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:export';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const sql = postgresGenerator.generate(ecommerceSnapshot().tables);
    requestExport();
    exportFile('ecommerce_v1.sql', sql);

    expect(link).toMatchObject({ href: 'blob:export', download: 'ecommerce_v1.sql' });
    expect(link.click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:export');
    expect(blobs[0].type).toBe('application/sql');
    expect(await blobs[0].text()).toBe(sql);
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ title: 'Exported ecommerce_v1.sql', description: `2.1 KB · ${sql.trimEnd().split('\n').length} lines` });
  });
});

describe('copyExport', () => {
  it('puts the text on the clipboard and leaves the dialog open', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    requestExport();
    await copyExport('CREATE TABLE t ();\n');

    expect(writeText).toHaveBeenCalledWith('CREATE TABLE t ();\n');
    expect(ui().toast).toMatchObject({ title: 'Copied to clipboard', description: '1 line' });
    expect(ui().dialog?.kind).toBe('export');
  });

  it('says so when the browser keeps the clipboard to itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await copyExport('x');
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not copy' });
  });
});
