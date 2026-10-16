import { t } from '../core/i18n';
import { ConfirmDialog } from './Modal';
import { rich } from './rich';

export interface DiscardRecordDialogProps {
  /** The table the record is in, and the record's name (`users · id = 101`) when it exists; none for a new one. */
  table: string;
  record?: string | null;
  /** The columns whose values differ from the record; none when only the text of the JSON tab is edited. */
  changed: readonly string[];
  onKeep: () => void;
  onDiscard: () => void;
}

/** Asks before the changes of a record that is open in the editor are given up. */
export function DiscardRecordDialog({ table, record, changed, onKeep, onDiscard }: DiscardRecordDialogProps) {
  return (
    <ConfirmDialog
      title={record ? t('record.discard.edit', { record }) : t('record.discard.new', { table })}
      danger
      confirmLabel={t('record.discard.confirm')}
      cancelLabel={t('record.discard.keep')}
      onCancel={onKeep}
      onConfirm={onDiscard}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {changed.length
          ? rich('record.discard.columns', {
              changed: t('count.changedColumns', { count: changed.length }),
              columns: (
                <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
                  {changed.join(', ')}
                </code>
              ),
            })
          : t('record.discard.json')}
      </div>
    </ConfirmDialog>
  );
}
