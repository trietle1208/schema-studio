import { openLatestSchema } from '../db/schemas';
import { ecommerceSample, useSchemaStore } from './schema';
import { useUiStore } from './ui';

/**
 * Opens the schema saved last in the workspace. On first run the ecommerce sample is stored as its
 * v1 and opened. When the database cannot be read the sample stays open, unsaved, and a toast says so.
 * Never rejects.
 */
export async function openLastSchema(): Promise<void> {
  try {
    const { schema, snapshot } = await openLatestSchema(ecommerceSample, 'Sample schema');
    useSchemaStore.getState().load({
      id: schema.id,
      name: schema.name,
      engine: schema.engine,
      version: schema.version,
      ...snapshot,
    });
  } catch (error) {
    console.error(error);
    useUiStore.getState().showToast({
      tone: 'error',
      title: 'Could not open saved schemas',
      description: 'Browser storage is unavailable. The sample schema is open instead.',
    });
  }
}
