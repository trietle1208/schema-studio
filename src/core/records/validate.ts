import { t } from '../i18n';
import type { Column, Table } from '../model';
import { cellKind } from './cells';
import {
  canon,
  compositeKeys,
  fieldMeta,
  isIntegerType,
  isTextField,
  isUnique,
  typeLength,
  typeScale,
  validMoment,
  type FieldMeta,
  type RecordData,
  type RecordValues,
} from './fields';
import { parseJson } from './json';
import type { Row } from '.';

/** What is wrong with a record, by column name; a column that is fine is not there. */
export type RecordProblems = Record<string, string>;

export interface ValidateContext {
  /** `edit` for a record that exists, `new` for one being made: a new record leaves out what the database fills in. */
  mode?: 'edit' | 'new';
  /** The rows of the table, for unique keys; the table's rows in `data` when left out. */
  rows?: readonly Row[];
  /** The row being edited, which does not clash with itself. */
  record?: Row | null;
  /** The rows of every table, for foreign keys. */
  data?: RecordData;
  /** `fieldMeta` of each column, when the caller has them already. */
  metas?: readonly FieldMeta[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first thing wrong with a value, in the words of the form; null when it is fine. */
function columnProblem(table: Table, c: Column, meta: FieldMeta, raw: RecordValues[string], ctx: ValidateContext, rows: readonly Row[]): string | null {
  const v = canon(c, meta, raw);
  const nullable = !!c.nullable && !c.pk;
  const empty = () => (nullable ? null : t('record.problem.empty', { name: c.name }));
  if (raw === undefined && ctx.mode === 'new') return nullable || c.default ? null : empty();
  if (v === null || v === undefined || v === '') return empty();

  const text = String(v);
  if (meta.kind === 'number' || (meta.kind === 'reference' && cellKind(c.type) === 'number')) {
    if (typeof v !== 'number') return t('record.problem.number');
    if (isIntegerType(c.type) && !Number.isInteger(v)) return t('record.problem.whole');
    const scale = typeScale(c.type);
    if (scale !== null && (text.split('.')[1] ?? '').length > scale) return t('record.problem.decimals', { scale });
  } else if (meta.kind === 'boolean') {
    if (typeof v !== 'boolean') return t('record.problem.boolean');
  } else if (meta.kind === 'time') {
    if (!validMoment(meta.moment, text)) return t(`record.problem.${meta.moment}`);
  } else if (meta.kind === 'enum') {
    if (meta.fixed && !meta.options.includes(text)) return t('record.problem.enum', { values: meta.options.join(', ') });
    const max = typeLength(c.type);
    if (max !== null && text.length > max) return t('record.problem.length', { max });
  } else if (meta.kind === 'json') {
    const r = parseJson(text);
    if (!r.ok) return t('record.problem.json', { line: r.line });
  } else if (isTextField(meta)) {
    const max = typeLength(c.type);
    if (max !== null && text.length > max) return t('record.problem.length', { max });
    if (/(^|_)email$/i.test(c.name) && !EMAIL.test(text)) return t('record.problem.email');
  }

  const target = c.fk && ctx.data?.[c.fk.table];
  if (c.fk && target && !target.some((x) => x[c.fk!.column] != null && String(x[c.fk!.column]) === text)) {
    return t('record.problem.reference', { table: c.fk.table, column: c.fk.column, value: text });
  }
  if (isUnique(table, c) && rows.some((x) => x !== ctx.record && x[c.name] != null && String(x[c.name]) === text)) {
    return t('record.problem.unique', { column: c.name, value: text });
  }
  return null;
}

/**
 * What is wrong with the values of a record, by column name, one message (the first) for a column.
 * Generated columns are never wrong. The record itself never clashes with itself, and NULL never clashes.
 */
export function validateRecord(table: Table, values: RecordValues, ctx: ValidateContext = {}): RecordProblems {
  const rows = ctx.rows ?? ctx.data?.[table.name] ?? [];
  const metas = ctx.metas ?? table.columns.map((c) => fieldMeta(c, rows, ctx.data));
  const problems: RecordProblems = {};
  table.columns.forEach((c, i) => {
    if (metas[i].kind === 'generated') return;
    const message = columnProblem(table, c, metas[i], values[c.name], ctx, rows);
    if (message) problems[c.name] = message;
  });

  // A key of several columns is held to one row as a whole, and told on the last of its columns
  // that has nothing else wrong. A key with a value that is NULL or not given never clashes.
  for (const key of compositeKeys(table)) {
    const at = key.map((name) => table.columns.findIndex((c) => c.name === name));
    const given = at.map((i) => canon(table.columns[i], metas[i], values[table.columns[i].name]));
    if (given.some((v) => v === undefined || v === null || v === '')) continue;
    const clash = rows.some((x) => x !== ctx.record && key.every((name, k) => x[name] != null && String(x[name]) === String(given[k])));
    const shown = [...key].reverse().find((name, k) => !problems[name] && metas[at[key.length - 1 - k]].kind !== 'generated');
    if (clash && shown) problems[shown] = t('record.problem.uniqueKey', { pairs: key.map((name, k) => `${name} "${given[k]}"`).join(', ') });
  }
  return problems;
}
