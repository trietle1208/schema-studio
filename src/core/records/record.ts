import { t } from '../i18n';
import type { Column, Table } from '../model';
import { incomingRelations, outgoingRelations, type Relation } from '../relations';
import { cellKind } from './cells';
import { canon, fieldMeta, formatMoment, isClockDefault, literalDefault, type FieldMeta, type RecordData, type RecordValues } from './fields';
import { isJsonObject, parseJson, type JsonValue } from './json';
import type { RecordValue, Row } from '.';

// One record as the editor handles it: what it is called, how a new one starts, how it becomes a
// row, how it reads as JSON, and which rows point at it.

/** What a column is, in one line under its name in the editor: `VARCHAR(255) · Unique · Required`. */
export function typeLine(c: Column): string {
  const parts = [c.type];
  if (c.pk) parts.push(t('grid.primaryKey'));
  if (c.fk) parts.push(t('grid.foreignKey'));
  if (c.unique && !c.pk) parts.push(t('record.type.unique'));
  if (!c.nullable && !c.pk) parts.push(t('record.type.required'));
  if (c.default) parts.push(t('record.type.default', { value: c.default }));
  return parts.join(' · ');
}

/** `users · id = 101`: what a record is called. A table without a primary key names it by its first column. */
export function recordLabel(table: Pick<Table, 'name' | 'columns'>, row: Row): string {
  const keys = table.columns.filter((c) => c.pk);
  const named = keys.length ? keys : table.columns.slice(0, 1);
  return `${table.name} · ${named.map((k) => `${k.name} = ${row[k.name] == null ? 'NULL' : row[k.name]}`).join(', ')}`;
}

/** What a new record starts with: the literal defaults filled in and NULL where a column may be empty; the rest is left to the database. */
export function initialValues(table: Table, metas: readonly FieldMeta[]): RecordValues {
  const out: RecordValues = {};
  table.columns.forEach((c, i) => {
    if (metas[i].kind === 'generated') return;
    const d = literalDefault(c);
    if (d !== undefined) out[c.name] = d;
    else if (c.nullable && !c.pk && !c.default) out[c.name] = null;
  });
  return out;
}

/**
 * The row a new record becomes: what the database fills in (the next number of a counter, `now()`)
 * is filled in the way it would be. `now` is a time in ms, the clock when left out.
 */
export function completeRecord(table: Table, rows: readonly Row[], values: RecordValues, now: number = Date.now()): Row {
  const out: Row = {};
  for (const c of table.columns) {
    const meta = fieldMeta(c, rows);
    let v = values[c.name];
    if (v === undefined) {
      const d = literalDefault(c);
      if (meta.kind === 'generated') {
        v = rows.reduce((max, r) => Math.max(max, typeof r[c.name] === 'number' ? (r[c.name] as number) : 0), 0) + 1;
      } else if (d !== undefined) v = d;
      else if (isClockDefault(c)) v = formatMoment(now, meta.kind === 'time' ? meta.moment : 'timestamp');
      else v = null;
    }
    out[c.name] = canon(c, meta, v) ?? null;
  }
  return out;
}

/** The values a draft stands for: only the columns that were given one, each as the column holds it. */
export function toRecord(table: Table, metas: readonly FieldMeta[], draft: RecordValues): RecordValues {
  const out: RecordValues = {};
  table.columns.forEach((c, i) => {
    if (draft[c.name] !== undefined) out[c.name] = canon(c, metas[i], draft[c.name]);
  });
  return out;
}

/** `row` with the values that were set over it: what saving the editor does to a record that exists. */
export function mergeRecord(row: Row, values: RecordValues): Row {
  const out: Row = { ...row };
  for (const [name, v] of Object.entries(values)) if (v !== undefined) out[name] = v;
  return out;
}

/** The record as the text of the JSON tab; a JSON column holds its text, which is written as the JSON it is. */
export function recordJson(table: Table, metas: readonly FieldMeta[], draft: RecordValues): string {
  const o: Record<string, JsonValue | undefined> = {};
  table.columns.forEach((c, i) => {
    const raw = canon(c, metas[i], draft[c.name]);
    if (raw === undefined) return;
    let v: JsonValue = raw;
    if (metas[i].kind === 'json' && typeof raw === 'string') {
      const r = parseJson(raw);
      if (r.ok) v = r.value;
    }
    o[c.name] = v;
  });
  return JSON.stringify(o, null, 2);
}

/** The draft after the JSON was edited: a column left out of it keeps its value, one that is generated or does not exist is not changed. */
export function fromJson(table: Table, metas: readonly FieldMeta[], current: RecordValues, obj: { [key: string]: JsonValue }): RecordValues {
  const next: RecordValues = { ...current };
  table.columns.forEach((c, i) => {
    if (!Object.hasOwn(obj, c.name) || metas[i].kind === 'generated') return;
    let v: JsonValue = obj[c.name];
    if (v !== null && typeof v === 'object') {
      // The same JSON keeps the text it had, so that formatting is not lost by editing another column.
      const cur = current[c.name];
      const was = typeof cur === 'string' ? parseJson(cur) : null;
      v = metas[i].kind === 'json' && was?.ok && JSON.stringify(was.value) === JSON.stringify(v) ? (cur as string) : JSON.stringify(v);
    } else if (metas[i].kind === 'json' && v !== null && typeof v !== 'string') v = JSON.stringify(v);
    next[c.name] = v as RecordValue;
  });
  return next;
}

