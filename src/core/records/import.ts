import { t } from '../i18n';
import type { Column, Table } from '../model';
import { convertValue, detectDateOrder, parseMoment, type ConvertProblemKind, type DateOrder, type SourceCell } from './convert';
import { fieldMeta, isGenerated, isUnique, type RecordData } from './fields';
import { sampleCells, type RecordsSource } from './importFile';
import type { RecordValue, Row } from '.';

// What importing a file into a table would do: which column of the file fills which column of the
// table, and what becomes of each row, checked the way the database would. Nothing is written
// here; the dialog shows this and a later step plays it.

/** `mode`: what a row does when its unique key exists. `key`: the unique column an upsert goes by (the first one the file fills when empty). */
export interface ImportSettings {
  mode: 'insert' | 'upsert' | 'skip';
  key: string;
  emptyNull: boolean;
  skipInvalid: boolean;
  checkFk: boolean;
  stopOnError: boolean;
  oneTx: boolean;
}

export const IMPORT_DEFAULTS: ImportSettings = { mode: 'insert', key: '', emptyNull: true, skipInvalid: true, checkFk: true, stopOnError: false, oneTx: true };

/** `from` in a mapping that stands for a value typed in, kept in `value`. */
export const CONSTANT = '=';

/** How a column was matched: by its name, by a name that holds its name, or as the only date column for the only date column. */
export type MatchWhy = 'same' | 'similar' | 'type';

/** Where a column of the table gets its value: a column of the file, '' for none, or the constant. */
export interface ColumnMap {
  from: string;
  by: 'auto' | 'manual';
  why?: MatchWhy;
  value?: string;
}

/** By the name of the column of the table. */
export type ImportMapping = Record<string, ColumnMap>;

// ------------------------------------------------------------------------------------- mapping

