import { t } from '../i18n';
import type { Column, ForeignKey, Index, Table } from '../model';
import type { Token } from './lexer';
import type { ParseError } from './index';

// What the parsers share: the tables as they are while a script is being read, the questions
// asked of a token, and the last steps that turn the drafts into the model.

/** Stands for the referenced table's primary key in `REFERENCES orders`, which names no column. */
export const PRIMARY_KEY = '?';

export interface DraftColumn {
  name: string;
  type: string;
  nullable: boolean;
  pk: boolean;
  unique: boolean;
  default?: string;
  comment?: string;
  fk?: ForeignKey;
}

export interface DraftTable {
  name: string;
  schema: string;
  comment: string;
  columns: DraftColumn[];
  indexes: Index[];
}

/** Stops the import at the first problem. */
export class Failure extends Error {
  readonly error: ParseError;

  constructor(error: ParseError) {
    super(error.message);
    this.error = error;
  }
}

export function isName(token: Token | undefined): boolean {
  return !!token && (token.kind === 'word' || token.kind === 'quoted');
}

export function isSymbol(token: Token | undefined, text: string): boolean {
  return !!token && token.kind === 'symbol' && token.text === text;
}

export function isWord(token: Token | undefined, word: string): boolean {
  return !!token && token.kind === 'word' && token.upper === word;
}

/** The index of the `)` that closes the `(` at `open`, or -1 when it is never closed. */
export function closing(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    if (isSymbol(tokens[i], '(')) depth++;
    else if (isSymbol(tokens[i], ')') && --depth === 0) return i;
  }
  return -1;
}

/** Drops the foreign keys that point at nothing, and gives the ones without a column their key. */
export function resolveForeignKeys(tables: ReadonlyMap<string, DraftTable>, warnings: string[]) {
  for (const table of tables.values()) {
    for (const column of table.columns) {
      const fk = column.fk;
      if (!fk) continue;
      const path = `${table.name}.${column.name}`;
      const target = tables.get(fk.table);
      const keys = target?.columns.filter((c) => c.pk) ?? [];
      if (!target) {
        warnings.push(t('parse.warn.fkUndefined', { column: path, target: fk.table }));
        delete column.fk;
      } else if (fk.column === PRIMARY_KEY && keys.length !== 1) {
        warnings.push(t('parse.warn.fkNoSingleKey', { column: path, target: fk.table }));
        delete column.fk;
      } else if (fk.column === PRIMARY_KEY) {
        fk.column = keys[0].name;
      } else if (!target.columns.some((c) => c.name === fk.column)) {
        warnings.push(t('parse.warn.fkUndefined', { column: path, target: `${fk.table}.${fk.column}` }));
        delete column.fk;
      }
    }
  }
}

/** A column as the model keeps it: flags and texts that are not set are left out. */
function finishColumn(draft: DraftColumn): Column {
  return {
    name: draft.name,
    type: draft.type,
    nullable: draft.nullable,
    ...(draft.pk ? { pk: true } : {}),
    ...(draft.unique ? { unique: true } : {}),
    ...(draft.default !== undefined ? { default: draft.default } : {}),
    ...(draft.comment ? { comment: draft.comment } : {}),
    ...(draft.fk ? { fk: draft.fk } : {}),
  };
}

/** The tables as the model keeps them, in the order they were created. A table without a primary key gets a warning. */
export function finishTables(tables: ReadonlyMap<string, DraftTable>, warnings: string[]): Table[] {
  return [...tables.values()].map((table) => {
    if (!table.columns.some((c) => c.pk)) warnings.push(t('parse.warn.noPrimaryKey', { table: table.name }));
    return { name: table.name, schema: table.schema, comment: table.comment, columns: table.columns.map(finishColumn), indexes: table.indexes };
  });
}
