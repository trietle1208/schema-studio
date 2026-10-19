import type { Column } from '../../model';
import { parseJson } from '../json';
import type { Row } from '..';

// The rows of a query result as files: CSV for a spreadsheet, JSON for code. What is written into a
// file is the same in every language.

/** A value as a CSV cell: quoted when it has a comma, a quote or a line break. NULL is an empty cell. */
export function csvCell(value: Row[string] | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The result as CSV: a header of the column names, then a line to a row. */
export function resultCsv(columns: readonly Pick<Column, 'name'>[], rows: readonly Row[]): string {
  const lines = [columns.map((c) => csvCell(c.name)).join(','), ...rows.map((row) => columns.map((c) => csvCell(row[c.name])).join(','))];
  return `${lines.join('\n')}\n`;
}

/** The result as a JSON list of objects, a JSON column written as the JSON it holds. */
export function resultJson(columns: readonly Pick<Column, 'name' | 'type'>[], rows: readonly Row[]): string {
  const json = new Set(columns.filter((c) => /^JSONB?\b/i.test(c.type)).map((c) => c.name));
  const one = (row: Row) =>
    Object.fromEntries(
      columns.map((c) => {
        const v = row[c.name] ?? null;
        const parsed = json.has(c.name) && typeof v === 'string' ? parseJson(v) : null;
        return [c.name, parsed?.ok ? parsed.value : v];
      }),
    );
  return `${JSON.stringify(rows.map(one), null, 2)}\n`;
}
