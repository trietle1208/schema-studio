import { t } from '../../i18n';
import type { ColumnRef, Expr, Join, Operand, OrderBy, Select } from './ast';
import { printQuery, RESERVED } from './print';

// Reading a SELECT. It is the same small language as the Builder writes and the console runs: a
// column list, FROM with INNER JOIN and LEFT JOIN, WHERE, ORDER BY, LIMIT and OFFSET. Everything
// else is refused with a message that says where.

export interface QueryFailure {
  ok: false;
  /** The line of the word that could not be read, from 1. */
  line: number;
  message: string;
}

export type ParsedQuery = { ok: true; query: Select; /** The SQL had comments, which a printed query would not keep. */ comments: boolean } | QueryFailure;

/** A statement that changes something, which Query mode never runs. */
const WRITES = new Set(['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE']);

export function queryFailure(line: number, message: string): QueryFailure {
  return { ok: false, line, message };
}

function parseFailure(line: number): QueryFailure {
  return queryFailure(line, t('query.error.parse', { line }));
}

/** Stops the reader at a line. Caught inside `parseQuery`, never seen outside it. */
class Stop extends Error {
  line: number;
  constructor(line: number) {
    super(`Unable to read the query near line ${line}.`);
    this.line = line;
  }
}

interface Token {
  /** `w` is a word, `id` a quoted name, `str` a string, `op` a punctuation mark or operator. */
  t: 'w' | 'id' | 'str' | 'num' | 'op' | 'eof';
  /** The text of a word (as written), name, string or operator. */
  text: string;
  /** A word in upper case, to compare keywords with. */
  upper: string;
  num: number;
  line: number;
}

const WORD = /[A-Za-z_][A-Za-z0-9_$]*/y;
const NUMBER = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;

function token(t: Token['t'], line: number, patch: Partial<Token> = {}): Token {
  return { t, text: '', upper: '', num: 0, line, ...patch };
}

function lex(sql: string): { tokens: Token[]; comments: boolean } {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let comments = false;

  /** A string, or a name in double quotes or backticks; the quote is written twice to be in it. */
  const quoted = (quote: string, kind: 'str' | 'id') => {
    const at = line;
    let text = '';
    i++;
    for (;;) {
      if (i >= sql.length) throw new Stop(at);
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) {
          text += quote;
          i += 2;
          continue;
        }
        i++;
        break;
      }
      if (sql[i] === '\n') line++;
      text += sql[i++];
    }
    tokens.push(token(kind, at, { text }));
  };

  while (i < sql.length) {
    const c = sql[i];
    if (c === '\n') {
      line++;
      i++;
    } else if (c === ' ' || c === '\t' || c === '\r') {
      i++;
    } else if (c === '-' && sql[i + 1] === '-') {
      comments = true;
      while (i < sql.length && sql[i] !== '\n') i++;
    } else if (c === '/' && sql[i + 1] === '*') {
      comments = true;
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Stop(line);
      line += sql.slice(i, end).split('\n').length - 1;
      i = end + 2;
    } else if (c === "'") {
      quoted("'", 'str');
    } else if (c === '"' || c === '`') {
      quoted(c, 'id');
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(sql)!;
      tokens.push(token('num', line, { num: Number(m[0]), text: m[0] }));
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      WORD.lastIndex = i;
      const m = WORD.exec(sql)!;
      tokens.push(token('w', line, { text: m[0], upper: m[0].toUpperCase() }));
      i += m[0].length;
    } else if (((c === '<' || c === '>' || c === '!') && sql[i + 1] === '=') || (c === '<' && sql[i + 1] === '>')) {
      const two = sql.slice(i, i + 2);
      tokens.push(token('op', line, { text: two === '!=' ? '<>' : two }));
      i += 2;
    } else if ('=<>,().*;-'.includes(c)) {
      tokens.push(token('op', line, { text: c }));
      i++;
    } else {
      throw new Stop(line);
    }
  }
  tokens.push(token('eof', line));
  return { tokens, comments };
}

