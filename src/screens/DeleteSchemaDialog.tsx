import { ConfirmDialog } from '../components/Modal';
import { Alert } from '../components/Toast';
import { plural } from '../core/plural';
import { selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { deleteSchema } from './schemaActions';

export interface DeleteSchemaDialogProps {
  id: number;
  name: string;
  /** How many saved versions the schema has. */
  versions: number;
}

export function DeleteSchemaDialog({ id, name, versions }: DeleteSchemaDialogProps) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const unsaved = useSchemaStore((s) => s.id === id && selectDirty(s));

  return (
    <ConfirmDialog
      title={`Delete schema "${name}"?`}
      danger
      confirmLabel="Delete schema"
      onCancel={closeDialog}
      onConfirm={() => void deleteSchema(id)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        This removes{' '}
        <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
          {name}
        </code>
        {` and its ${plural(versions, 'saved version')} from this browser.`}
      </div>
      {unsaved && (
        <Alert tone="warn" title="Unsaved changes will be lost">
          The schema is open in the workspace with changes that are not saved.
        </Alert>
      )}
      <div className="ss-faint" style={{ fontSize: 12 }}>
        This cannot be undone.
      </div>
    </ConfirmDialog>
  );
}
