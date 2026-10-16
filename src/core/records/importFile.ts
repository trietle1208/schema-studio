import { t } from '../i18n';
import { looksLikeHeader, parseCsv, sniffDelimiter, uniqueNames, type Delimiter } from './csv';
import { rowsText } from './cells';
import type { SourceCell } from './convert';
import { isJsonObject, parseJson, type JsonValue } from './json';

// A CSV or JSON file read into the shape the import works from: named columns and rows of cells.

/** The largest file Import Records reads: 50 MB, as the drop zone says. */
export const MAX_RECORDS_FILE_BYTES = 50 * 1024 * 1024;

export type SourceFormat = 'csv' | 'json';

/** What a file holds, as the dialog shows it. */
export interface RecordsSource {
  format: SourceFormat;
  /** Of a CSV; null for JSON. */
  delimiter: Delimiter | null;
  /** Whether the first row of a CSV holds the names of the columns; JSON always has names. */
  header: boolean;
  columns: string[];
  /** A row is a list of cells in the order of `columns`. */
  rows: SourceCell[][];
  /** `at[i]` is where row `i` is in the file: its line for CSV, its place in the array (from 1) for JSON; `unit` says which. */
  at: number[];
  unit: 'line' | 'row';
  /** Why the text could not be read, in the words of the app; then there are no rows. */
  error: string | null;
}

export interface ReadOptions {
  /** Overrides the delimiter that was found. */
  delimiter?: Delimiter | null;
  /** Overrides whether the first row holds names. */
  header?: boolean | null;
}

const NONE: RecordsSource = { format: 'csv', delimiter: ',', header: true, columns: [], rows: [], at: [], unit: 'line', error: null };

/**
 * The rows of a JSON text that is an array of objects (one object is one row). A key that some
 * object lacks is NULL in its row; a number or boolean keeps its type, and an object or an array
 * becomes the JSON text of it. The columns are the keys in the order they first appear.
 */
export function parseJsonRows(text: string): RecordsSource {
  const json: RecordsSource = { ...NONE, format: 'json', delimiter: null, unit: 'row' };
  const parsed = parseJson(text);
  if (!parsed.ok) return { ...json, error: t('import.error.json', { line: parsed.line }) };
  const list: JsonValue[] | null = Array.isArray(parsed.value) ? parsed.value : isJsonObject(parsed.value) ? [parsed.value] : null;
  if (!list || !list.length || !list.every(isJsonObject)) return { ...json, error: t('import.error.notObjects') };
  const columns: string[] = [];
  for (const item of list) for (const key of Object.keys(item)) if (!columns.includes(key)) columns.push(key);
  const rows = list.map((item) =>
    columns.map((key): SourceCell => {
      const v = item[key];
      return v === undefined ? null : v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    }),
  );
  return { ...json, columns, rows, at: rows.map((_, i) => i + 1) };
}

/**
 * A CSV or JSON text as a source. A text that opens with `[` or `{` is JSON; anything else is
 * CSV, whose delimiter and header row are found unless `options` says. A text that cannot be read
 * has `error`, with what was found as far as it goes.
 */
export function readRecordsFile(text: string, options: ReadOptions = {}): RecordsSource {
  if (!text.trim()) return { ...NONE, error: t('import.error.empty') };
  if (/^\uFEFF?\s*[[{]/.test(text)) return parseJsonRows(text.replace(/^\uFEFF/, ''));
  const delimiter = options.delimiter ?? sniffDelimiter(text);
  const parsed = parseCsv(text, delimiter);
  if (parsed.unclosed) return { ...NONE, delimiter, error: t('import.error.csv', { line: parsed.unclosed }) };
  if (!parsed.rows.length) return { ...NONE, delimiter, error: t('import.error.empty') };
  const header = options.header ?? looksLikeHeader(parsed.rows[0]);
  const width = parsed.rows.reduce((max, r) => Math.max(max, r.length), 0);
  const first = header ? parsed.rows[0] : [];
  const columns = uniqueNames(Array.from({ length: width }, (_, i) => first[i] ?? ''));
  const body = parsed.rows.slice(header ? 1 : 0);
  return {
    ...NONE,
    delimiter,
    header,
    columns,
    // The names are still shown, so that the first row can be taken for a row of values.
    error: body.length ? null : t('import.error.noRows'),
    // A short row is filled up with empty cells, and a cell past the last column is dropped by the width.
    rows: body.map((r) => columns.map((_, i) => r[i] ?? '')),
    at: parsed.lines.slice(header ? 1 : 0),
  };
}

/** The cells of a column that hold something, the first `n`. */
export function sampleCells(src: Pick<RecordsSource, 'rows'>, column: number, n: number): SourceCell[] {
  const out: SourceCell[] = [];
  for (const row of src.rows) {
    if (out.length >= n) break;
    const v = row[column];
    if (v !== null && v !== undefined && String(v).trim() !== '') out.push(v);
  }
  return out;
}

/** The name a delimiter goes by in the dialog's list. */
export function delimiterName(d: Delimiter): string {
  return t(`import.delimiter.${d === ',' ? 'comma' : d === ';' ? 'semicolon' : d === '\t' ? 'tab' : 'pipe'}`);
}

/** `CSV · UTF-8 · comma · 1,000 rows · header row`: what was found in a file, in a line. */
export function describeSource(src: RecordsSource): string {
  const rows = rowsText(src.rows.length);
  if (src.format === 'json') return `JSON · UTF-8 · ${rows} · ${t('count.keys', { count: src.columns.length })}`;
  return `CSV · UTF-8 · ${delimiterName(src.delimiter ?? ',').toLowerCase()} · ${rows} · ${src.header ? t('import.headerRow') : t('import.noHeaderRow')}`;
}
