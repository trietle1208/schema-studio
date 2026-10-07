import { ConfirmDialog } from '../components/Modal';
import { Alert } from '../components/Toast';
import { plural } from '../core/plural';
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
      title={`Delete table "${name}"?`}
      danger
      confirmLabel="Delete table"
      onCancel={closeDialog}
      onConfirm={() => deleteTable(name)}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        This removes{' '}
        <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
          {`${table.schema || 'public'}.${name}`}
        </code>
        {` with its ${plural(table.columns.length, 'column')} and ${plural(table.indexes?.length ?? 0, 'index', 'indexes')} from the working copy.`}
      </div>
      {dropped.length > 0 && (
        <Alert tone="warn" title={`${plural(dropped.length, 'foreign key')} will be dropped`}>
          {`${referencing.join(', ')} ${referencing.length === 1 ? 'references' : 'reference'} this table.`}
        </Alert>
      )}
      <div className="ss-faint" style={{ fontSize: 12 }}>
        Nothing is lost until you save.
      </div>
    </ConfirmDialog>
  );
}
