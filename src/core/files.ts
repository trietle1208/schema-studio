import { versionLabel } from './versions';

// The files a schema is imported from and exported to: their names and sizes.

/** What a schema is exported as: its DDL, its model, its diagram as a picture, or sample rows for its tables. */
export type ExportFormat = 'sql' | 'json' | 'svg' | 'png' | 'seed';

/** The largest SQL file the import reads: 10 MB, as the drop zone says. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** The name a schema starts with when the SQL it is imported from suggests none. */
export const DEFAULT_IMPORT_NAME = 'imported_schema';

/** The file an export is saved as: `ecommerce_v12.sql`. A schema that is not saved yet has no version to name. */
export function exportFileName(schema: string, version: number | null, format: ExportFormat): string {
  const base = `${schema}${version === null ? '' : `_${versionLabel(version)}`}`;
  // The rows of a schema are a SQL file of their own: `ecommerce_v12_seed.sql`.
  return format === 'seed' ? `${base}_seed.sql` : `${base}.${format}`;
}

/**
 * The file a migration is saved as: `ecommerce_v11_to_v12.sql`. `to` is null when the migration
 * leads to changes that are not saved as a version yet.
 */
export function migrationFileName(schema: string, from: number, to: number | null): string {
  return `${schema}_${versionLabel(from)}_to_${to === null ? 'unsaved' : versionLabel(to)}.sql`;
}

/** The file the comparison of two versions is saved as: `ecommerce_v11_v12.diff`. */
export function diffFileName(schema: string, from: number, to: number): string {
  return `${schema}_${versionLabel(from)}_${versionLabel(to)}.diff`;
}

/** The size of `text` as a UTF-8 file. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** A file size as it is shown: `812 B`, `14.2 KB`, `3.4 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The first `max` lines of `text`, and how many lines it has in all. Short enough texts are returned as they are. */
export function firstLines(text: string, max: number): { text: string; shown: number; total: number } {
  const total = countLines(text);
  if (total <= max) return { text, shown: total, total };
  return { text: `${text.split('\n').slice(0, max).join('\n')}\n`, shown: max, total };
}

/** How many lines `text` has. The line break that ends a file does not start another line. */
export function countLines(text: string): number {
  if (!text) return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

/**
 * The schema name a file suggests: `ecommerce_prod.sql` gives `ecommerce_prod`. What a schema name
 * cannot hold becomes an underscore, and a name that would start with a digit gets a prefix.
 */
export function schemaNameFromFile(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[a-z0-9]+$/i, '');
  const name = base
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!name) return DEFAULT_IMPORT_NAME;
  return /^[0-9]/.test(name) ? `schema_${name}` : name;
}

/** `name` when no schema has it, else the first of `name_2`, `name_3`… that is free. */
export function availableName(name: string, taken: readonly string[]): string {
  let candidate = name;
  for (let n = 2; taken.includes(candidate); n++) candidate = `${name}_${n}`;
  return candidate;
}

/** A few lines of a longer text, and the number of the first of them. */
export interface Excerpt {
  text: string;
  firstLine: number;
}

/** The line numbered `line` (from 1) with `context` lines on either side, as far as the text goes. */
export function excerptAround(text: string, line: number, context: number = 3): Excerpt {
  const lines = text.split('\n');
  const first = Math.max(1, Math.min(line, lines.length) - context);
  return { text: lines.slice(first - 1, line + context).join('\n'), firstLine: first };
}
