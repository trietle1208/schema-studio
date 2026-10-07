import { flushSync } from 'react-dom';
import type { Position } from '../core/model';
import { plural } from '../core/plural';
import { versionLabel } from '../core/versions';
import { undo, useSchemaStore, type SaveResult } from '../store/schema';
import { useUiStore } from '../store/ui';

/**
 * ⌘S and the Save button: stores the working copy as a new version and says in a toast how it went.
 * Never rejects.
 */
export async function saveSchema(): Promise<void> {
  const schema = useSchemaStore.getState();
  const ui = useUiStore.getState();
  let result: SaveResult;
  try {
    result = await schema.save();
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: 'Save failed',
      description: 'The version could not be written to browser storage. Your changes are still open.',
    });
    return;
  }
  if (result.status === 'invalid') {
    ui.showToast({
      tone: 'error',
      title: 'Fix validation errors before saving',
      description: 'One or more columns are invalid. Errors are marked in the inspector.',
    });
  }
  // Saving an unchanged schema saves nothing, so there is nothing to announce.
  if (result.status === 'saved') {
    ui.showToast({
      title: `Saved as ${versionLabel(result.version)}`,
      description: `${schema.name} · ${plural(schema.tables.length, 'table')}`,
    });
  }
}

/**
 * "New table" in the canvas menu and the inspector: adds a table at `position`, selects it and
 * puts its name into rename mode.
 */
export function newTable(position: Position) {
  const ui = useUiStore.getState();
  // A search would hide the new table unless its name happened to match.
  ui.setSearch('');
  // The inspector has to show the new table before it can be told to rename it.
  flushSync(() => useSchemaStore.getState().addTable(position));
  ui.requestRename();
}

/** ⌫, the inspector and the canvas menu: deleting a table is confirmed in a dialog first. */
export function requestDeleteTable(name: string) {
  if (!useSchemaStore.getState().tables.some((t) => t.name === name)) return;
  useUiStore.getState().openDialog({ kind: 'delete-table', table: name });
}

/** The confirmed delete: removes the table and offers Undo in a toast. */
export function deleteTable(name: string) {
  const ui = useUiStore.getState();
  ui.closeDialog();
  useSchemaStore.getState().deleteTable(name);
  const id = ui.showToast({
    tone: 'info',
    title: `Deleted table ${name}`,
    description: 'Not saved yet. Press ⌘Z to restore it.',
    actions: [{ label: 'Undo', onClick: undo }],
  });
  // Undo reverts the latest edit, so the offer only holds until the schema changes again
  // (which undoing the delete does too).
  const { tables, positions } = useSchemaStore.getState();
  const unsubscribe = useSchemaStore.subscribe((s) => {
    if (s.tables === tables && s.positions === positions) return;
    unsubscribe();
    ui.dismissToast(id);
  });
}
