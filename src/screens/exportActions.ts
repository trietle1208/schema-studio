import { byteLength, countLines, formatBytes } from '../core/files';
import { groupsOf } from '../core/groups';
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
      positions: schema.positions,
      groups: schema.groups,
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
        positions: stored.snapshot.positions,
        groups: groupsOf(stored.snapshot),
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

/** Hands a file to the browser as a download called `fileName`. */
function download(fileName: string, file: Blob) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const FILE_TYPES: Record<string, string> = {
  json: 'application/json',
  sql: 'application/sql',
  diff: 'text/x-diff',
  svg: 'image/svg+xml',
};

/**
 * The confirmed Export Schema dialog, and Export diff in the comparison: downloads the file, closes
 * the dialog and names the file in a toast.
 */
export function exportFile(fileName: string, text: string) {
  const ui = useUiStore.getState();
  download(fileName, new Blob([text], { type: FILE_TYPES[fileName.slice(fileName.lastIndexOf('.') + 1)] ?? 'text/plain' }));
  ui.closeDialog();
  ui.showToast({
    title: `Exported ${fileName}`,
    description: `${formatBytes(byteLength(text))} · ${plural(countLines(text), 'line')}`,
  });
}

/** A picture of the diagram and its size in px. */
export interface DiagramImage {
  file: Blob;
  width: number;
  height: number;
}

/**
 * The confirmed Export Schema dialog for the diagram as a picture: downloads it once it is drawn,
 * closes the dialog and names the file in a toast. A picture that cannot be drawn is reported in a
 * toast and leaves the dialog open. Never rejects.
 */
export async function exportImage(fileName: string, image: Promise<DiagramImage>): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const { file, width, height } = await image;
    download(fileName, file);
    ui.closeDialog();
    ui.showToast({ title: `Exported ${fileName}`, description: `${formatBytes(file.size)} · ${width} × ${height} px` });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: 'Could not export the diagram', description: 'The browser could not draw a picture of this size.' });
  }
}

/** Copy in the Export Schema dialog for a PNG: puts the picture on the clipboard and says in a toast how it went. Never rejects. */
export async function copyImage(image: Promise<DiagramImage>): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const { file, width, height } = await image;
    await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
    ui.showToast({ title: 'Copied to clipboard', description: `${width} × ${height} px` });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: 'Could not copy', description: 'The browser did not allow access to the clipboard.' });
  }
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
