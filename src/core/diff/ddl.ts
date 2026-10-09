import type { DdlBlock } from '../generate/options';
import { t } from '../i18n';

// Lines up the DDL of two versions for the side-by-side view. The scripts are compared block by
// block (see `DdlBlock`), so a table is only ever compared with itself, and line by line within a
// block. Blocks that did not change are folded away.

export type DdlRowKind = 'same' | 'add' | 'del' | 'mod' | 'fold';

/**
 * One row of the comparison, as `DdlDiff` takes it: the line on the left, the line on the right
 * (the same as the left when left out, null when that side has none), the kind (`same` when left
 * out) and, for a fold, how many lines it stands for. The label of a fold is in `left`.
 */
export type DdlRow = [left: string | null, right?: string | null, kind?: DdlRowKind, count?: number];

export interface DdlComparison {
  rows: DdlRow[];
  /** The index of the first row of each block, by the key of the block. A folded block points at its fold. */
  anchors: Record<string, number>;
}

/** A run of unchanged lines this long or longer is folded. */
const MIN_FOLD = 4;

/** A line as it is compared: the padding that aligns the columns and the comma at the end do not count. */
function comparable(line: string): string {
  return line.replace(/^\s*(\S+)\s+/, '$1 ').replace(/,$/, '');
}

/** What a line is about, so that a changed line is shown beside its earlier self: the name of the column, or the first word. */
function subject(line: string): string {
  const text = line.trim();
  const comment = /^COMMENT ON .*? IS /.exec(text);
  return comment ? comment[0] : text.split(/\s+/, 1)[0];
}

type LineOp = { kind: 'same'; left: string; right: string } | { kind: 'del'; left: string } | { kind: 'add'; right: string };

/** The lines of `left` and `right` in order, each marked as kept, removed or added: a longest common subsequence. */
function lineOps(left: readonly string[], right: readonly string[]): LineOp[] {
  const a = left.map(comparable);
  const b = right.map(comparable);
  // lengths[i][j] is the length of the longest common subsequence of a[i..] and b[j..].
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const ops: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) ops.push({ kind: 'same', left: left[i++], right: right[j++] });
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) ops.push({ kind: 'del', left: left[i++] });
    else ops.push({ kind: 'add', right: right[j++] });
  }
  while (i < a.length) ops.push({ kind: 'del', left: left[i++] });
  while (j < b.length) ops.push({ kind: 'add', right: right[j++] });
  return ops;
}

/**
 * The rows for a run of removed and added lines. A removed line and an added one about the same
 * thing become one changed row; both sides keep the order of their lines.
 */
function changedRows(removed: readonly string[], added: readonly string[]): DdlRow[] {
  const rows: DdlRow[] = [];
  let next = 0;
  for (const line of removed) {
    const match = added.findIndex((other, k) => k >= next && subject(other) === subject(line));
    if (match < 0) {
      rows.push([line, null, 'del']);
      continue;
    }
    for (; next < match; next++) rows.push([null, added[next], 'add']);
    rows.push([line, added[next++], 'mod']);
  }
  for (; next < added.length; next++) rows.push([null, added[next], 'add']);
  return rows;
}

function sameRow(left: string, right: string): DdlRow {
  return left === right ? [left] : [left, right, 'same'];
}

/** The rows of one block that is in both scripts. */
function blockRows(left: readonly string[], right: readonly string[]): DdlRow[] {
  const rows: DdlRow[] = [];
  let removed: string[] = [];
  let added: string[] = [];
  for (const op of lineOps(left, right)) {
    if (op.kind === 'del') removed.push(op.left);
    else if (op.kind === 'add') added.push(op.right);
    else {
      rows.push(...changedRows(removed, added), sameRow(op.left, op.right));
      removed = [];
      added = [];
    }
  }
  rows.push(...changedRows(removed, added));
  return rows;
}

interface Pair {
  key: string;
  left: DdlBlock | undefined;
  right: DdlBlock | undefined;
}

/**
 * The blocks of both scripts in the order of `after`. A block that is only in `before` goes after
 * the block it followed there.
 */
function pairBlocks(before: readonly DdlBlock[], after: readonly DdlBlock[]): Pair[] {
  const was = new Map(before.map((block) => [block.key, block]));
  const is = new Set(after.map((block) => block.key));
  /** The removed blocks, by the key of the kept block they follow; '' for those before any. */
  const removed = new Map<string, DdlBlock[]>();
  let last = '';
  for (const block of before) {
    if (is.has(block.key)) last = block.key;
    else removed.set(last, [...(removed.get(last) ?? []), block]);
  }
  const gone = (key: string): Pair[] => (removed.get(key) ?? []).map((left) => ({ key: left.key, left, right: undefined }));
  return [...gone(''), ...after.flatMap((right) => [{ key: right.key, left: was.get(right.key), right }, ...gone(right.key)])];
}

const kindOf = (row: DdlRow): DdlRowKind => row[2] ?? 'same';

export interface CompareOptions {
  /** False keeps every line: the blocks that did not change are not folded. */
  fold?: boolean;
}

