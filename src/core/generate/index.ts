import { postgresGenerator } from './postgres';
import type { SqlGenerator } from './options';

export { DEFAULT_GENERATE_OPTIONS, type GenerateOptions, type SqlGenerator } from './options';

const GENERATORS: readonly SqlGenerator[] = [postgresGenerator];

/** The generator for an engine, or null when its DDL cannot be written yet. */
export function generatorFor(engine: string): SqlGenerator | null {
  return GENERATORS.find((g) => g.engine === engine) ?? null;
}

/** The engines whose DDL can be exported. */
export const EXPORT_ENGINES: readonly string[] = GENERATORS.map((g) => g.engine);
