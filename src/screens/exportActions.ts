import { byteLength, countLines, formatBytes } from '../core/files';
import { groupsOf } from '../core/groups';
import { t } from '../core/i18n';
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
      ui.showToast({ tone: 'error', title: t('toast.schemaNotFound.title'), description: t('toast.schemaNotFound.description', { name: schema.name }) });
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
      title: t('toast.openFailed.title'),
      description: t('toast.openFailed.description'),
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
    title: t('toast.exported.title', { file: fileName }),
    description: `${formatBytes(byteLength(text))} · ${t('count.lines', { count: countLines(text) })}`,
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
    ui.showToast({ title: t('toast.exported.title', { file: fileName }), description: `${formatBytes(file.size)} · ${width} × ${height} px` });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.exportDiagramFailed.title'), description: t('toast.exportDiagramFailed.description') });
  }
}

/** Copy in the Export Schema dialog for a PNG: puts the picture on the clipboard and says in a toast how it went. Never rejects. */
export async function copyImage(image: Promise<DiagramImage>): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const { file, width, height } = await image;
    await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
    ui.showToast({ title: t('toast.copied.title'), description: `${width} × ${height} px` });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}

/** Copy in the Export Schema dialog: puts the text on the clipboard and says in a toast how it went. Never rejects. */
export async function copyExport(text: string): Promise<void> {
  const ui = useUiStore.getState();
  try {
    await navigator.clipboard.writeText(text);
    ui.showToast({ title: t('toast.copied.title'), description: t('count.lines', { count: countLines(text) }) });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}
