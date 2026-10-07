// Splits a SQL script into statements and their tokens, by PostgreSQL's lexical rules. It knows
// nothing of the grammar: a parser asks it where statements begin and what words they are made of.

export type TokenKind = 'word' | 'quoted' | 'string' | 'number' | 'symbol';

export interface Token {
  kind: TokenKind;
  /** The token as written. */
  text: string;
  /** A word in upper case, to compare with keywords; for every other kind the text itself. */
  upper: string;
  /** Offsets into the script: `start` is the first character, `end` the one after the last. */
  start: number;
  end: number;
}

/** One statement, without the `;` that ends it. It has at least one token. */
export interface Statement {
  tokens: Token[];
  start: number;
  end: number;
}

/** Why a script could not be split: a string, name or comment that never ends. */
export interface LexError {
  message: string;
  /** Where the unfinished piece begins. */
  offset: number;
}

export interface Script {
  statements: Statement[];
  error?: LexError;
}

const WORD_START = /[A-Za-z_\u0080-￿]/;
const WORD_PART = /[A-Za-z0-9_$\u0080-￿]/;
const DIGIT = /[0-9]/;
const SPACE = /\s/;
const DOLLAR_TAG = /\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/y;
const NUMBER = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/y;

/** The offset just after the string or quoted name that opens at `open`, or -1 when it never closes. */
function quoteEnd(sql: string, open: number, backslashes: boolean): number {
  const quote = sql[open];
  for (let i = open + 1; i < sql.length; i++) {
    if (backslashes && sql[i] === '\\') i++;
    else if (sql[i] === quote) {
      // A doubled quote stands for one inside the text.
      if (sql[i + 1] === quote) i++;
      else return i + 1;
    }
  }
  return -1;
}

/** The offset just after the comment that opens at `open`, or -1 when it never closes. Comments nest. */
function commentEnd(sql: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    if (sql.startsWith('/*', i)) {
      depth++;
      i++;
    } else if (sql.startsWith('*/', i)) {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function lineEnd(sql: string, from: number): number {
  const end = sql.indexOf('\n', from);
  return end < 0 ? sql.length : end;
}

/** Whether a statement is `COPY … FROM stdin`, which is followed by rows of data, not SQL. */
function copiesFromStdin(tokens: Token[]): boolean {
  return (
    tokens[0].upper === 'COPY' && tokens.some((t, i) => t.upper === 'STDIN' && tokens[i - 1]?.upper === 'FROM')
  );
}

/** The offset after the `\.` line that ends the rows of a `COPY … FROM stdin`. */
function copyDataEnd(sql: string, from: number): number {
  let line = lineEnd(sql, from) + 1;
  while (line < sql.length) {
    const end = lineEnd(sql, line);
    if (sql.slice(line, end).trim() === '\\.') return end;
    line = end + 1;
  }
  return sql.length;
}

/**
 * The statements of a script, in order. Comments, empty statements, psql commands (`\connect`)
 * and the rows of a `COPY … FROM stdin` are left out. When a string, quoted name or comment never
 * ends, the statements before it are returned together with the error.
 */
export function splitStatements(sql: string): Script {
  const statements: Statement[] = [];
  let tokens: Token[] = [];
  let i = 0;

  const push = (kind: TokenKind, end: number) => {
    const text = sql.slice(i, end);
    tokens.push({ kind, text, upper: kind === 'word' ? text.toUpperCase() : text, start: i, end });
    i = end;
  };
  const finish = () => {
    if (tokens.length) statements.push({ tokens, start: tokens[0].start, end: tokens[tokens.length - 1].end });
    tokens = [];
  };
  // The statement that holds the unfinished piece is left out: it is not all there.
  const unfinished = (message: string): Script => ({ statements, error: { message, offset: i } });

  while (i < sql.length) {
    const c = sql[i];
    if (SPACE.test(c)) i++;
    else if (sql.startsWith('--', i)) i = lineEnd(sql, i);
    else if (sql.startsWith('/*', i)) {
      const end = commentEnd(sql, i);
      if (end < 0) return unfinished('The comment that starts here is never closed.');
      i = end;
    } else if (c === '\\') {
      // A psql command runs to the end of its line.
      i = lineEnd(sql, i);
    } else if (c === "'" || c === '"' || ((c === 'e' || c === 'E') && sql[i + 1] === "'")) {
      // E'…' is a string with backslash escapes.
      const escaped = c !== "'" && c !== '"';
      const end = quoteEnd(sql, escaped ? i + 1 : i, escaped);
      if (end < 0) {
        return unfinished(
          c === '"' ? 'The quoted name that starts here is never closed.' : 'The string that starts here is never closed.',
        );
      }
      push(c === '"' ? 'quoted' : 'string', end);
    } else if (c === '$') {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(sql)?.[0];
      if (!tag) push('symbol', i + 1);
      else {
        const close = sql.indexOf(tag, i + tag.length);
        if (close < 0) return unfinished('The string that starts here is never closed.');
        push('string', close + tag.length);
      }
    } else if (WORD_START.test(c)) {
      let end = i + 1;
      while (end < sql.length && WORD_PART.test(sql[end])) end++;
      push('word', end);
    } else if (DIGIT.test(c)) {
      NUMBER.lastIndex = i;
      push('number', i + (NUMBER.exec(sql)?.[0].length ?? 1));
    } else if (c === ';') {
      const copy = tokens.length > 0 && copiesFromStdin(tokens);
      finish();
      i = copy ? copyDataEnd(sql, i) : i + 1;
    } else push('symbol', i + 1);
  }
  finish();
  return { statements };
}

/** Turns offsets into line numbers, counted from 1. */
export function lineCounter(sql: string): (offset: number) => number {
  const starts = [0];
  for (let i = sql.indexOf('\n'); i >= 0; i = sql.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}
