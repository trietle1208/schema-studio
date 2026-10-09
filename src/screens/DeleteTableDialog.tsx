import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
import { droppedRelations } from '../core/relations';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { deleteTable } from './workspaceActions';

export interface DeleteTableDialogProps {
  /** The name of the table to delete. */
  table: string;
}

export function DeleteTableDialog({ table: name }: DeleteTableDialogProps) {
  const tables = useSchemaStore((s) => s.tables);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const table = tables.find((t) => t.name === name);
  if (!table) return null;

  const dropped = droppedRelations(table, tables);
  const referencing = [...new Set(dropped.map((r) => r.from.table))];

  return (
    <ConfirmDialog
      title={t('deleteTable.title', { name })}
      danger
      confirmLabel={t('action.deleteTable')}
      onCancel={closeDialog}
      onConfirm={() => deleteTable(name)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {rich('deleteTable.body', {
          table: (
            <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
              {`${table.schema || 'public'}.${name}`}
            </code>
          ),
          columns: t('count.columns', { count: table.columns.length }),
          indexes: t('count.indexes', { count: table.indexes?.length ?? 0 }),
        })}
      </div>
      {dropped.length > 0 && (
        <Alert tone="warn" title={t('deleteTable.dropped', { count: dropped.length })}>
          {t('deleteTable.referencing', { count: referencing.length, tables: referencing.join(', ') })}
        </Alert>
      )}
      <div className="ss-faint" style={{ fontSize: 12 }}>
        {t('dialog.nothingLost')}
      </div>
    </ConfirmDialog>
  );
}