/** The words of a name, lower case and without accents: `fullName`, `Full_Name` and `Họ tên` are `full name`, `full name` and `ho ten`. */
function words(name: string): string[] {
  return name
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function looksLikeDates(src: Pick<RecordsSource, 'rows'>, k: number, kind: Parameters<typeof parseMoment>[0]): boolean {
  const cells = sampleCells(src, k, 50);
  const order = detectDateOrder(cells);
  return cells.length > 0 && cells.filter((v) => parseMoment(kind, String(v), order) !== null).length >= cells.length * 0.9;
}

/**
 * The mapping the dialog starts from. A column the database generates is never filled. Matched in
 * this order: the same name, ignoring case, accents and `_` (`Full_Name`, `fullname`); a name
 * that holds every word of the name (`full_name` for `name`); and the one date column of the file
 * for the one date column left in the table (`signup_date` for `created_at`).
 */
export function mapColumns(table: Table, src: Pick<RecordsSource, 'columns' | 'rows'>, data?: RecordData): ImportMapping {
  const existing = data?.[table.name] ?? [];
  const names = src.columns;
  const used = new Set<number>();
  const out: ImportMapping = {};
  for (const c of table.columns) out[c.name] = { from: '', by: 'auto' };
  const open = table.columns.filter((c) => !isGenerated(c));
  const take = (c: Column, i: number, why: MatchWhy) => {
    out[c.name] = { from: names[i], by: 'auto', why };
    used.add(i);
  };
  for (const c of open) {
    const want = words(c.name).join('');
    const i = names.findIndex((n, k) => !used.has(k) && words(n).join('') === want);
    if (i >= 0) take(c, i, 'same');
  }
  for (const c of open) {
    if (out[c.name].from) continue;
    const have = words(c.name);
    const i = names.findIndex((n, k) => {
      const w = words(n);
      return !used.has(k) && have.length > 0 && have.every((x) => w.includes(x));
    });
    if (i >= 0) take(c, i, 'similar');
  }
  const dates = open.filter((c) => !out[c.name].from && fieldMeta(c, existing, data).kind === 'time');
  if (dates.length === 1) {
    const meta = fieldMeta(dates[0], existing, data);
    const kind = meta.kind === 'time' ? meta.moment : 'timestamp';
    const like = names.map((_, k) => k).filter((k) => !used.has(k) && looksLikeDates(src, k, kind));
    if (like.length === 1) take(dates[0], like[0], 'type');
  }
  return out;
}

// ------------------------------------------------------------------------------------- analysis

/** What the review groups a problem by. */
export type ProblemKind = ConvertProblemKind | 'duplicate' | 'fk';

export const PROBLEM_KINDS: readonly ProblemKind[] = ['required', 'duplicate', 'type', 'fk', 'date'];

/** One problem of one row: `line` is where the row is in the file (`unit` of the source). */
export interface ImportIssue {
  line: number;
  column: string;
  value: SourceCell | undefined;
  message: string;
}

/**
 * What a row becomes: `insert` and `update` are written; `skip` is a duplicate left out on purpose;
 * `conflict` is a duplicate that insert-only cannot take (a warning); `invalid` has an error.
 */
export type RowKind = 'insert' | 'update' | 'skip' | 'conflict' | 'invalid';

export interface ImportRow {
  line: number;
  /** The position among the rows of the file, from 0. */
  index: number;
  kind: RowKind;
  /** What is written. A column that is not in it takes its default. */
  values: Record<string, RecordValue>;
  problems: { column: string; kind: ConvertProblemKind | 'fk'; value: SourceCell | undefined; message: string }[];
  conflict: { column: string; row?: Row; message: string } | null;
  /** The row an `update` overwrites. */
  match: Row | null;
}

export interface ImportCounts {
  total: number;
  /** `insert` and `update`: the rows that are written. */
  valid: number;
  insert: number;
  update: number;
  skip: number;
  warnings: number;
  errors: number;
}

export interface ImportAnalysis {
  rows: ImportRow[];
  groups: Record<ProblemKind, (ImportIssue & { kind?: RowKind })[]>;
  counts: ImportCounts;
  /** The columns of the table that get a value from the file or a constant. */
  filled: string[];
  /** The columns that cannot be NULL and that nothing fills: an error on every row. */
  missing: string[];
  /** The unique columns the file fills: what an upsert can go by. */
  keys: string[];
  /** The one it goes by. */
  key: string;
}

/**
 * What the import would do with each row of `src`, as the database would take it. `mapping` is
 * what `mapColumns` gave, edited; `data` holds the rows of every table, which unique keys and
 * foreign keys are checked against. Dates like `03/04/2026` are read the way the whole column
 * writes them (see `detectDateOrder`).
 */
export function analyzeImport(
  table: Table,
  src: RecordsSource,
  mapping: ImportMapping,
  settings: Partial<ImportSettings> = {},
  data?: RecordData,
): ImportAnalysis {
  const set: ImportSettings = { ...IMPORT_DEFAULTS, ...settings };
  const existing = data?.[table.name] ?? [];
  const cols = table.columns;
  const metas = cols.map((c) => fieldMeta(c, existing, data));

  type Feed = { constant: string } | { at: number; order: DateOrder };
  const feeds = cols.map((c, i): Feed | null => {
    const m = mapping[c.name];
    if (isGenerated(c) || !m || !m.from) return null;
    if (m.from === CONSTANT) return { constant: m.value ?? '' };
    const at = src.columns.indexOf(m.from);
    if (at < 0) return null;
    return { at, order: metas[i].kind === 'time' ? detectDateOrder(src.rows.map((r) => r[at])) : 'dmy' };
  });

  const keyAt: number[] = [];
  const filled: string[] = [];
  const missing: string[] = [];
  cols.forEach((c, i) => {
    if (feeds[i]) {
      filled.push(c.name);
      if (isUnique(table, c)) keyAt.push(i);
    } else if (!isGenerated(c) && !c.nullable && !c.default) missing.push(c.name);
  });
  const keys = keyAt.map((i) => cols[i].name);
  const key = keys.includes(set.key) ? set.key : (keys[0] ?? '');

  // The keys that are taken: by the rows of the table, and by the rows of the file so far (the line they came from).
  const known = new Map<string, Map<string, Row>>();
  const seen = new Map<string, Map<string, number>>();
  for (const name of keys) {
    known.set(name, new Map(existing.filter((r) => r[name] != null).map((r) => [String(r[name]), r])));
    seen.set(name, new Map());
  }
  const targets = new Map<string, Set<string>>();
  const fkHas = (c: Column, v: RecordValue): boolean => {
    let set = targets.get(c.name);
    if (!set) {
      const list = (data?.[c.fk!.table] ?? []) as readonly Row[];
      set = new Set(list.filter((r) => r[c.fk!.column] != null).map((r) => String(r[c.fk!.column])));
      targets.set(c.name, set);
    }
    return set.has(String(v));
  };

  const groups: ImportAnalysis['groups'] = { required: [], duplicate: [], type: [], fk: [], date: [] };
  const counts: ImportCounts = { total: src.rows.length, valid: 0, insert: 0, update: 0, skip: 0, warnings: 0, errors: 0 };

  const rows = src.rows.map((cells, k): ImportRow => {
    const line = src.at[k];
    const values: Record<string, RecordValue> = {};
    const problems: ImportRow['problems'] = [];
    let conflict: ImportRow['conflict'] = null;
    cols.forEach((c, i) => {
      if (isGenerated(c)) return;
      const feed = feeds[i];
      if (!feed) {
        if (!c.nullable && !c.default) problems.push({ column: c.name, kind: 'required', value: null, message: t('import.problem.required', { name: c.name }) });
        return;
      }
      const raw = 'constant' in feed ? feed.constant : cells[feed.at];
      const res = convertValue(c, metas[i], raw, { emptyNull: set.emptyNull, dateOrder: 'at' in feed ? feed.order : undefined });
      if (res.problem) {
        problems.push({ column: c.name, kind: res.problem.kind, value: res.problem.kind === 'required' ? null : raw, message: res.problem.message });
        return;
      }
      if (res.value !== undefined) values[c.name] = res.value;
      if (res.value != null && c.fk && set.checkFk && Array.isArray(data?.[c.fk.table]) && !fkHas(c, res.value)) {
        problems.push({ column: c.name, kind: 'fk', value: res.value, message: t('record.problem.reference', { table: c.fk.table, column: c.fk.column, value: String(res.value) }) });
      }
    });

    if (!problems.length) {
      for (const name of keys) {
        const v = values[name];
        if (v == null || conflict) continue;
        const id = String(v);
        const earlier = seen.get(name)!.get(id);
        if (earlier !== undefined) {
          conflict = { column: name, message: t(src.unit === 'line' ? 'import.problem.repeat.line' : 'import.problem.repeat.row', { column: name, value: id, line: earlier }) };
        } else if (known.get(name)!.has(id)) {
          conflict = { column: name, row: known.get(name)!.get(id), message: t('record.problem.unique', { column: name, value: id }) };
        }
      }
    }

    let kind: RowKind;
    if (problems.length) kind = 'invalid';
    else if (conflict) kind = set.mode === 'skip' ? 'skip' : set.mode === 'upsert' && conflict.row && conflict.column === key ? 'update' : 'conflict';
    else kind = 'insert';
    const match = kind === 'update' && conflict?.row ? conflict.row : null;
    if (kind === 'insert' || kind === 'update') for (const name of keys) if (values[name] != null) seen.get(name)!.set(String(values[name]), line);

    for (const p of problems) groups[p.kind].push({ line, column: p.column, value: p.value, message: p.message });
    if (conflict && !problems.length) groups.duplicate.push({ line, column: conflict.column, value: values[conflict.column], message: conflict.message, kind });
    if (kind === 'insert' || kind === 'update' || kind === 'skip') counts[kind]++;
    else if (kind === 'conflict') counts.warnings++;
    else counts.errors++;
    return { line, index: k, kind, values, problems, conflict, match };
  });
  counts.valid = counts.insert + counts.update;
  return { rows, groups, counts, filled, missing, keys, key };
}

/** How many rows a group of problems touches, each once. */
export function groupRows(items: readonly { line: number }[]): number {
  return new Set(items.map((i) => i.line)).size;
}

// ------------------------------------------------------------------------------------- preview

export interface ImportPreview {
  /** The columns the file fills. */
  columns: Column[];
  rows: Row[];
  /** The cells that will not go in, by position in `rows` and column name. */
  invalid: { row: number; column: string; message: string }[];
}

/** The first `limit` rows as they would be written, for a grid; a cell with a problem shows what the file had. */
export function importPreview(table: Table, analysis: ImportAnalysis, limit = 10): ImportPreview {
  const columns = table.columns.filter((c) => analysis.filled.includes(c.name));
  const invalid: ImportPreview['invalid'] = [];
  const rows = analysis.rows.slice(0, limit).map((r, ri) => {
    const row: Row = {};
    for (const c of columns) {
      const p = r.problems.find((x) => x.column === c.name);
      if (p) {
        row[c.name] = p.value === undefined ? null : p.value;
        invalid.push({ row: ri, column: c.name, message: p.message });
      } else row[c.name] = c.name in r.values ? r.values[c.name] : (c.default ?? null);
    }
    return row;
  });
  return { columns, rows, invalid };
}

/**
 * The columns whose cells are changed on the way in: text becomes a number, a date a timestamp.
 * Judged by the first 40 cells that hold something.
 */
export function convertedColumns(table: Table, src: RecordsSource, mapping: ImportMapping, settings: Partial<ImportSettings> = {}, data?: RecordData): Set<string> {
  const set: ImportSettings = { ...IMPORT_DEFAULTS, ...settings };
  const existing = data?.[table.name] ?? [];
  const out = new Set<string>();
  for (const c of table.columns) {
    const from = mapping[c.name]?.from;
    const k = from && from !== CONSTANT ? src.columns.indexOf(from) : -1;
    if (k < 0 || isGenerated(c)) continue;
    const meta = fieldMeta(c, existing, data);
    const cells = sampleCells(src, k, 40);
    const order = detectDateOrder(cells);
    const changed = cells.some((raw) => {
      const res = convertValue(c, meta, raw, { emptyNull: set.emptyNull, dateOrder: order });
      return !res.problem && res.value !== undefined && res.value !== null && (typeof res.value !== typeof raw || String(res.value) !== String(raw));
    });
    if (changed) out.add(c.name);
  }
  return out;
}

// ------------------------------------------------------------------------------------- run

export interface ImportFail {
  line: number;
  message: string;
}

/**
 * What `runImport` wrote (or would write): the counts, and the rows to store. A transaction that
 * rolled back has empty `insert` / `update` lists.
 */
export interface ImportOutcome {
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  error: ImportFail | null;
  stopped: boolean;
  rolledBack: boolean;
  insert: Row[];
  update: { match: Row | null; values: Row }[];
}

/**
 * Plays the import over the rows of `analyzeImport` for the first `limit` rows (all when left out).
 * `fail` makes the database refuse that row (a clash that appeared after the check). A transaction
 * (or stopping on the first error) ends the run there; a transaction that ended on an error writes
 * nothing. `cancelled` ends the run where it is, with the same rule for a transaction.
 */
export function runImport(
  analysis: ImportAnalysis,
  settings: Partial<ImportSettings> = {},
  fail: ImportFail | null = null,
  limit?: number,
  cancelled = false,
): ImportOutcome {
  const set: ImportSettings = { ...IMPORT_DEFAULTS, ...settings };
  const stop = set.oneTx || set.stopOnError;
  const out: ImportOutcome = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    error: null,
    stopped: false,
    rolledBack: false,
    insert: [],
    update: [],
  };
  const max = limit == null ? analysis.rows.length : Math.min(limit, analysis.rows.length);
  for (let i = 0; i < max; i++) {
    const r = analysis.rows[i];
    out.processed++;
    if (r.kind !== 'insert' && r.kind !== 'update') {
      out.skipped++;
      continue;
    }
    if (fail && r.line === fail.line) {
      out.failed++;
      out.error = fail;
      if (stop) {
        out.stopped = true;
        break;
      }
      continue;
    }
    if (r.kind === 'insert') {
      out.inserted++;
      out.insert.push(r.values);
    } else {
      out.updated++;
      out.update.push({ match: r.match, values: r.values });
    }
  }
  if (set.oneTx && (out.stopped || cancelled)) {
    out.rolledBack = out.inserted + out.updated > 0;
    out.inserted = 0;
    out.updated = 0;
    out.insert = [];
    out.update = [];
  }
  return out;
}

