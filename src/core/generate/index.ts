import { mysqlGenerator } from './mysql';
import { mysqlMigrator } from './mysqlMigration';
import { postgresGenerator } from './postgres';
import { postgresMigrator } from './postgresMigration';
import type { SqlGenerator, SqlMigrator } from './options';

export {
  DEFAULT_GENERATE_OPTIONS,
  type DdlBlock,
  type DestructiveChange,
  type GenerateOptions,
  type MigrateOptions,
  type Migration,
  type SqlGenerator,
  type SqlMigrator,
} from './options';

const GENERATORS: readonly SqlGenerator[] = [postgresGenerator, mysqlGenerator];

/** The generator for an engine, or null when its DDL cannot be written yet. */
export function generatorFor(engine: string): SqlGenerator | null {
  return GENERATORS.find((g) => g.engine === engine) ?? null;
}

/** The engines whose DDL can be exported. */
export const EXPORT_ENGINES: readonly string[] = GENERATORS.map((g) => g.engine);

const MIGRATORS: readonly SqlMigrator[] = [postgresMigrator, mysqlMigrator];

/** The migrator for an engine, or null when its migrations cannot be written yet. */
export function migratorFor(engine: string): SqlMigrator | null {
  return MIGRATORS.find((m) => m.engine === engine) ?? null;
}
