import { t } from '../core/i18n';
import type { Table } from '../core/model';
import type { Row } from '../core/records';
import { rowsJson } from '../core/records/record';
import { useUiStore } from '../store/ui';

/** "Copy as JSON" on a row of the grid, or on the rows that are selected. */
export async function copyRowsAsJson(table: Table, rows: readonly Row[]): Promise<void> {
  const ui = useUiStore.getState();
  try {
    await navigator.clipboard.writeText(rowsJson(table, rows));
    ui.showToast({ tone: 'success', title: t('records.copied.title', { count: rows.length }) });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}

/** Tells that records were changed and offers to take it back; `undo` writes the old rows again. */
export function announceRecords(title: string, undo: () => Promise<void>): void {
  const ui = useUiStore.getState();
  const id = ui.showToast({
    tone: 'info',
    title,
    description: t('records.stored'),
    actions: [
      {
        label: t('common.undo'),
        onClick: () => {
          ui.dismissToast(id);
          undo().catch((error) => {
            console.error(error);
            useUiStore.getState().showToast({ tone: 'error', title: t('records.undoFailed.title'), description: t('records.undoFailed.description') });
          });
        },
      },
    ],
  });
}

/** The rows could not be written: nothing was changed. */
export function recordsFailed(error: unknown): void {
  console.error(error);
  useUiStore.getState().showToast({ tone: 'error', title: t('records.saveFailed.title'), description: t('records.saveFailed.description') });
}
