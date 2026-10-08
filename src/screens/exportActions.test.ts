import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ecommerceSnapshot } from '../core/fixtures/testing';
import { assignGroup } from '../core/groups';
import { postgresGenerator } from '../core/generate/postgres';
import { db, type SchemaRecord } from '../db/db';
import { createSchema } from '../db/schemas';
import { resetDatabase } from '../db/testing';
import { useSchemaStore } from '../store/schema';
import { memoryAddress } from '../store/testing';
import { useUiStore, type Dialog } from '../store/ui';
import { copyExport, copyImage, exportFile, exportImage, requestExport, requestExportStored } from './exportActions';
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
      schema: {
        id: shop.id,
        name: 'ecommerce',
        engine: 'PostgreSQL',
        version: 1,
        tables: schema().tables,
        positions: schema().positions,
        groups: [],
        unsaved: false,
      },
    });
  });

  it('takes the places and the groups of the tables along, for the diagram as a picture', () => {
    schema().moveTable('users', { x: 40, y: 64 });
    schema().endMove();
    schema().editGroups((groups) => assignGroup(groups, ['orders', 'order_items'], 'sales'));
    requestExport();
    expect(exported().positions.users).toEqual({ x: 40, y: 64 });
    expect(exported().groups).toEqual([{ name: 'sales', color: 'violet', tables: ['orders', 'order_items'] }]);
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

describe('exportImage', () => {
  const picture = () => ({ file: new Blob(['png'], { type: 'image/png' }), width: 1672, height: 1038 });

  it('downloads the picture once it is drawn, closes the dialog and names the file in a toast', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:picture';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    requestExport();
    await exportImage('ecommerce_v1.png', Promise.resolve(picture()));

    expect(link).toMatchObject({ href: 'blob:picture', download: 'ecommerce_v1.png' });
    expect(link.click).toHaveBeenCalledOnce();
    expect(blobs[0].type).toBe('image/png');
    expect(ui().dialog).toBeNull();
    expect(ui().toast).toMatchObject({ title: 'Exported ecommerce_v1.png', description: '3 B · 1672 × 1038 px' });
  });

  it('says so when the picture cannot be drawn, and leaves the dialog open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requestExport();
    await exportImage('ecommerce_v1.png', Promise.reject(new Error('too large')));
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not export the diagram' });
    expect(ui().dialog?.kind).toBe('export');
  });

  it('downloads an SVG as a picture', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:svg';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    exportFile('ecommerce_v1.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    expect(blobs[0].type).toBe('image/svg+xml');
  });
});

describe('copyImage', () => {
  it('puts the picture on the clipboard and leaves the dialog open', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal(
      'ClipboardItem',
      class {
        items: Record<string, Blob>;

        constructor(items: Record<string, Blob>) {
          this.items = items;
        }
      },
    );
    requestExport();
    const file = new Blob(['png'], { type: 'image/png' });
    await copyImage(Promise.resolve({ file, width: 1672, height: 1038 }));

    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0][0].items).toEqual({ 'image/png': file });
    expect(ui().toast).toMatchObject({ title: 'Copied to clipboard', description: '1672 × 1038 px' });
    expect(ui().dialog?.kind).toBe('export');
  });

  it('says so when the browser keeps the clipboard to itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) } });
    vi.stubGlobal('ClipboardItem', class {});
    await copyImage(Promise.resolve({ file: new Blob(['png'], { type: 'image/png' }), width: 1, height: 1 }));
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not copy' });
  });
});
