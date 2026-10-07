import { ConfirmDialog } from '../components/Modal';
import { Alert } from '../components/Toast';
import { versionLabel } from '../core/versions';
import { selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { restoreVersion } from './versionActions';

export interface RestoreVersionDialogProps {
  /** The version to go back to. */
  version: number;
}

export function RestoreVersionDialog({ version }: RestoreVersionDialogProps) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const name = useSchemaStore((s) => s.name);
  const current = useSchemaStore((s) => s.version) ?? version;
  const unsaved = useSchemaStore(selectDirty);

  return (
    <ConfirmDialog
      title={`Restore ${versionLabel(version)}?`}
      confirmLabel="Restore"
      onCancel={closeDialog}
      onConfirm={() => void restoreVersion(version)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
          {name}
        </code>
        {` goes back to ${versionLabel(version)}, saved as ${versionLabel(current + 1)}. Every version up to ${versionLabel(current)} stays in the history.`}
      </div>
      {unsaved && (
        <Alert tone="warn" title="Unsaved changes will be lost">
          The diagram has changes that are not saved as a version.
        </Alert>
      )}
    </ConfirmDialog>
  );
}
