import { lazy, Suspense, useEffect } from 'react';
import { Toast } from '../components/Toast';
import { useUiStore } from '../store/ui';
import { DeleteSchemaDialog } from './DeleteSchemaDialog';
import { DeleteTableDialog } from './DeleteTableDialog';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { ExportDialog } from './ExportDialog';
import { NewSchemaDialog } from './NewSchemaDialog';

// The SQL parser comes with the import dialog, so it is only loaded when that is first opened.
const ImportSchemaDialog = lazy(() => import('./ImportSchemaDialog').then((m) => ({ default: m.ImportSchemaDialog })));

const TOAST_MS = 5000;

/** What floats over either screen: the toast and the open dialog. */
export function Overlays() {
  const dialog = useUiStore((s) => s.dialog);
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const timer = setTimeout(() => dismissToast(toastId), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastId, dismissToast]);

  return (
    <>
      {toast && (
        <div className="ss-toasts">
          <Toast
            tone={toast.tone}
            title={toast.title}
            description={toast.description}
            actions={toast.actions}
            onClose={() => dismissToast(toast.id)}
          />
        </div>
      )}
      {dialog?.kind === 'delete-table' && <DeleteTableDialog table={dialog.table} />}
      {dialog?.kind === 'new-schema' && <NewSchemaDialog />}
      {dialog?.kind === 'import-schema' && (
        <Suspense fallback={null}>
          <ImportSchemaDialog />
        </Suspense>
      )}
      {dialog?.kind === 'export' && <ExportDialog schema={dialog.schema} />}
      {dialog?.kind === 'delete-schema' && (
        <DeleteSchemaDialog id={dialog.id} name={dialog.name} versions={dialog.versions} />
      )}
      {dialog?.kind === 'discard-changes' && <DiscardChangesDialog onDiscard={dialog.onDiscard} />}
    </>
  );
}
