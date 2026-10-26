import { pendingRuns, type Change, type ServerId } from '../core/changes/model';
import { serverName } from '../core/changes/text';
import { t } from '../core/i18n';
import { migratorFor } from '../core/generate';
import { versionLabel } from '../core/versions';
import { addChange, markRuns, putChange, undoRuns } from '../db/changes';
import type { ChangeRecord } from '../db/db';
import { listVersions, openSchemaNamed } from '../db/schemas';
import { useUiStore } from '../store/ui';

// What the change log does to its changes and what it says about it. A change is written at once,
// at the moment it is marked; there is no save button, and none of it is part of a schema's undo.

const ui = () => useUiStore.getState();

function saveFailed(error: unknown) {
  console.error(error);
  ui().showToast({ tone: 'error', title: t('changes.saveFailed.title'), description: t('changes.saveFailed.description') });
}

/** Writes a change that was edited, and says so in a toast when it could not be. Resolves with whether it was written. */
export async function saveChange(change: ChangeRecord): Promise<boolean> {
  try {
    await putChange(change);
    return true;
  } catch (error) {
    saveFailed(error);
    return false;
  }
}

/** Marks the changes as run on `server` now. Resolves with whether it was written. */
export async function markRan(seqs: readonly number[], server: ServerId): Promise<boolean> {
  try {
    await markRuns(seqs, server);
    return true;
  } catch (error) {
    saveFailed(error);
    return false;
  }
}

/** Marks what a deploy ran, and offers to take it back in a toast. Resolves with whether it was written. */
export async function markDeployed(seqs: readonly number[], server: ServerId): Promise<boolean> {
  let marked: ChangeRecord[];
  try {
    marked = await markRuns(seqs, server);
  } catch (error) {
    saveFailed(error);
    return false;
  }
  const done = marked.map((c) => c.seq);
  const id = ui().showToast({
    title: t('changes.deploy.marked', { count: done.length, server: serverName(server) }),
    actions: [
      {
        label: t('common.undo'),
        onClick: () => {
          ui().dismissToast(id);
          undoRuns(done, server).catch(saveFailed);
        },
      },
    ],
  });
  return true;
}

/** A change nobody has run anywhere yet, as it is when it is written. */
function draftFor(database: string, engine: string, now: number): Omit<Change, 'seq'> {
  return { key: '', title: '', database, engine, branch: '', createdAt: now, sql: '', rollback: '', notes: '', runs: pendingRuns() };
}

/**
 * Adds a change for `database`, under the next number of the log. A blank one has no SQL. One from
 * the schema diff takes its SQL from the migration between the two newest versions of the schema
 * that has the name of the database, and what the migration destroys goes into its notes. Resolves
 * with the change, or null when it could not be made, which a toast says.
 */
export async function createChange(kind: 'blank' | 'diff', database: string, engine: string, now = Date.now()): Promise<ChangeRecord | null> {
  try {
    if (kind === 'blank') return await addChange(draftFor(database, engine, now));

    const stored = await openSchemaNamed(database);
    if (!stored) {
      ui().showToast({ tone: 'error', title: t('toast.schemaNotFound.title'), description: t('toast.schemaNotFound.description', { name: database }) });
      return null;
    }
    const [newer, older] = await listVersions(stored.schema.id);
    if (!older) {
      ui().showToast({ tone: 'error', title: t('changes.new.fewVersions.title'), description: t('changes.new.fewVersions.description', { name: database }) });
      return null;
    }
    const migrator = migratorFor(stored.schema.engine);
    if (!migrator) {
      ui().showToast({
        tone: 'error',
        title: t('changes.new.noMigration.title', { engine: stored.schema.engine }),
        description: t('changes.new.noMigration.description'),
      });
      return null;
    }
    const migration = migrator.migrate(older.snapshot.tables, newer.snapshot.tables);
    return await addChange({
      ...draftFor(database, stored.schema.engine, now),
      title: t('changes.new.diffTitle', { from: versionLabel(older.version), to: versionLabel(newer.version) }),
      sql: migration.sql.trim(),
      notes: migration.destructive.map((d) => d.message).join('\n'),
    });
  } catch (error) {
    saveFailed(error);
    return null;
  }
}

/** Puts a short text on the clipboard and says in a toast how it went. Never rejects. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ui().showToast({ title: t('toast.copied.title'), description: text });
  } catch (error) {
    console.error(error);
    ui().showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}

/** Hands a deploy script to the browser as a file called `fileName`, and says so in a toast. */
export function downloadScript(fileName: string, script: string) {
  const url = URL.createObjectURL(new Blob([script], { type: 'application/sql' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  ui().showToast({ title: t('toast.exported.title', { file: fileName }) });
}
