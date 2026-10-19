import { formatNumber, t } from '../../i18n';
import type { Column, Table } from '../../model';
import { cellKind, type CellKind } from '../cells';
import { MOMENTS } from '../fields';
import type { RecordValue, Row } from '..';
import type { ColumnRef, Expr, Operand, Select } from './ast';
import { parseQuery, queryFailure, type QueryFailure } from './parse';
import { exprSql } from './print';
import { QUERY_DATE } from './spec';

// Running a query over rows, with what a database would say about it. The rows are the sample
// data of the schema; nothing here reads or changes anything but its arguments.

/** The most rows a query shows, whatever its LIMIT. */
export const QUERY_MAX_ROWS = 1000;

export interface QueryRun {
  ok: true;
  table: Table;
  /** What the query selects, as the grid shows it: a column that was renamed has its new name and none of the key marks. */
  columns: Column[];
  /** The rows shown, with the columns of `columns`. */
  rows: Row[];
  /** The rows of the table that `rows` came from, in the same order: a row opens in the record editor. */
  sources: Row[];
  /** The rows that matched, before LIMIT and OFFSET. */
  total: number;
  shown: number;
  /** `QUERY_MAX_ROWS` cut the rows, not the LIMIT. */
  capped: boolean;
  /** The rows the WHERE left out. */
  removed: number;
  /** The rows the table has. */
  all: number;
  query: Select;
  sql: string;
}

export type QueryResult = QueryRun | QueryFailure;

/** A mistake that is found when the query is checked against the table. */
class Mistake extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

/** The name PostgreSQL gives the type of a column in its messages. */
function typeWord(type: string): string {
  const word = type.toLowerCase().replace(/\(.*\)/, '').trim();
  return /^bigserial/.test(word) ? 'bigint' : /serial/.test(word) ? 'integer' : word;
}

/** ORDER BY may name a column as the query renamed it: `SELECT name AS n … ORDER BY n`. */
function aliasOf(q: Select, ref: ColumnRef): string | null {
  const c = !ref.qual && q.cols?.find((x) => x.alias === ref.name);
  return c ? c.name : null;
}

const BOOLEAN_WORDS = /^(true|false|t|f|yes|no|on|off|0|1)$/i;
const TRUE_WORDS = /^(t|true|yes|on|1)$/i;

