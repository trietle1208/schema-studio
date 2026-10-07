import { useEffect } from 'react';
import { Toast } from '../components/Toast';
import { useUiStore } from '../store/ui';
import { DeleteSchemaDialog } from './DeleteSchemaDialog';
import { DeleteTableDialog } from './DeleteTableDialog';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { NewSchemaDialog } from './NewSchemaDialog';

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
      {dialog?.kind === 'delete-schema' && (
        <DeleteSchemaDialog id={dialog.id} name={dialog.name} versions={dialog.versions} />
      )}
      {dialog?.kind === 'discard-changes' && <DiscardChangesDialog onDiscard={dialog.onDiscard} />}
    </>
  );
}