/**
 * Reads one SELECT. A failure says the line of the word it stopped at: "Unable to parse SQL near
 * line 7.", or what is wrong with the statement as a whole (a write, or nothing at all).
 */
export function parseQuery(sql: string): ParsedQuery {
  let lexed: ReturnType<typeof lex>;
  try {
    lexed = lex(sql);
  } catch (e) {
    if (e instanceof Stop) return parseFailure(e.line);
    throw e;
  }
  const { tokens } = lexed;
  let p = 0;

  const fail = (): never => {
    throw new Stop(tokens[p].line);
  };
  const isWord = (w: string) => tokens[p].t === 'w' && tokens[p].upper === w;
  const eatWord = (w: string) => (isWord(w) ? !!++p : false);
  const needWord = (w: string) => {
    if (!eatWord(w)) fail();
  };
  const isOp = (o: string) => tokens[p].t === 'op' && tokens[p].text === o;
  const eatOp = (o: string) => (isOp(o) ? !!++p : false);
  const needOp = (o: string) => {
    if (!eatOp(o)) fail();
  };

  /** A name: quoted as written, or bare in lower case (SQL folds it). */
  const name = (): { text: string; line: number } => {
    const tok = tokens[p];
    if (tok.t === 'id') {
      p++;
      return { text: tok.text, line: tok.line };
    }
    if (tok.t === 'w' && !RESERVED.has(tok.upper)) {
      p++;
      return { text: tok.text.toLowerCase(), line: tok.line };
    }
    return fail();
  };
  const colref = (): ColumnRef => {
    const a = name();
    if (eatOp('.')) {
      const b = name();
      return { t: 'col', qual: a.text, name: b.text, line: b.line };
    }
    return { t: 'col', name: a.text, line: a.line };
  };
  const operand = (): Operand => {
    const tok = tokens[p];
    if (tok.t === 'num') {
      p++;
      return { t: 'lit', kind: 'num', v: tok.num, line: tok.line };
    }
    if (isOp('-') && tokens[p + 1].t === 'num') {
      p += 2;
      return { t: 'lit', kind: 'num', v: -tokens[p - 1].num, line: tok.line };
    }
    if (tok.t === 'str') {
      p++;
      return { t: 'lit', kind: 'str', v: tok.text, line: tok.line };
    }
    if (isWord('TRUE') || isWord('FALSE')) {
      p++;
      return { t: 'lit', kind: 'bool', v: tok.upper === 'TRUE', line: tok.line };
    }
    if (isWord('NULL')) {
      p++;
      return { t: 'lit', kind: 'null', v: null, line: tok.line };
    }
    return colref();
  };

  const predicate = (): Expr => {
    if (eatOp('(')) {
      const inner = expr();
      needOp(')');
      return inner;
    }
    const l = operand();
    const compare = tokens[p];
    if (compare.t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(compare.text)) {
      p++;
      return { t: 'cmp', op: compare.text as '=' | '<>' | '<' | '>' | '<=' | '>=', l, r: operand() };
    }
    if (eatWord('IS')) {
      const neg = eatWord('NOT');
      needWord('NULL');
      return { t: 'isnull', neg, l };
    }
    const neg = eatWord('NOT');
    if (isWord('LIKE') || isWord('ILIKE')) {
      const ci = tokens[p++].upper === 'ILIKE';
      return { t: 'like', ci, neg, l, r: operand() };
    }
    if (eatWord('BETWEEN')) {
      const a = operand();
      needWord('AND');
      return { t: 'between', neg, l, a, b: operand() };
    }
    if (eatWord('IN')) {
      needOp('(');
      const list = [operand()];
      while (eatOp(',')) list.push(operand());
      needOp(')');
      return { t: 'in', neg, l, list };
    }
    return fail();
  };
  const negation = (): Expr => (eatWord('NOT') ? { t: 'not', e: negation() } : predicate());
  const conjunction = (): Expr => {
    let e = negation();
    while (eatWord('AND')) e = { t: 'and', a: e, b: negation() };
    return e;
  };
  const expr = (): Expr => {
    let e = conjunction();
    while (eatWord('OR')) e = { t: 'or', a: e, b: conjunction() };
    return e;
  };
  /** A count: a whole number that is not negative. */
  const count = (): number => {
    const tok = tokens[p];
    if (tok.t !== 'num' || tok.num % 1 !== 0) return fail();
    p++;
    return tok.num;
  };

  try {
    const first = tokens[0];
    if (first.t === 'eof') return queryFailure(1, t('query.error.empty'));
    if (first.t === 'w' && WRITES.has(first.upper)) return queryFailure(first.line, t('query.error.onlySelect'));
    needWord('SELECT');
    let cols: ColumnRef[] | null = null;
    if (!eatOp('*')) {
      cols = [];
      do {
        const c = colref();
        if (eatWord('AS')) c.alias = name().text;
        cols.push(c);
      } while (eatOp(','));
    }
    needWord('FROM');
    /** A word that ends the table, so it is not read as its alias. */
    const ALIAS_STOP = new Set(['WHERE', 'ORDER', 'GROUP', 'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'ON', 'USING', 'NATURAL', 'UNION', 'EXCEPT', 'INTERSECT', 'HAVING']);
    const alias = (): string | undefined => {
      if (eatWord('AS')) return name().text;
      const tok = tokens[p];
      if (tok.t === 'id') {
        p++;
        return tok.text;
      }
      if (tok.t === 'w' && !ALIAS_STOP.has(tok.upper) && !RESERVED.has(tok.upper)) {
        p++;
        return tok.text.toLowerCase();
      }
      return undefined;
    };
    const relation = () => {
      const t1 = name();
      const t2 = eatOp('.') ? name() : null;
      const named = t2 ?? t1;
      return { table: named.text, tableLine: named.line, schema: t2 ? t1.text : null, alias: alias() };
    };
    const from = relation();
    const joins: Join[] = [];
    for (;;) {
      if (isWord('RIGHT') || isWord('FULL') || isWord('CROSS') || isWord('NATURAL')) fail();
      let type: Join['type'] | null = null;
      if (eatWord('JOIN')) type = 'INNER';
      else if (eatWord('INNER')) {
        needWord('JOIN');
        type = 'INNER';
      } else if (eatWord('LEFT')) {
        eatWord('OUTER');
        needWord('JOIN');
        type = 'LEFT';
      } else break;
      const rel = relation();
      needWord('ON');
      joins.push({ type, table: rel.table, tableLine: rel.tableLine, schema: rel.schema, ...(rel.alias ? { alias: rel.alias } : {}), on: expr() });
    }
    const query: Select = {
      cols,
      table: from.table,
      tableLine: from.tableLine,
      schema: from.schema,
      ...(from.alias ? { alias: from.alias } : {}),
      ...(joins.length ? { joins } : {}),
      where: null,
      order: [],
      limit: null,
      offset: null,
    };
    if (eatWord('WHERE')) query.where = expr();
    if (eatWord('ORDER')) {
      needWord('BY');
      do {
        const o: OrderBy = { col: colref(), dir: 'ASC' };
        if (eatWord('DESC')) o.dir = 'DESC';
        else eatWord('ASC');
        query.order.push(o);
      } while (eatOp(','));
    }
    if (eatWord('LIMIT') && !eatWord('ALL')) query.limit = count();
    if (eatWord('OFFSET')) query.offset = count();
    while (eatOp(';'));
    if (tokens[p].t !== 'eof') fail();
    return { ok: true, query, comments: lexed.comments };
  } catch (e) {
    if (e instanceof Stop) return parseFailure(e.line);
    throw e;
  }
}

export type FormattedQuery = { ok: true; sql: string } | QueryFailure;

/** The SQL again as the Builder writes it. A query with comments is left alone: the printed one would lose them. */
export function formatQuery(sql: string): FormattedQuery {
  const parsed = parseQuery(sql);
  if (!parsed.ok) return parsed;
  if (parsed.comments) return queryFailure(1, t('query.error.comments'));
  return { ok: true, sql: printQuery(parsed.query) };
}