/** The table the query reads, with every name in it checked: or the first thing wrong, with its line. */
function check(q: Select, tables: readonly Table[]): { table: Table } | { line: number; message: string } {
  const table = tables.find((x) => x.name === q.table);
  if (!table) return { line: q.tableLine ?? 1, message: t('query.error.noRelation', { name: q.table }) };

  const resolve = (ref: ColumnRef): Column => {
    const line = ref.line ?? 1;
    if (ref.qual && ref.qual !== table.name) throw new Mistake(line, t('query.error.missingFrom', { name: ref.qual }));
    const column = table.columns.find((c) => c.name === ref.name);
    if (!column) {
      throw new Mistake(line, ref.qual ? t('query.error.noQualifiedColumn', { name: `${ref.qual}.${ref.name}` }) : t('query.error.noColumn', { name: ref.name }));
    }
    return column;
  };
  /** A literal that the column cannot take: `id = 'abc'`. */
  const fits = (column: Column, lit: Operand) => {
    if (lit.t !== 'lit' || lit.kind === 'null') return;
    const kind = cellKind(column.type);
    const text = String(lit.v);
    let bad = false;
    if (kind === 'number') bad = lit.kind === 'bool' || (lit.kind === 'str' && (text.trim() === '' || Number.isNaN(Number(text))));
    else if (kind === 'boolean') bad = lit.kind === 'num' || (lit.kind === 'str' && !BOOLEAN_WORDS.test(text.trim()));
    else if (kind === 'time') bad = lit.kind !== 'str' || !(QUERY_DATE.test(text.trim()) || MOMENTS.time.re.test(text.trim()));
    if (bad) throw new Mistake(lit.line ?? 1, t('query.error.invalidInput', { type: typeWord(column.type), value: text }));
  };
  const side = (a: Operand, others: readonly Operand[] = []) => {
    if (a.t === 'col') {
      const column = resolve(a);
      others.forEach((x) => fits(column, x));
    }
  };
  const walk = (e: Expr): void => {
    switch (e.t) {
      case 'and':
      case 'or':
        walk(e.a);
        walk(e.b);
        break;
      case 'not':
        walk(e.e);
        break;
      case 'cmp':
        side(e.l, [e.r]);
        side(e.r, [e.l]);
        break;
      case 'like':
        side(e.l);
        side(e.r);
        break;
      case 'isnull':
        side(e.l);
        break;
      case 'between':
        side(e.l, [e.a, e.b]);
        side(e.a);
        side(e.b);
        break;
      case 'in':
        side(e.l, e.list);
        e.list.forEach((x) => side(x));
        break;
    }
  };
  try {
    q.cols?.forEach(resolve);
    if (q.where) walk(q.where);
    q.order.forEach((o) => {
      if (!aliasOf(q, o.col)) resolve(o.col);
    });
  } catch (e) {
    if (e instanceof Mistake) return { line: e.line, message: e.message };
    throw e;
  }
  return { table };
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** The pattern of a LIKE as a regular expression: `%` is any text, `_` any one character, `\` makes the next one plain. */
function likeRegex(pattern: string, ci: boolean): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) out += pattern[++i].replace(REGEX_SPECIAL, '\\$&');
    else out += c === '%' ? '.*' : c === '_' ? '.' : c.replace(REGEX_SPECIAL, '\\$&');
  }
  return new RegExp(`^${out}$`, ci ? 'si' : 's');
}

type Truth = boolean | null;

const asBoolean = (x: RecordValue) => x === true || x === 1 || TRUE_WORDS.test(String(x));

const compare = <T extends string | number | boolean>(a: T, b: T) => (a < b ? -1 : a > b ? 1 : 0);

/** A negative number, zero or a positive one; null when either side is NULL, which compares with nothing. */
function order(x: RecordValue, y: RecordValue, kind: CellKind): number | null {
  if (x === null || y === null) return null;
  if (kind === 'number') return compare(Number(x), Number(y));
  if (kind === 'boolean') return compare(asBoolean(x), asBoolean(y));
  return compare(String(x), String(y));
}

/** SQL's three values: true, false and null (unknown). */
function evalWhere(e: Expr, row: Row, table: Table): Truth {
  const val = (o: Operand): RecordValue => (o.t === 'col' ? (row[o.name] ?? null) : o.v);
  const kindOf = (a: Operand, b: Operand): CellKind => {
    const c = a.t === 'col' ? a : b.t === 'col' ? b : null;
    if (c) {
      const column = table.columns.find((x) => x.name === c.name);
      return column ? cellKind(column.type) : 'text';
    }
    return a.t === 'lit' && b.t === 'lit' && a.kind === 'num' && b.kind === 'num' ? 'number' : 'text';
  };
  const flip = (r: boolean, neg: boolean) => (neg ? !r : r);
  switch (e.t) {
    case 'and': {
      const a = evalWhere(e.a, row, table);
      if (a === false) return false;
      const b = evalWhere(e.b, row, table);
      return b === false ? false : a === null || b === null ? null : true;
    }
    case 'or': {
      const a = evalWhere(e.a, row, table);
      if (a === true) return true;
      const b = evalWhere(e.b, row, table);
      return b === true ? true : a === null || b === null ? null : false;
    }
    case 'not': {
      const n = evalWhere(e.e, row, table);
      return n === null ? null : !n;
    }
    case 'cmp': {
      const o = order(val(e.l), val(e.r), kindOf(e.l, e.r));
      if (o === null) return null;
      return e.op === '=' ? o === 0 : e.op === '<>' ? o !== 0 : e.op === '<' ? o < 0 : e.op === '>' ? o > 0 : e.op === '<=' ? o <= 0 : o >= 0;
    }
    case 'like': {
      const v = val(e.l);
      const pattern = val(e.r);
      return v === null || pattern === null ? null : flip(likeRegex(String(pattern), e.ci).test(String(v)), e.neg);
    }
    case 'isnull':
      return (val(e.l) === null) !== e.neg;
    case 'between': {
      const kind = kindOf(e.l, e.a);
      const lo = order(val(e.l), val(e.a), kind);
      const hi = order(val(e.l), val(e.b), kind);
      if (lo === null || hi === null) return null;
      return flip(lo >= 0 && hi <= 0, e.neg);
    }
    case 'in': {
      const kind = kindOf(e.l, e.l);
      let unknown = false;
      let found = false;
      for (const x of e.list) {
        const r = order(val(e.l), val(x), kind);
        if (r === null) unknown = true;
        else if (r === 0) found = true;
      }
      return found ? flip(true, e.neg) : unknown ? null : flip(false, e.neg);
    }
  }
}

/** The rows ordered by the keys of an ORDER BY, ties in the order they had; NULL last when ascending, first when descending, as PostgreSQL has it. */
function sorted(rows: Row[], keys: { name: string; kind: CellKind; desc: boolean }[]): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const key of keys) {
        const a = x.row[key.name] ?? null;
        const b = y.row[key.name] ?? null;
        let d: number;
        if (a === null || b === null) d = a === null && b === null ? 0 : a === null ? 1 : -1;
        else if (key.kind === 'number') d = Number(a) - Number(b);
        else {
          const s = String(a);
          const u = String(b);
          d = s < u ? -1 : s > u ? 1 : 0;
        }
        if (d) return key.desc ? -d : d;
      }
      return x.index - y.index;
    })
    .map((x) => x.row);
}

/**
 * Runs `sql` over `data`, the rows of every table by name, as PostgreSQL would answer it: the rows,
 * or the first thing wrong with the query and the line it is on.
 */
export function runQuery(sql: string, tables: readonly Table[], data: Readonly<Record<string, readonly Row[]>>): QueryResult {
  const parsed = parseQuery(sql);
  if (!parsed.ok) return parsed;
  const q = parsed.query;
  const checked = check(q, tables);
  if (!('table' in checked)) return queryFailure(checked.line, checked.message);
  const { table } = checked;

  const all = data[table.name] ?? [];
  let matched = q.where ? all.filter((r) => evalWhere(q.where!, r, table) === true) : all.slice();
  const removed = all.length - matched.length;
  if (q.order.length) {
    matched = sorted(
      matched,
      q.order.map((o) => {
        const c = table.columns.find((x) => x.name === (aliasOf(q, o.col) ?? o.col.name))!;
        return { name: c.name, kind: cellKind(c.type), desc: o.dir === 'DESC' };
      }),
    );
  }
  const from = q.offset ?? 0;
  const to = q.limit === null ? matched.length : from + q.limit;
  const cap = Math.min(to, from + QUERY_MAX_ROWS);
  const sources = matched.slice(from, cap);

  const refs: ColumnRef[] = q.cols ?? table.columns.map((c) => ({ t: 'col', name: c.name }));
  const columns = refs.map((ref) => {
    const column = table.columns.find((x) => x.name === ref.name)!;
    return ref.alias ? { ...column, name: ref.alias, pk: false, fk: null } : column;
  });
  const rows = sources.map((r) => Object.fromEntries(refs.map((ref, i) => [columns[i].name, r[ref.name] ?? null])) as Row);
  return { ok: true, table, columns, rows, sources, total: matched.length, shown: rows.length, capped: cap < to && cap < matched.length, removed, all: all.length, query: q, sql };
}

/**
 * The plan of a run, as lines of text: what is scanned, filtered, sorted and cut, with the rows each
 * step holds, in the way EXPLAIN writes it. Its words are the database's and are not translated.
 */
export function queryPlan(r: QueryRun, ms?: number): string[] {
  const q = r.query;
  const nodes: { text: string; details: string[] }[] = [];
  if (q.limit !== null || q.offset !== null) nodes.push({ text: t('query.plan.limit', { rows: formatNumber(r.shown) }), details: [] });
  if (q.order.length) {
    const keys = q.order.map((o) => o.col.name + (o.dir === 'DESC' ? ' DESC' : '')).join(', ');
    nodes.push({ text: t('query.plan.sort', { rows: formatNumber(r.total) }), details: [t('query.plan.sortKey', { keys })] });
  }
  const scan = { text: t('query.plan.scan', { table: q.table, rows: formatNumber(r.total) }), details: [] as string[] };
  if (q.where) {
    scan.details.push(t('query.plan.filter', { filter: exprSql(q.where) }));
    scan.details.push(t('query.plan.removed', { rows: formatNumber(r.removed) }));
  }
  nodes.push(scan);

  const lines: string[] = [];
  nodes.forEach((node, i) => {
    const prefix = i === 0 ? '' : `${' '.repeat(6 * (i - 1) + 2)}->  `;
    lines.push(prefix + node.text);
    for (const d of node.details) lines.push(' '.repeat(prefix.length + 2) + d);
  });
  if (ms !== undefined) lines.push(t('query.plan.time', { ms }));
  return lines;
}
