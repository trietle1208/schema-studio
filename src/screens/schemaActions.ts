import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import { arrangeTables } from '../core/arrange';
import { t } from '../core/i18n';
import type { SchemaSnapshot, Table } from '../core/model';
import { SCHEMAS_ROUTE } from '../core/routes';
import { summarize } from '../core/summary';
import type { SchemaRecord } from '../db/db';
import { createSchema, deleteSchema as removeSchema, type NewSchema } from '../db/schemas';
import { ecommerceSample, selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go, openStored } from './navigation';

/** Runs `then` once the open schema may be replaced: at once, or after its unsaved changes are given up. */
function leaveOpenSchema(then: () => void) {
  if (!selectDirty(useSchemaStore.getState())) then();
  else useUiStore.getState().openDialog({ kind: 'discard-changes', onDiscard: then });
}

/** ⌘N and the New Schema buttons: asks for the name of a new schema. */
export function requestNewSchema() {
  leaveOpenSchema(() => useUiStore.getState().openDialog({ kind: 'new-schema' }));
}

export interface NewSchemaInput extends NewSchema {
  /** Starts the schema with the tables of the ecommerce sample instead of none. */
  sample?: boolean;
}

/**
 * Stores a new schema with `snapshot` as its v1 and opens it in the workspace. Resolves with
 * whether it did; a failure is reported in a toast titled `failure` and leaves the dialog open.
 */
async function createAndOpen(schema: NewSchema, snapshot: SchemaSnapshot, message: string, failure: string): Promise<boolean> {
  const ui = useUiStore.getState();
  try {
    const stored = await createSchema(schema, snapshot, message);
    ui.closeDialog();
    openStored({ schema: stored, snapshot });
    go({ screen: 'workspace', schema: stored.name });
    return true;
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: failure, description: error instanceof Error ? error.message : undefined });
    return false;
  }
}

/**
 * The confirmed New Schema dialog: stores the schema as its v1 and opens it in the workspace.
 * Resolves with whether it did; a failure is reported in a toast and leaves the dialog open.
 */
export function createNewSchema({ sample, ...schema }: NewSchemaInput): Promise<boolean> {
  const snapshot: SchemaSnapshot = sample
    ? { tables: ecommerceTables, positions: ecommercePositions }
    : { tables: [], positions: {} };
  return createAndOpen(schema, snapshot, sample ? t('version.message.sample') : t('version.message.new'), t('toast.createFailed.title'));
}

/** ⌘I and the Import buttons: asks for the SQL of a schema to import. */
export function requestImport() {
  leaveOpenSchema(() => useUiStore.getState().openDialog({ kind: 'import-schema' }));
}

export interface ImportInput extends NewSchema {
  /** The tables the SQL parsed to. */
  tables: Table[];
  /** The name of the file the SQL came from; left out for pasted SQL. */
  file?: string;
  /** The database the tables were read from, as it is named: `shop @ localhost:5432`. */
  database?: string;
}

/**
 * The confirmed Import Schema dialog: arranges the tables by their relationships (a grid when
 * there are none), stores them as v1 of a new schema and opens it in the workspace, fitted to the
 * screen. Resolves with whether it did; a failure is reported in a toast and leaves the dialog open.
 */
export async function importSchema({ tables, file, database, ...schema }: ImportInput): Promise<boolean> {
  const ui = useUiStore.getState();
  const snapshot: SchemaSnapshot = { tables, positions: arrangeTables(tables) };
  const message = file
    ? t('version.message.importedFile', { file })
    : database
      ? t('version.message.importedDatabase', { database })
      : t('version.message.importedPasted');
  if (!(await createAndOpen(schema, snapshot, message, t('toast.importFailed.title')))) return false;
  ui.setFitPending(true);
  ui.showToast({ title: t('toast.imported.title', { name: schema.name }), description: summarize(tables) });
  return true;
}

/** ⌫ and "Delete schema" in the schema list: deleting a schema is confirmed in a dialog first. */
export function requestDeleteSchema(schema: SchemaRecord) {
  // Versions count up from 1 and are never removed one by one, so the number of the current one is how many there are.
  useUiStore.getState().openDialog({ kind: 'delete-schema', id: schema.id, name: schema.name, versions: schema.version });
}

/** The confirmed delete: removes the schema and its versions from the database. It cannot be undone. */
export async function deleteSchema(id: number): Promise<void> {
  const ui = useUiStore.getState();
  const dialog = ui.dialog?.kind === 'delete-schema' && ui.dialog.id === id ? ui.dialog : null;
  ui.closeDialog();
  try {
    await removeSchema(id);
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: t('toast.deleteSchemaFailed.title'),
      description: t('toast.deleteSchemaFailed.description'),
    });
    return;
  }
  // The open schema is gone with its unsaved changes: nothing is open, as on first run.
  if (useSchemaStore.getState().id === id) {
    useSchemaStore.getState().load(ecommerceSample);
    go(SCHEMAS_ROUTE);
  }
  ui.showToast({
    tone: 'info',
    title: dialog ? t('toast.schemaDeleted.title', { name: dialog.name }) : t('toast.schemaDeleted.titleUnnamed'),
    description: dialog ? t('toast.schemaDeleted.description', { count: dialog.versions }) : undefined,
  });
}
