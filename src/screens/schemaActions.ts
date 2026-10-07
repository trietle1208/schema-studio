import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import type { SchemaSnapshot } from '../core/model';
import { plural } from '../core/plural';
import type { SchemaRecord } from '../db/db';
import {
  createSchema,
  deleteSchema as removeSchema,
  openSchema as readSchema,
  type NewSchema,
  type StoredSchema,
} from '../db/schemas';
import { ecommerceSample, selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

/** Shows the schema list. The open schema stays open, with its unsaved changes. */
export function showSchemas() {
  useUiStore.getState().showScreen('schemas');
}

/** Puts a stored schema in the workspace as the open one. */
function show({ schema, snapshot }: StoredSchema) {
  const ui = useUiStore.getState();
  useSchemaStore.getState().load({
    id: schema.id,
    name: schema.name,
    engine: schema.engine,
    version: schema.version,
    ...snapshot,
  });
  // The search filtered the tables of the schema that was open.
  ui.setSearch('');
  ui.showScreen('workspace');
}

/** Runs `then` once the open schema may be replaced: at once, or after its unsaved changes are given up. */
function leaveOpenSchema(then: () => void) {
  if (!selectDirty(useSchemaStore.getState())) then();
  else useUiStore.getState().openDialog({ kind: 'discard-changes', onDiscard: then });
}

async function load(id: number): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const stored = await readSchema(id);
    if (!stored) throw new Error('Schema no longer exists.');
    show(stored);
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: 'Could not open schema',
      description: 'It could not be read from browser storage.',
    });
  }
}

/**
 * A row of the schema list or the sidebar: opens the current version of a schema in the workspace.
 * Unsaved changes to another schema are confirmed away first.
 */
export function openSchema(id: number) {
  if (useSchemaStore.getState().id === id) useUiStore.getState().showScreen('workspace');
  else leaveOpenSchema(() => void load(id));
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
 * The confirmed New Schema dialog: stores the schema as its v1 and opens it in the workspace.
 * Resolves with whether it did; a failure is reported in a toast and leaves the dialog open.
 */
export async function createNewSchema({ sample, ...schema }: NewSchemaInput): Promise<boolean> {
  const ui = useUiStore.getState();
  const snapshot: SchemaSnapshot = sample
    ? { tables: ecommerceTables, positions: ecommercePositions }
    : { tables: [], positions: {} };
  try {
    const stored = await createSchema(schema, snapshot, sample ? 'Ecommerce sample' : 'New schema');
    ui.closeDialog();
    show({ schema: stored, snapshot });
    return true;
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: 'Could not create schema',
      description: error instanceof Error ? error.message : undefined,
    });
    return false;
  }
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
      title: 'Could not delete schema',
      description: 'It could not be removed from browser storage.',
    });
    return;
  }
  // The open schema is gone with its unsaved changes: nothing is open, as on first run.
  if (useSchemaStore.getState().id === id) {
    useSchemaStore.getState().load(ecommerceSample);
    ui.showScreen('schemas');
  }
  ui.showToast({
    tone: 'info',
    title: dialog ? `Deleted schema ${dialog.name}` : 'Deleted schema',
    description: dialog ? `${plural(dialog.versions, 'version')} removed from this browser.` : undefined,
  });
}
