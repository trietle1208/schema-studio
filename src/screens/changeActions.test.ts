import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSql } from '../core/changes/analyzeSql';
import { setRun } from '../core/changes/model';
import { ecommerceSnapshot, previousSnapshot } from '../core/fixtures/testing';
import { setLocale } from '../core/i18n';
import { listChanges } from '../db/changes';
import { db } from '../db/db';
import { createSchema, saveVersion } from '../db/schemas';
import { resetDatabase, seedChanges } from '../db/testing';
import { useUiStore } from '../store/ui';
import { copyText, createChange, downloadScript, markDeployed, markRan, saveChange } from './changeActions';

const ui = () => useUiStore.getState();
const NOW = new Date(2026, 9, 24, 12, 0).getTime();

beforeEach(async () => {
  await resetDatabase();
  useUiStore.setState({ dialog: null, toast: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLocale('en');
});

/** A stored schema with two versions: the one before the sample, and the sample. */
async function storeTwoVersions(name: string, engine: string) {
  const made = await createSchema({ name, engine }, previousSnapshot());
  await saveVersion(made.id, ecommerceSnapshot());
  return made;
}

describe('createChange', () => {
  it('adds a blank change that waits everywhere, under the next number', async () => {
    await seedChanges();
    const change = await createChange('blank', 'atad5s', 'MySQL', NOW);

    expect(change).toMatchObject({ seq: 48, key: '', title: '', database: 'atad5s', engine: 'MySQL', sql: '', rollback: '', notes: '', createdAt: NOW });
    expect(Object.values(change!.runs).map((run) => run.status)).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(ui().toast).toBeNull();
    expect((await listChanges())[0].seq).toBe(48);
  });

  it('takes the SQL of the migration between the two newest versions, and what it destroys goes into the notes', async () => {
    await storeTwoVersions('atad5s', 'MySQL');
    const change = await createChange('diff', 'atad5s', 'MySQL', NOW);

    expect(change).toMatchObject({ seq: 1, title: 'Migration v1 → v2', database: 'atad5s', engine: 'MySQL', createdAt: NOW });
    expect(change!.sql).toContain('DROP TABLE `legacy_orders`;');
    expect(change!.sql.endsWith('\n')).toBe(false);
    expect(analyzeSql(change!.sql, 'MySQL')).toMatchObject({ kind: 'drop-table', name: 'legacy_orders', destructive: true });
    expect(change!.notes).toBe('Dropping legacy_orders deletes its data.');
  });

  it('writes the SQL of the schema that has the name of the database, in its own engine', async () => {
    await storeTwoVersions('shop', 'PostgreSQL');
    const change = await createChange('diff', 'shop', '', NOW);
    expect(change).toMatchObject({ database: 'shop', engine: 'PostgreSQL' });
    // PostgreSQL wraps the migration in one transaction.
    expect(change!.sql).toMatch(/^BEGIN;/);
    expect(change!.sql).toContain('DROP TABLE legacy_orders;');
    expect(analyzeSql(change!.sql, 'PostgreSQL')).toMatchObject({ kind: 'drop-table', name: 'legacy_orders' });
  });

  it('says so when no schema has the name of the database, and adds nothing', async () => {
    expect(await createChange('diff', 'atad5s', 'MySQL', NOW)).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Schema not found', description: 'No schema is called "atad5s".' });
    expect(await db.changes.count()).toBe(0);
  });

  it('says so when the schema has only one version', async () => {
    await createSchema({ name: 'atad5s', engine: 'MySQL' }, ecommerceSnapshot());
    expect(await createChange('diff', 'atad5s', 'MySQL', NOW)).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Nothing to compare', description: 'atad5s needs at least two saved versions.' });
    expect(await db.changes.count()).toBe(0);
  });

  it('says so when no migration is written for the engine of the schema', async () => {
    await storeTwoVersions('atad5s', 'ClickHouse');
    expect(await createChange('diff', 'atad5s', 'ClickHouse', NOW)).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'No migration for ClickHouse' });
    expect(await db.changes.count()).toBe(0);
  });

  it('writes the title and the notes in the language of the app', async () => {
    await storeTwoVersions('atad5s', 'MySQL');
    setLocale('vi');
    const change = await createChange('diff', 'atad5s', 'MySQL', NOW);
    expect(change!.title).toBe('Migration v1 → v2');
    expect(change!.notes).toBe('Xóa legacy_orders sẽ làm mất dữ liệu của nó.');
    // The script itself is written in English whatever the language.
    expect(change!.sql).toContain('-- Destructive: Dropping legacy_orders deletes its data.');
  });

  it('says so when the log cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();
    expect(await createChange('blank', 'atad5s', 'MySQL', NOW)).toBeNull();
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not save the change' });
  });
});

