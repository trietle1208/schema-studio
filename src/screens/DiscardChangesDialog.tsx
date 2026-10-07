import { ConfirmDialog } from '../components/Modal';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

export interface DiscardChangesDialogProps {
  /** Goes on with what needed the open schema out of the way. */
  onDiscard: () => void;
}

export function DiscardChangesDialog({ onDiscard }: DiscardChangesDialogProps) {
  const name = useSchemaStore((s) => s.name);
  const closeDialog = useUiStore((s) => s.closeDialog);

  return (
    <ConfirmDialog
      title="Discard unsaved changes?"
      danger
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onCancel={closeDialog}
      onConfirm={() => {
        closeDialog();
        onDiscard();
      }}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
          {name}
        </code>
        {' has changes that are not saved as a version. Opening another schema drops them.'}
      </div>
      <div className="ss-faint" style={{ fontSize: 12 }}>
        Saved versions are not affected.
      </div>
    </ConfirmDialog>
  );
}
