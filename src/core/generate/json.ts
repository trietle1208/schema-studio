import type { Table } from '../model';
import type { GenerateOptions } from './options';

/** What the JSON says about the schema besides its tables. */
export interface JsonSchemaInfo {
  name: string;
  /** The saved version the tables are from; null for a schema that has not been saved. */
  version: number | null;
  engine: string;
}

export type JsonOptions = Pick<GenerateOptions, 'indexes' | 'foreignKeys' | 'comments'>;

/** A value on one line: `{ "name": "id", "type": "BIGSERIAL", "pk": true }`. */
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** A list with one item per line, each indented by `indent`; `[]` when it is empty. */
function list(items: string[], indent: string): string {
  return items.length ? `[\n${items.map((item) => `${indent}  ${item}`).join(',\n')}\n${indent}]` : '[]';
}

/**
 * The model as JSON, for tooling and CI: the schema's name, version and dialect, and every table
 * with its columns and indexes. A column lists only the flags that are set, so a column without
 * `nullable` is NOT NULL. Canvas positions and inferred foreign keys are not part of it.
 */
export function generateJson(info: JsonSchemaInfo, tables: readonly Table[], options: JsonOptions): string {
  const items = tables.map((table) => {
    const columns = table.columns.map((c) =>
      inline({
        name: c.name,
        type: c.type,
        nullable: c.nullable ? true : undefined,
        pk: c.pk ? true : undefined,
        unique: c.unique ? true : undefined,
        default: c.default?.trim() ? c.default : undefined,
        comment: options.comments && c.comment?.trim() ? c.comment : undefined,
        fk: options.foreignKeys && c.fk && !c.fk.inferred ? { table: c.fk.table, column: c.fk.column, onDelete: c.fk.onDelete } : undefined,
      }),
    );
    const fields = [
      `"name": ${JSON.stringify(table.name)}`,
      ...(table.schema ? [`"schema": ${JSON.stringify(table.schema)}`] : []),
      ...(options.comments && table.comment?.trim() ? [`"comment": ${JSON.stringify(table.comment)}`] : []),
      `"columns": ${list(columns, '      ')}`,
      ...(options.indexes
        ? [`"indexes": ${list((table.indexes ?? []).map((i) => inline({ name: i.name, type: i.type, using: i.using, columns: i.columns })), '      ')}`]
        : []),
    ];
    return `{\n${fields.map((field) => `      ${field}`).join(',\n')}\n    }`;
  });
  return [
    '{',
    `  "schema": ${JSON.stringify(info.name)},`,
    `  "version": ${JSON.stringify(info.version)},`,
    `  "dialect": ${JSON.stringify(info.engine.toLowerCase())},`,
    `  "tables": ${list(items, '  ')}`,
    '}',
    '',
  ].join('\n');
}
