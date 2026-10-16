// CSV as a file holds it: the cells, the line each row starts on, and the delimiter and header the
// first lines suggest. Text only; what a cell means for a column is `convert.ts`.

export const DELIMITERS = [',', ';', '\t', '|'] as const;
export type Delimiter = (typeof DELIMITERS)[number];

export interface ParsedCsv {
  rows: string[][];
  /** `lines[i]` is the line of the file where row `i` begins; a quoted cell may hold line breaks. */
  lines: number[];
  /** The line of a quote that never closes; 0 when every quote does. */
  unclosed: number;
}

/**
 * CSV as RFC 4180 reads it: a quoted cell may hold the delimiter, quotes (`""`) and line breaks.
 * Blank lines are skipped, a byte order mark at the start is not part of the first cell, and the
 * lines may end in `\n`, `\r\n` or `\r`.
 */
export function parseCsv(text: string, delimiter: string = ','): ParsedCsv {
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endRow = () => {
    row.push(cell);
    cell = '';
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
      lines.push(start);
    }
    row = [];
  };

  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      start = line;
    } else cell += ch;
  }
  const unclosed = quoted ? start : 0;
  if (cell !== '' || row.length) endRow();
  return { rows, lines, unclosed };
}

/** The delimiter that splits each of the first lines into at least as many cells as any other does; a comma when none splits them. */
export function sniffDelimiter(text: string): Delimiter {
  const sample = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== '')
    .slice(0, 6);
  let best: Delimiter = ',';
  let top = 0;
  for (const d of DELIMITERS) {
    const low = sample.length ? Math.min(...sample.map((l) => l.split(d).length - 1)) : 0;
    if (low > top) {
      top = low;
      best = d;
    }
  }
  return best;
}

/** A first row of names: every cell filled, each different from the others, and none a number, a date or an address. */
export function looksLikeHeader(row: readonly string[]): boolean {
  const seen = new Set<string>();
  return (
    row.length > 0 &&
    row.every((cell) => {
      const t = cell.trim().toLowerCase();
      if (!t || seen.has(t) || /^[-+]?[\d.,]+$/.test(t) || /^\d{4}-\d{2}-\d{2}/.test(t) || t.includes('@')) return false;
      seen.add(t);
      return true;
    })
  );
}

/** The names of the columns as the cells of the first row gave them: a blank name is `column_3`, a name that repeats gets `_2`. */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names.map((n, i) => {
    const name = n.trim() || `column_${i + 1}`;
    let k = name;
    for (let c = 2; seen.has(k); c++) k = `${name}_${c}`;
    seen.add(k);
    return k;
  });
}

/**
 * The text of a file's bytes. UTF-8 is expected (a byte order mark is dropped) and UTF-16 with
 * a byte order mark is read as well; bytes that are not valid in the encoding they claim give
 * null, so that a file saved by Excel as "CSV" in a code page is told apart from one that is
 * read wrongly and fills the grid with replacement characters.
 */
export function decodeText(bytes: Uint8Array): string | null {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
