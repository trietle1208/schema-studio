import { plural } from '../core/plural';
import { selectDirty, undo, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

/** ⌘S and the Save button: saves the working copy and says in a toast how it went. */
export function saveSchema() {
  const schema = useSchemaStore.getState();
  const ui = useUiStore.getState();
  const dirty = selectDirty(schema);
  if (!schema.save()) {
    ui.showToast({
      tone: 'error',
      title: 'Fix validation errors before saving',
      description: 'One or more columns are invalid. Errors are marked in the inspector.',
    });
    return;
  }
  // Saving an unchanged schema saves nothing, so there is nothing to announce.
  if (dirty) ui.showToast({ title: 'Saved', description: `${schema.name} · ${plural(schema.tables.length, 'table')}` });
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
