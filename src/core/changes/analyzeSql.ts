import { t } from '../i18n';

// What a script of a change does to the data, read from the text alone. It sees DROP TABLE, a
// column that is dropped, and a column that is changed to another type, which makes the database
// rewrite the table. Comments and string literals are not code and are skipped. It does not know
// how big a table is, so it never says how long a rewrite takes.

export type SqlWarningKind = 'drop-table' | 'drop-column' | 'rewrite';

export interface SqlWarning {
  kind: SqlWarningKind;
  /** What it is about: the table, or `table.column` for a column that is dropped. */
  name: string;
  /** Data is gone for good. A rewrite is slow, and loses nothing. */
  destructive: boolean;
}

/** A word, a quoted name, a literal (kept as a place holder) or one character of punctuation. */
interface Token {
  kind: 'word' | 'name' | 'string' | 'punct';
  text: string;
}

const WORD = /[\p{L}\p{N}_$]/u;
const DOLLAR_QUOTE = /^\$(?:[\p{L}_][\p{L}\p{N}_]*)?\$/u;

/** Where the string that starts at `from` ends, just after its closing quote. Stops at the end of the text for one that never closes. */
function stringEnd(sql: string, from: number, backslash: boolean): number {
  let i = from + 1;
  while (i < sql.length) {
    if (backslash && sql[i] === '\\') i += 2;
    else if (sql[i] !== "'") i++;
    else if (sql[i + 1] === "'") i += 2;
    else return i + 1;
  }
  return sql.length;
}

/** Where the quoted name that starts at `from` ends: a doubled quote is part of the name. */
function nameEnd(sql: string, from: number): number {
  const quote = sql[from];
  let i = from + 1;
  while (i < sql.length) {
    if (sql[i] !== quote) i++;
    else if (sql[i + 1] === quote) i += 2;
    else return i + 1;
  }
  return sql.length;
}

/** The statements of a script, each as its tokens. */
function statements(sql: string, backslash: boolean): Token[][] {
  const result: Token[][] = [[]];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const current = result[result.length - 1];
    if (c === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
    } else if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
    } else if (c === "'") {
      current.push({ kind: 'string', text: '' });
      i = stringEnd(sql, i, backslash);
    } else if (c === '$' && DOLLAR_QUOTE.test(sql.slice(i, i + 80))) {
      const tag = DOLLAR_QUOTE.exec(sql.slice(i, i + 80))![0];
      const end = sql.indexOf(tag, i + tag.length);
      current.push({ kind: 'string', text: '' });
      i = end < 0 ? sql.length : end + tag.length;
    } else if (c === '"' || c === '`') {
      const end = nameEnd(sql, i);
      const closed = sql[end - 1] === c && end - i > 1;
      current.push({ kind: 'name', text: sql.slice(i + 1, closed ? end - 1 : end).replaceAll(c + c, c) });
      i = end;
    } else if (WORD.test(c)) {
      let end = i + 1;
      while (end < sql.length && WORD.test(sql[end])) end++;
      current.push({ kind: 'word', text: sql.slice(i, end) });
      i = end;
    } else {
      if (c === ';') result.push([]);
      else if (!/\s/.test(c)) current.push({ kind: 'punct', text: c });
      i++;
    }
  }
  return result.filter((tokens) => tokens.length > 0);
}

/** Whether the token at `i` is the unquoted word `word`, in any case. */
const isWord = (tokens: readonly Token[], i: number, word: string) => tokens[i]?.kind === 'word' && tokens[i].text.toUpperCase() === word;

/** The name that starts at `i`, qualified by a schema if it is, and where it ends. */
function readName(tokens: readonly Token[], i: number): { name: string; end: number } | null {
  const first = tokens[i];
  if (first?.kind !== 'word' && first?.kind !== 'name') return null;
  let name = first.text;
  let end = i + 1;
  while (tokens[end]?.text === '.' && tokens[end].kind === 'punct' && (tokens[end + 1]?.kind === 'word' || tokens[end + 1]?.kind === 'name')) {
    name += `.${tokens[end + 1].text}`;
    end += 2;
  }
  return { name, end };
}

