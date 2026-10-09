import { t } from '../i18n';

// Splits a SQL script into statements and their tokens, by the lexical rules of PostgreSQL or of
// MySQL. It knows nothing of the grammar: a parser asks it where statements begin and what words
// they are made of.

/** Whose lexical rules a script is read by. */
export type Lexicon = 'postgres' | 'mysql';

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

/** The offset just after the comment that opens at `open`, or -1 when it never closes. In PostgreSQL comments nest. */
function commentEnd(sql: string, open: number, nests: boolean): number {
  if (!nests) {
    const close = sql.indexOf('*/', open + 2);
    return close < 0 ? -1 : close + 2;
  }
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
 *
 * MySQL differs in what it quotes with: names go in backticks, `"` holds a string like `'` does
 * and both take backslash escapes. It has `#` comments and none that nest, no dollar quoting, and
 * its client's `DELIMITER` command changes what ends a statement, as dumps do around triggers.
 */
export function splitStatements(sql: string, lexicon: Lexicon = 'postgres'): Script {
  const mysql = lexicon === 'mysql';
  const statements: Statement[] = [];
  let tokens: Token[] = [];
  let delimiter = ';';
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
    else if (sql.startsWith('--', i) || (mysql && c === '#')) i = lineEnd(sql, i);
    else if (sql.startsWith('/*', i)) {
      const end = commentEnd(sql, i, !mysql);
      if (end < 0) return unfinished(t('parse.unclosedComment'));
      i = end;
    } else if (sql.startsWith(delimiter, i)) {
      const copy = !mysql && tokens.length > 0 && copiesFromStdin(tokens);
      finish();
      i = copy ? copyDataEnd(sql, i) : i + delimiter.length;
    } else if (c === '\\' && !mysql) {
      // A psql command runs to the end of its line.
      i = lineEnd(sql, i);
    } else if (c === "'" || c === '"' || (mysql ? c === '`' : (c === 'e' || c === 'E') && sql[i + 1] === "'")) {
      // E'…' is a string with backslash escapes; in MySQL every string has them.
      const prefixed = c !== "'" && c !== '"' && c !== '`';
      const name = c === (mysql ? '`' : '"');
      const end = quoteEnd(sql, prefixed ? i + 1 : i, prefixed || (mysql && !name));
      if (end < 0) {
        return unfinished(name ? t('parse.unclosedName') : t('parse.unclosedString'));
      }
      push(name ? 'quoted' : 'string', end);
    } else if (c === '$' && !mysql) {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(sql)?.[0];
      if (!tag) push('symbol', i + 1);
      else {
        const close = sql.indexOf(tag, i + tag.length);
        if (close < 0) return unfinished(t('parse.unclosedString'));
        push('string', close + tag.length);
      }
    } else if (WORD_START.test(c)) {
      let end = i + 1;
      while (end < sql.length && WORD_PART.test(sql[end])) end++;
      if (mysql && !tokens.length && sql.slice(i, end).toUpperCase() === 'DELIMITER') {
        // The rest of the line is what ends the statements from here on.
        const line = lineEnd(sql, end);
        delimiter = sql.slice(end, line).trim() || ';';
        i = line;
      } else push('word', end);
    } else if (DIGIT.test(c)) {
      NUMBER.lastIndex = i;
      push('number', i + (NUMBER.exec(sql)?.[0].length ?? 1));
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