/** What the JSON tab says of the keys it ignores. */
export function jsonNotes(table: Table, metas: readonly FieldMeta[], current: RecordValues, obj: { [key: string]: JsonValue }): string[] {
  const notes: string[] = [];
  for (const k of Object.keys(obj)) {
    const i = table.columns.findIndex((c) => c.name === k);
    if (i < 0) notes.push(t('record.jsonNote.unknown', { name: k, table: table.name }));
    else if (metas[i].kind === 'generated' && current[k] !== undefined && String(obj[k]) !== String(current[k])) {
      notes.push(t('record.jsonNote.generated', { name: k }));
    }
  }
  return notes;
}

/** The text of the JSON tab read as a record: an object, or why it is not one (a line, or no object at all). */
export function readRecordJson(text: string): { ok: true; value: { [key: string]: JsonValue } } | { ok: false; line: number | null } {
  const r = parseJson(text);
  if (!r.ok) return { ok: false, line: r.line };
  return isJsonObject(r.value) ? { ok: true, value: r.value } : { ok: false, line: null };
}

/** What the grid and the editor know a row by across edits: its primary key, or its first column without one. */
export function rowKey(table: Pick<Table, 'columns'>, row: Row): string {
  const keys = table.columns.filter((c) => c.pk);
  return JSON.stringify((keys.length ? keys : table.columns.slice(0, 1)).map((c) => row[c.name] ?? null));
}

/** What a duplicate of a row starts from: every value but the ones the database counts. */
export function duplicateValues(table: Table, row: Row): RecordValues {
  const out: RecordValues = {};
  for (const c of table.columns) if (fieldMeta(c, []).kind !== 'generated') out[c.name] = row[c.name] ?? null;
  return out;
}

/** Rows as JSON for the clipboard: one row is an object, several are a list; a JSON column is written as the JSON it holds. */
export function rowsJson(table: Pick<Table, 'columns'>, rows: readonly Row[]): string {
  const json = new Set(table.columns.filter((c) => /^JSONB?\b/i.test(c.type)).map((c) => c.name));
  const one = (row: Row) =>
    Object.fromEntries(
      table.columns.map((c) => {
        const v = row[c.name] ?? null;
        const parsed = json.has(c.name) && typeof v === 'string' ? parseJson(v) : null;
        return [c.name, parsed?.ok ? parsed.value : v];
      }),
    );
  return JSON.stringify(rows.length === 1 ? one(rows[0]) : rows.map(one), null, 2);
}

// ------------------------------------------------------------------------------------- related

/** One foreign key seen from a record, with the rows it holds. */
export interface RelatedRows {
  relation: Relation;
  /** `out:user_id` or `in:orders.user_id`: the key of a disclosure. */
  key: string;
  dir: 'out' | 'in';
  /** The table whose rows these are, and its columns. */
  table: Table;
  rows: Row[];
}

/** The rows `record` points at (`out`) and the rows that point at it (`inn`), through each foreign key. A table that is not in `tables` or `data` is left out. */
export function relatedOf(table: Table, record: Row, tables: readonly Table[], data: RecordData): { out: RelatedRows[]; inn: RelatedRows[] } {
  const byName = new Map(tables.map((x) => [x.name, x]));
  const make = (dir: 'out' | 'in') => (relation: Relation): RelatedRows | null => {
    const other = byName.get(dir === 'in' ? relation.from.table : relation.to.table);
    const list = other && data[other.name];
    if (!other || !list) return null;
    const own = dir === 'in' ? relation.to.column : relation.from.column;
    const there = dir === 'in' ? relation.from.column : relation.to.column;
    const key = record[own];
    return {
      relation,
      key: dir === 'in' ? `in:${relation.from.table}.${relation.from.column}` : `out:${relation.from.column}`,
      dir,
      table: other,
      rows: key == null ? [] : list.filter((x) => x[there] != null && String(x[there]) === String(key)),
    };
  };
  const present = (x: RelatedRows | null): x is RelatedRows => x !== null;
  return {
    out: outgoingRelations(table).map(make('out')).filter(present),
    inn: incomingRelations(table, tables).map(make('in')).filter(present),
  };
}

const LABEL_NAMES = ['email', 'name', 'title', 'sku', 'slug', 'code', 'label', 'username'];

/** The column that names a row of a table in a list: its email, name, title… or the first text column that is not a key. */
export function labelColumn(table: Pick<Table, 'columns'>): string | null {
  for (const name of LABEL_NAMES) {
    const c = table.columns.find((x) => x.name === name && !x.pk);
    if (c) return c.name;
  }
  const any = table.columns.find((x) => !x.pk && !x.fk && cellKind(x.type) === 'text' && !/^JSONB?\b/i.test(x.type));
  return any ? any.name : null;
}
