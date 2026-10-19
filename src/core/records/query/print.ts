import type { Expr, Operand, Select } from './ast';

// A query written out the way the Builder writes it: one clause to a line, AND / OR under the
// first condition. The words of the SQL are the SQL's own, not the app's.

/** Words that a name must be quoted for, as the reader would take them for the query's own. */
export const RESERVED = new Set(
  'SELECT FROM WHERE ORDER BY LIMIT OFFSET AND OR NOT IS NULL LIKE ILIKE BETWEEN IN AS ASC DESC TRUE FALSE DISTINCT ALL'.split(' '),
);

/** A name as SQL writes it: bare when it can be, else in double quotes. */
export function sqlIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) && !RESERVED.has(name.toUpperCase()) ? name : `"${name.replace(/"/g, '""')}"`;
}

/** A text as a SQL string. */
export function sqlString(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

function operandSql(o: Operand): string {
  if (o.t === 'col') return sqlIdent(o.name);
  switch (o.kind) {
    case 'null':
      return 'NULL';
    case 'bool':
    case 'num':
      return String(o.v);
    case 'str':
      return sqlString(o.v);
  }
}

/** How tightly an expression binds, so that a looser one inside a tighter one gets its parentheses. */
const OR = 1;
const AND = 2;
const ATOM = 3;

/** `context` is the binding of what the expression stands in: 0 for the top. */
export function exprSql(e: Expr, context = 0): string {
  let text: string;
  let binds = ATOM;
  switch (e.t) {
    case 'and':
      text = `${exprSql(e.a, AND)} AND ${exprSql(e.b, AND)}`;
      binds = AND;
      break;
    case 'or':
      text = `${exprSql(e.a, OR)} OR ${exprSql(e.b, OR)}`;
      binds = OR;
      break;
    case 'not':
      text = `NOT ${exprSql(e.e, ATOM)}`;
      break;
    case 'cmp':
      text = `${operandSql(e.l)} ${e.op} ${operandSql(e.r)}`;
      break;
    case 'like':
      text = `${operandSql(e.l)}${e.neg ? ' NOT' : ''} ${e.ci ? 'ILIKE' : 'LIKE'} ${operandSql(e.r)}`;
      break;
    case 'isnull':
      text = `${operandSql(e.l)} IS ${e.neg ? 'NOT ' : ''}NULL`;
      break;
    case 'between':
      text = `${operandSql(e.l)}${e.neg ? ' NOT' : ''} BETWEEN ${operandSql(e.a)} AND ${operandSql(e.b)}`;
      break;
    case 'in':
      text = `${operandSql(e.l)}${e.neg ? ' NOT' : ''} IN (${e.list.map(operandSql).join(', ')})`;
      break;
  }
  return binds < context ? `(${text})` : text;
}

/** The operands of a chain of one operator: `a AND b AND c`. */
function chain(e: Expr, t: 'and' | 'or'): Expr[] {
  return e.t === t ? [...chain(e.a, t), ...chain(e.b, t)] : [e];
}

function whereLines(e: Expr): string[] {
  if (e.t !== 'and' && e.t !== 'or') return [`WHERE ${exprSql(e)}`];
  const word = e.t === 'and' ? 'AND' : 'OR';
  const context = e.t === 'and' ? AND : OR;
  return chain(e, e.t).map((x, i) => `${i ? `  ${word} ` : 'WHERE '}${exprSql(x, context)}`);
}

/** The column list goes on one line when it fits in this many characters. */
const INLINE = 72;

/** The query as SQL, ending with a semicolon. */
export function printQuery(q: Select): string {
  const list = q.cols ? q.cols.map((c) => sqlIdent(c.name) + (c.alias ? ` AS ${sqlIdent(c.alias)}` : '')) : ['*'];
  const inline = `SELECT ${list.join(', ')}`;
  const lines = [inline.length <= INLINE ? inline : `SELECT\n${list.map((c) => `  ${c}`).join(',\n')}`, `FROM ${sqlIdent(q.table)}`];
  if (q.where) lines.push(...whereLines(q.where));
  if (q.order.length) lines.push(`ORDER BY ${q.order.map((o) => sqlIdent(o.col.name) + (o.dir === 'DESC' ? ' DESC' : '')).join(', ')}`);
  if (q.limit !== null) lines.push(`LIMIT ${q.limit}`);
  if (q.offset !== null) lines.push(`OFFSET ${q.offset}`);
  return `${lines.join('\n')};`;
}
