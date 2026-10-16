import type { Row } from '.';

// Changes to the rows of a table. Each one gives the new list and leaves the old one as it was, so
// that an edit can be undone by keeping the list it came from. A row is known by its position.

/** A row that was taken out, and where it was. */
export interface RemovedRow {
  index: number;
  row: Row;
}

/** `rows` with `row` at `at` (the end when left out; a position out of range is the nearest end). */
export function insertRow(rows: readonly Row[], row: Row, at: number = rows.length): Row[] {
  const index = Math.min(rows.length, Math.max(0, Math.floor(at)));
  return [...rows.slice(0, index), row, ...rows.slice(index)];
}

/** `rows` with the row at `index` replaced. A position that is not there changes nothing. */
export function replaceRow(rows: readonly Row[], index: number, row: Row): Row[] {
  return rows.map((r, i) => (i === index ? row : r));
}

/** `rows` without the rows at `indexes`, and those rows with where they were, in order. */
export function removeRows(rows: readonly Row[], indexes: readonly number[]): { rows: Row[]; removed: RemovedRow[] } {
  const gone = new Set(indexes);
  return {
    rows: rows.filter((_, i) => !gone.has(i)),
    removed: rows.flatMap((row, index) => (gone.has(index) ? [{ index, row }] : [])),
  };
}

/** `rows` with the rows of `removed` back where they were: the other way of `removeRows`. */
export function restoreRows(rows: readonly Row[], removed: readonly RemovedRow[]): Row[] {
  const out = rows.slice();
  for (const { index, row } of [...removed].sort((a, b) => a.index - b.index)) out.splice(Math.min(index, out.length), 0, row);
  return out;
}