/** The parts of an ALTER TABLE between its commas, ignoring commas inside brackets. */
function clauses(tokens: readonly Token[]): Token[][] {
  const parts: Token[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === 'punct' && token.text === '(') depth++;
    else if (token.kind === 'punct' && token.text === ')') depth--;
    if (token.kind === 'punct' && token.text === ',' && depth === 0) parts.push([]);
    else parts[parts.length - 1].push(token);
  }
  return parts;
}

// What can follow DROP in an ALTER TABLE without being the name of a column.
const NOT_A_COLUMN = new Set(['CONSTRAINT', 'INDEX', 'KEY', 'FOREIGN', 'PRIMARY', 'CHECK', 'UNIQUE', 'PARTITION', 'PERIOD', 'SYSTEM']);

function alterWarning(table: string, clause: readonly Token[]): SqlWarning | null {
  if (isWord(clause, 0, 'MODIFY') || isWord(clause, 0, 'CHANGE')) return { kind: 'rewrite', name: table, destructive: false };
  if (isWord(clause, 0, 'ALTER')) {
    // PostgreSQL: ALTER [COLUMN] name [SET DATA] TYPE.
    let i = isWord(clause, 1, 'COLUMN') ? 2 : 1;
    if (!readName(clause, i)) return null;
    i++;
    if (isWord(clause, i, 'TYPE') || (isWord(clause, i, 'SET') && isWord(clause, i + 1, 'DATA') && isWord(clause, i + 2, 'TYPE'))) {
      return { kind: 'rewrite', name: table, destructive: false };
    }
    return null;
  }
  if (isWord(clause, 0, 'DROP')) {
    // MySQL allows DROP name without the word COLUMN.
    let i = 1;
    const column = isWord(clause, i, 'COLUMN');
    if (column) i++;
    if (isWord(clause, i, 'IF') && isWord(clause, i + 1, 'EXISTS')) i += 2;
    const name = readName(clause, i);
    if (!name) return null;
    if (!column && clause[i].kind === 'word' && NOT_A_COLUMN.has(clause[i].text.toUpperCase())) return null;
    return { kind: 'drop-column', name: `${table}.${name.name}`, destructive: true };
  }
  return null;
}

function statementWarnings(tokens: readonly Token[]): SqlWarning[] {
  if (isWord(tokens, 0, 'DROP') && isWord(tokens, 1, 'TABLE')) {
    const name = readName(tokens, isWord(tokens, 2, 'IF') && isWord(tokens, 3, 'EXISTS') ? 4 : 2);
    return name ? [{ kind: 'drop-table', name: name.name, destructive: true }] : [];
  }
  if (isWord(tokens, 0, 'ALTER') && isWord(tokens, 1, 'TABLE')) {
    let i = isWord(tokens, 2, 'IF') && isWord(tokens, 3, 'EXISTS') ? 4 : 2;
    if (isWord(tokens, i, 'ONLY')) i++;
    const table = readName(tokens, i);
    if (!table) return [];
    return clauses(tokens.slice(table.end)).flatMap((clause) => alterWarning(table.name, clause) ?? []);
  }
  return [];
}

/**
 * The one thing about a script that is worth a warning, or null. A drop, of a table or a column,
 * comes before a rewrite; between two of a kind the first in the script wins. `engine` tells
 * whether a backslash in a string escapes the quote after it, as MySQL has it and PostgreSQL does not.
 */
export function analyzeSql(sql: string, engine?: string): SqlWarning | null {
  const warnings = statements(sql, engine !== 'PostgreSQL').flatMap(statementWarnings);
  return warnings.find((w) => w.destructive) ?? warnings[0] ?? null;
}

/** The sentence a warning is shown as, in the language of the app: "Rewrites da_thanh_toan." */
export function warningText(warning: SqlWarning): string {
  return t(warning.kind === 'rewrite' ? 'changes.warn.rewrite' : 'changes.warn.drop', { name: warning.name });
}
