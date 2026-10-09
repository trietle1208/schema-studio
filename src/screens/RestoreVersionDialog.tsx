import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
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
      title={t('restore.title', { version: versionLabel(version) })}
      confirmLabel={t('action.restore')}
      onCancel={closeDialog}
      onConfirm={() => void restoreVersion(version)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {rich('restore.body', {
          schema: (
            <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
              {name}
            </code>
          ),
          version: versionLabel(version),
          next: versionLabel(current + 1),
          current: versionLabel(current),
        })}
      </div>
      {unsaved && (
        <Alert tone="warn" title={t('dialog.unsavedLost')}>
          {t('restore.unsaved')}
        </Alert>
      )}
    </ConfirmDialog>
  );
}
