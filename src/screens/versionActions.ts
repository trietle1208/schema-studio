import { compareDdl, unifiedDiff } from '../core/diff/ddl';
import { diffFileName, exportFileName } from '../core/files';
import { EXPORT_ENGINES, generatorFor } from '../core/generate';
import { groupsOf } from '../core/groups';
import { t } from '../core/i18n';
import { versionLabel, type SavedVersion } from '../core/versions';
import { restoreVersion as restoreStored } from '../db/schemas';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { exportFile } from './exportActions';
import { openStored } from './navigation';

// What the version history and the comparison of two versions do. Both are about the schema that
// is open in the workspace.

/** Export in the version history: opens the Export Schema dialog for a saved version of the open schema. */
export function exportVersion(version: SavedVersion) {
  const schema = useSchemaStore.getState();
  useUiStore.getState().openDialog({
    kind: 'export',
    schema: {
      id: schema.id,
      name: schema.name,
      engine: schema.engine,
      version: version.version,
      tables: version.snapshot.tables,
      positions: version.snapshot.positions,
      groups: groupsOf(version.snapshot),
      unsaved: false,
    },
  });
}

/**
 * Generate Migration in the comparison: opens the Export Schema dialog set to the migration that
 * takes a database from version `from` to version `to`.
 */
export function generateMigration(from: SavedVersion, to: SavedVersion) {
  const schema = useSchemaStore.getState();
  useUiStore.getState().openDialog({
    kind: 'export',
    schema: {
      id: schema.id,
      name: schema.name,
      engine: schema.engine,
      version: to.version,
      tables: to.snapshot.tables,
      positions: to.snapshot.positions,
      groups: groupsOf(to.snapshot),
      unsaved: false,
      migrateFrom: from.version,
    },
  });
}

/**
 * Export diff in the comparison: downloads the DDL of the two versions as a unified diff, which
 * `patch` applies to the DDL of `from` to give that of `to`.
 */
export function exportDiff(from: SavedVersion, to: SavedVersion) {
  const { name, engine } = useSchemaStore.getState();
  // DDL is written for an engine that has a generator, whatever the schema was made for.
  const generator = generatorFor(EXPORT_ENGINES.includes(engine) ? engine : EXPORT_ENGINES[0]);
  if (!generator) return;
  const { rows } = compareDdl(generator.blocks(from.snapshot.tables), generator.blocks(to.snapshot.tables), { fold: false });
  const text = unifiedDiff(rows, `a/${exportFileName(name, from.version, 'sql')}`, `b/${exportFileName(name, to.version, 'sql')}`);
  exportFile(diffFileName(name, from.version, to.version), text);
}

/** Restore in the version history: going back to an earlier version is confirmed in a dialog first. */
export function requestRestore(version: number) {
  useUiStore.getState().openDialog({ kind: 'restore-version', version });
}

/**
 * The confirmed restore: stores the earlier version as the next version of the open schema and
 * shows it in the workspace, in place of whatever was unsaved there. Says in a toast how it went.
 * Never rejects.
 */
export async function restoreVersion(version: number): Promise<void> {
  const ui = useUiStore.getState();
  const { id } = useSchemaStore.getState();
  ui.closeDialog();
  if (id === null) return;
  try {
    const restored = await restoreStored(id, version);
    // Another schema may have been opened while the version was being written.
    if (useSchemaStore.getState().id === id) openStored(restored);
    ui.showToast({
      title: t('toast.restored.title', { from: versionLabel(version), to: versionLabel(restored.schema.version) }),
      description: `${restored.schema.name} · ${t('count.tables', { count: restored.schema.tables })}`,
    });
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: t('toast.restoreFailed.title'),
      description: t('toast.restoreFailed.description'),
    });
  }
}