describe('saveChange and markRan', () => {
  it('writes a change at once', async () => {
    await seedChanges();
    const [first] = await listChanges();
    expect(await saveChange(setRun(first, 'demo', 'ran', NOW))).toBe(true);
    expect((await listChanges())[0].runs.demo).toMatchObject({ status: 'ran', at: NOW });
    expect(ui().toast).toBeNull();
  });

  it('marks changes as run now', async () => {
    await seedChanges();
    const before = Date.now();
    expect(await markRan([46], 'production')).toBe(true);
    const run = (await listChanges()).find((c) => c.seq === 46)!.runs.production;
    expect(run.status).toBe('ran');
    expect(run.at).toBeGreaterThanOrEqual(before);
  });

  it('says so when it could not write, and answers false', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await seedChanges();
    const [first] = await listChanges();
    db.close();
    expect(await saveChange(first)).toBe(false);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not save the change' });
    useUiStore.setState({ toast: null });
    expect(await markRan([46], 'production')).toBe(false);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not save the change' });
  });
});

describe('markDeployed', () => {
  it('marks the changes and offers to take it back in a toast', async () => {
    await seedChanges();
    expect(await markDeployed([42, 44, 46], 'production')).toBe(true);

    const marked = await listChanges();
    expect(marked.filter((c) => c.runs.production.status === 'ran' && c.runs.production.undo).map((c) => c.seq)).toEqual([46, 44, 42]);
    expect(ui().toast).toMatchObject({ title: 'Marked 3 changes as run on Production', actions: [{ label: 'Undo' }] });

    ui().toast!.actions![0].onClick!();
    await vi.waitFor(async () => {
      const undone = await listChanges();
      expect(undone.find((c) => c.seq === 46)!.runs.production).toEqual({ status: 'pending' });
    });
    expect(ui().toast).toBeNull();
  });

  it('counts only the changes it marked', async () => {
    await seedChanges();
    await markDeployed([46, 41], 'production');
    expect(ui().toast).toMatchObject({ title: 'Marked 1 change as run on Production' });
  });

  it('says so when it could not write, and answers false', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await seedChanges();
    db.close();
    expect(await markDeployed([46], 'production')).toBe(false);
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not save the change' });
  });
});

describe('downloadScript', () => {
  it('hands the script to the browser as a SQL file, and names it in a toast', async () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:deploy';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    downloadScript('atad5s_production_2026-10-24.sql', 'DROP TABLE a;\n');

    expect(link).toMatchObject({ href: 'blob:deploy', download: 'atad5s_production_2026-10-24.sql' });
    expect(link.click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:deploy');
    expect(blobs[0].type).toBe('application/sql');
    expect(await blobs[0].text()).toBe('DROP TABLE a;\n');
    expect(ui().toast).toMatchObject({ title: 'Exported atad5s_production_2026-10-24.sql' });
  });
});

describe('copyText', () => {
  it('puts the text on the clipboard and says what was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyText('feature/ATA-312-thanh-toan');

    expect(writeText).toHaveBeenCalledWith('feature/ATA-312-thanh-toan');
    expect(ui().toast).toMatchObject({ title: 'Copied to clipboard', description: 'feature/ATA-312-thanh-toan' });
  });

  it('says so when the browser keeps the clipboard to itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await copyText('x');
    expect(ui().toast).toMatchObject({ tone: 'error', title: 'Could not copy' });
  });
});
