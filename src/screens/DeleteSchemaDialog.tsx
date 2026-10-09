import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
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
      title={t('deleteSchema.title', { name })}
      danger
      confirmLabel={t('action.deleteSchema')}
      onCancel={closeDialog}
      onConfirm={() => void deleteSchema(id)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {rich('deleteSchema.body', {
          schema: (
            <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
              {name}
            </code>
          ),
          versions: t('count.savedVersions', { count: versions }),
        })}
      </div>
      {unsaved && (
        <Alert tone="warn" title={t('dialog.unsavedLost')}>
          {t('deleteSchema.unsaved')}
        </Alert>
      )}
      <div className="ss-faint" style={{ fontSize: 12 }}>
        {t('dialog.cannotUndo')}
      </div>
    </ConfirmDialog>
  );
}