function csvCell(v: SourceCell | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The error report: a CSV of every row that was left out or refused, with its line, the column and
 * the reason. English, like any file the app writes.
 */
export function importReport(analysis: ImportAnalysis, outcome: ImportOutcome | null = null): string {
  const lines = ['line,column,value,reason'];
  const items: { line: number; column: string; value: SourceCell | undefined; message: string }[] = [];
  for (const k of PROBLEM_KINDS) for (const it of analysis.groups[k]) items.push(it);
  if (outcome?.error) items.push({ line: outcome.error.line, column: '', value: '', message: outcome.error.message });
  items.sort((a, b) => a.line - b.line);
  for (const it of items) lines.push([it.line, it.column, it.value, it.message].map(csvCell).join(','));
  return `${lines.join('\n')}\n`;
}

/** `1,000 rows · 985 valid · 10 warnings · 5 errors` — English, for the summary line of Settings. */
export function importSummary(c: ImportCounts): string {
  const n = (x: number) => x.toLocaleString('en-US');
  const parts = [
    t('count.rows', { count: c.total, rows: n(c.total) }),
    t('importRecords.summary.valid', { n: n(c.valid) }),
    t('importRecords.summary.warnings', { count: c.warnings, n: n(c.warnings) }),
    t('importRecords.summary.errors', { count: c.errors, n: n(c.errors) }),
  ];
  if (c.skip) parts.push(t('importRecords.summary.skipped', { n: n(c.skip) }));
  return parts.join(' · ');
}