/** Lines up two scripts of a schema, given block by block. */
export function compareDdl(before: readonly DdlBlock[], after: readonly DdlBlock[], { fold = true }: CompareOptions = {}): DdlComparison {
  const rows: DdlRow[] = [];
  const anchors: Record<string, number> = {};
  /** The unchanged rows since the last change, with where each of their blocks starts among them. */
  let run: { rows: DdlRow[]; starts: [key: string, at: number][]; tables: number } = { rows: [], starts: [], tables: 0 };

  const flush = () => {
    const lines = run.rows.length;
    if (fold && lines >= MIN_FOLD) {
      for (const [key] of run.starts) anchors[key] = rows.length;
      const label = run.tables
        ? t('ddl.fold', { tables: t('count.unchangedTables', { count: run.tables }), lines: t('count.lines', { count: lines }) })
        : t('count.unchangedLines', { count: lines });
      rows.push([`⋯ ${label}`, undefined, 'fold', lines]);
    } else {
      for (const [key, at] of run.starts) anchors[key] = rows.length + at;
      rows.push(...run.rows);
    }
    run = { rows: [], starts: [], tables: 0 };
  };

  // A blank line goes between two blocks of a script, so each side has one before every block but its first.
  let leftStarted = false;
  let rightStarted = false;
  for (const { key, left, right } of pairBlocks(before, after)) {
    const gapLeft = !!left && leftStarted;
    const gapRight = !!right && rightStarted;
    leftStarted ||= !!left;
    rightStarted ||= !!right;
    const body = left && right ? blockRows(left.lines, right.lines) : left
      ? left.lines.map((line): DdlRow => [line, null, 'del'])
      : (right?.lines ?? []).map((line): DdlRow => [null, line, 'add']);

    if (gapLeft && gapRight) run.rows.push(['']);
    else if (gapLeft || gapRight) {
      flush();
      rows.push(gapLeft ? ['', null, 'del'] : [null, '', 'add']);
    }
    if (body.every((row) => kindOf(row) === 'same')) {
      run.starts.push([key, run.rows.length]);
      run.rows.push(...body);
      if (key.startsWith('table:')) run.tables++;
    } else {
      flush();
      anchors[key] = rows.length;
      rows.push(...body);
    }
  }
  flush();
  return { rows, anchors };
}

/** A changed line cut into what both sides share at the start and the end, and what differs in between. */
export interface ChangedPart {
  /** The shared start and end. */
  pre: string;
  post: string;
  /** What is in between: `before` on the old line, `after` on the new one. */
  before: string;
  after: string;
}

/** The part of a line that changed: what is left between the longest shared start and the longest shared end. */
export function changedPart(before: string, after: string): ChangedPart {
  const shortest = Math.min(before.length, after.length);
  let start = 0;
  while (start < shortest && before[start] === after[start]) start++;
  let end = 0;
  while (end < shortest - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return {
    pre: before.slice(0, start),
    before: before.slice(start, before.length - end),
    after: after.slice(start, after.length - end),
    post: before.slice(before.length - end),
  };
}

/** Whether the comparison shows any difference. */
export function hasDifferences(rows: readonly DdlRow[]): boolean {
  return rows.some((row) => kindOf(row) !== 'same' && kindOf(row) !== 'fold');
}

interface DiffLine {
  sign: ' ' | '-' | '+';
  text: string;
}

/** The hunks of a run of lines whose first line is line `left` of the old file and line `right` of the new one. */
function hunks(lines: readonly DiffLine[], left: number, right: number, context: number): string[] {
  const out: string[] = [];
  const changed = lines.flatMap((line, i) => (line.sign === ' ' ? [] : [i]));
  const range = (start: number, count: number) => `${count ? start : start - 1},${count}`;
  /** How many of the lines before `end` each file has. */
  const count = (end: number, other: '-' | '+') => lines.slice(0, end).filter((line) => line.sign !== other).length;

  for (let k = 0; k < changed.length; k++) {
    const start = Math.max(0, changed[k] - context);
    // Changes that are close enough for their context to meet share a hunk.
    while (k + 1 < changed.length && changed[k + 1] - changed[k] <= context * 2) k++;
    const end = Math.min(lines.length, changed[k] + context + 1);
    const hunk = lines.slice(start, end);
    const removed = hunk.filter((line) => line.sign !== '+').length;
    const added = hunk.filter((line) => line.sign !== '-').length;
    out.push(
      `@@ -${range(left + count(start, '+'), removed)} +${range(right + count(start, '-'), added)} @@`,
      ...hunk.map((line) => `${line.sign}${line.text}`),
    );
  }
  return out;
}

/**
 * The comparison as a unified diff that `patch` and `git apply` take: `-` before a removed line and
 * `+` before an added one, in hunks with `context` unchanged lines around them. Give it the rows of
 * an unfolded comparison: the lines a fold stands for cannot be context. A line that differs only
 * by its padding or a comma counts as changed here, since a patch has to match the file exactly.
 */
export function unifiedDiff(rows: readonly DdlRow[], leftName: string, rightName: string, context: number = 3): string {
  const out = [`--- ${leftName}`, `+++ ${rightName}`];
  let left = 1;
  let right = 1;
  let lines: DiffLine[] = [];
  const flush = () => {
    out.push(...hunks(lines, left, right, context));
    left += lines.filter((line) => line.sign !== '+').length;
    right += lines.filter((line) => line.sign !== '-').length;
    lines = [];
  };
  for (const row of rows) {
    const kind = kindOf(row);
    if (kind === 'fold') {
      flush();
      left += row[3] ?? 0;
      right += row[3] ?? 0;
      continue;
    }
    const before = row[0];
    const after = row[1] === undefined ? row[0] : row[1];
    if (kind === 'same' && before === after) lines.push({ sign: ' ', text: before ?? '' });
    else {
      if (kind !== 'add' && before !== null) lines.push({ sign: '-', text: before });
      if (kind !== 'del' && after !== null) lines.push({ sign: '+', text: after });
    }
  }
  flush();
  return `${out.join('\n')}\n`;
}
