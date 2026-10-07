import { byteLength, countLines, formatBytes } from '../core/files';
import { plural } from '../core/plural';
import type { SchemaRecord } from '../db/db';
import { openSchema } from '../db/schemas';
import { selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

/** Export in the toolbar: opens the Export Schema dialog for the schema as it is in the workspace, unsaved changes included. */
export function requestExport() {
  const schema = useSchemaStore.getState();
  useUiStore.getState().openDialog({
    kind: 'export',
    schema: {
      id: schema.id,
      name: schema.name,
      engine: schema.engine,
      version: schema.version,
      tables: schema.tables,
      // A schema that is not stored yet has no saved version to differ from.
      unsaved: schema.id !== null && selectDirty(schema),
    },
  });
}

/**
 * Export in the schema list: opens the Export Schema dialog for the current version of a stored
 * schema. A schema that cannot be read is reported in a toast. Never rejects.
 */
export async function requestExportStored(schema: SchemaRecord): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const stored = await openSchema(schema.id);
    if (!stored) {
      ui.showToast({ tone: 'error', title: 'Schema not found', description: `No schema is called "${schema.name}".` });
      return;
    }
    ui.openDialog({
      kind: 'export',
      schema: {
        id: stored.schema.id,
        name: stored.schema.name,
        engine: stored.schema.engine,
        version: stored.schema.version,
        tables: stored.snapshot.tables,
        unsaved: false,
      },
    });
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: 'Could not open schema',
      description: 'It could not be read from browser storage.',
    });
  }
}

/** Hands `text` to the browser as a download called `fileName`. */
function download(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const FILE_TYPES: Record<string, string> = { json: 'application/json', sql: 'application/sql', diff: 'text/x-diff' };

/**
 * The confirmed Export Schema dialog, and Export diff in the comparison: downloads the file, closes
 * the dialog and names the file in a toast.
 */
export function exportFile(fileName: string, text: string) {
  const ui = useUiStore.getState();
  download(fileName, text, FILE_TYPES[fileName.slice(fileName.lastIndexOf('.') + 1)] ?? 'text/plain');
  ui.closeDialog();
  ui.showToast({
    title: `Exported ${fileName}`,
    description: `${formatBytes(byteLength(text))} · ${plural(countLines(text), 'line')}`,
  });
}

/** Copy in the Export Schema dialog: puts the text on the clipboard and says in a toast how it went. Never rejects. */
export async function copyExport(text: string): Promise<void> {
  const ui = useUiStore.getState();
  try {
    await navigator.clipboard.writeText(text);
    ui.showToast({ title: 'Copied to clipboard', description: plural(countLines(text), 'line') });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: 'Could not copy', description: 'The browser did not allow access to the clipboard.' });
  }
}
