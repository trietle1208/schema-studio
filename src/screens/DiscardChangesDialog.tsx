import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { t } from '../core/i18n';
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
      title={t('discard.title')}
      danger
      confirmLabel={t('discard.confirm')}
      cancelLabel={t('discard.cancel')}
      onCancel={closeDialog}
      onConfirm={() => {
        closeDialog();
        onDiscard();
      }}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {rich('discard.body', {
          schema: (
            <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
              {name}
            </code>
          ),
        })}
      </div>
      <div className="ss-faint" style={{ fontSize: 12 }}>
        {t('discard.note')}
      </div>
    </ConfirmDialog>
  );
}
