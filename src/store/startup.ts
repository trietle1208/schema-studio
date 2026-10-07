import { openLatestSchema } from '../db/schemas';
import { useSchemaStore } from './schema';
import { useUiStore } from './ui';

/**
 * Opens the schema saved last in the workspace; while nothing is stored the app starts on the
 * schema list. When the database cannot be read the ecommerce sample stays open, unsaved, and a
 * toast says so. Never rejects.
 */
export async function openLastSchema(): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const stored = await openLatestSchema();
    if (!stored) {
      ui.showScreen('schemas');
      return;
    }
    const { schema, snapshot } = stored;
    useSchemaStore.getState().load({
      id: schema.id,
      name: schema.name,
      engine: schema.engine,
      version: schema.version,
      ...snapshot,
    });
    ui.showScreen('workspace');
  } catch (error) {
    console.error(error);
    ui.showScreen('workspace');
    ui.showToast({
      tone: 'error',
      title: 'Could not open saved schemas',
      description: 'Browser storage is unavailable. The sample schema is open instead.',
    });
  }
}
