// The SELECT the bridge builds for Query mode. The page sends the query it parsed, not SQL: every
// name is checked here and quoted, and every literal is a parameter. Anything else is refused.

import type { ColumnRef, Expr, Operand, OrderBy, Select } from '../src/core/records/query/ast.ts';
import { IDENTIFIER } from './rows.ts';

/** The most rows one query returns. One more is read when the query asks for more, to see that it was cut. */
export const QUERY_MAX_ROWS = 1000;

/** How many joins, selected columns and list items one query may have. */
const MAX_JOINS = 16;
const MAX_COLUMNS = 200;
const MAX_LIST = 200;
const MAX_DEPTH = 40;

export interface QueryTable {
  name: string;
  columns: string[];
}

const quote = (name: string) => `\`${name}\``;

function ident(name: string): string | null {
  return IDENTIFIER.test(name) ? quote(name) : null;
}

/** An output name: a column, or `table.column` when two tables share the bare name. */
function aliasSql(name: string): string | null {
  if (IDENTIFIER.test(name)) return quote(name);
  const parts = name.split('.');
  return parts.length === 2 && parts.every((part) => IDENTIFIER.test(part)) ? quote(name) : null;
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CMP = new Set(['=', '<>', '<', '>', '<=', '>=']);

function colOf(value: unknown, alias: boolean): ColumnRef | null {
  if (!isObj(value) || value.t !== 'col' || typeof value.name !== 'string') return null;
  if (value.qual !== undefined && typeof value.qual !== 'string') return null;
  if (alias && value.alias !== undefined && typeof value.alias !== 'string') return null;
  return {
    t: 'col',
    name: value.name,
    ...(typeof value.qual === 'string' ? { qual: value.qual } : {}),
    ...(alias && typeof value.alias === 'string' ? { alias: value.alias } : {}),
  };
}

function operandOf(value: unknown): Operand | null {
  if (!isObj(value)) return null;
  if (value.t === 'col') return colOf(value, false);
  if (value.t !== 'lit') return null;
  if (value.kind === 'null') return { t: 'lit', kind: 'null', v: null };
  if (value.kind === 'bool' && typeof value.v === 'boolean') return { t: 'lit', kind: 'bool', v: value.v };
  if (value.kind === 'num' && typeof value.v === 'number' && Number.isFinite(value.v)) return { t: 'lit', kind: 'num', v: value.v };
  if (value.kind === 'str' && typeof value.v === 'string' && value.v.length <= 10_000) return { t: 'lit', kind: 'str', v: value.v };
  return null;
}

function exprOf(value: unknown, depth: number): Expr | null {
  if (depth > MAX_DEPTH || !isObj(value) || typeof value.t !== 'string') return null;
  if (value.t === 'and' || value.t === 'or') {
    const a = exprOf(value.a, depth + 1);
    const b = exprOf(value.b, depth + 1);
    return a && b ? { t: value.t, a, b } : null;
  }
  if (value.t === 'not') {
    const e = exprOf(value.e, depth + 1);
    return e ? { t: 'not', e } : null;
  }
  if (value.t === 'cmp' && typeof value.op === 'string' && CMP.has(value.op)) {
    const l = operandOf(value.l);
    const r = operandOf(value.r);
    return l && r ? { t: 'cmp', op: value.op as '=' | '<>' | '<' | '>' | '<=' | '>=', l, r } : null;
  }
  if (value.t === 'like' && typeof value.ci === 'boolean' && typeof value.neg === 'boolean') {
    const l = operandOf(value.l);
    const r = operandOf(value.r);
    return l && r ? { t: 'like', ci: value.ci, neg: value.neg, l, r } : null;
  }
  if (value.t === 'isnull' && typeof value.neg === 'boolean') {
    const l = operandOf(value.l);
    return l ? { t: 'isnull', neg: value.neg, l } : null;
  }
  if (value.t === 'between' && typeof value.neg === 'boolean') {
    const l = operandOf(value.l);
    const a = operandOf(value.a);
    const b = operandOf(value.b);
    return l && a && b ? { t: 'between', neg: value.neg, l, a, b } : null;
  }
  if (value.t === 'in' && typeof value.neg === 'boolean' && Array.isArray(value.list) && value.list.length <= MAX_LIST) {
    const l = operandOf(value.l);
    if (!l) return null;
    const list: Operand[] = [];
    for (const item of value.list) {
      const operand = operandOf(item);
      if (!operand) return null;
      list.push(operand);
    }
    return list.length ? { t: 'in', neg: value.neg, l, list } : null;
  }
  return null;
}

function countOf(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : Number.NaN;
}

/** The query a request describes, with only the fields the bridge reads, or null when it does not. */
export function selectOf(value: unknown): Select | null {
  if (!isObj(value) || typeof value.table !== 'string') return null;
  if (value.alias !== undefined && typeof value.alias !== 'string') return null;
  if (value.schema !== undefined && value.schema !== null && typeof value.schema !== 'string') return null;
  let cols: ColumnRef[] | null = null;
  if (value.cols !== null && value.cols !== undefined) {
    if (!Array.isArray(value.cols) || value.cols.length === 0 || value.cols.length > MAX_COLUMNS) return null;
    cols = [];
    for (const item of value.cols) {
      const col = colOf(item, true);
      if (!col) return null;
      cols.push(col);
    }
  }
  const joins: Select['joins'] = [];
  if (value.joins !== undefined) {
    if (!Array.isArray(value.joins) || value.joins.length > MAX_JOINS) return null;
    for (const item of value.joins) {
      if (!isObj(item) || (item.type !== 'INNER' && item.type !== 'LEFT') || typeof item.table !== 'string') return null;
      if (item.alias !== undefined && typeof item.alias !== 'string') return null;
      if (item.schema !== undefined && item.schema !== null && typeof item.schema !== 'string') return null;
      const on = exprOf(item.on, 0);
      if (!on) return null;
      joins.push({
        type: item.type,
        table: item.table,
        ...(typeof item.alias === 'string' ? { alias: item.alias } : {}),
        ...(typeof item.schema === 'string' ? { schema: item.schema } : {}),
        on,
      });
    }
  }
  const where = value.where == null ? null : exprOf(value.where, 0);
  if (value.where != null && !where) return null;
  if (!Array.isArray(value.order)) return null;
  const order: OrderBy[] = [];
  for (const item of value.order) {
    if (!isObj(item) || (item.dir !== 'ASC' && item.dir !== 'DESC')) return null;
    const col = colOf(item.col, false);
    if (!col) return null;
    order.push({ col, dir: item.dir });
  }
  const limit = countOf(value.limit);
  const offset = countOf(value.offset);
  if (Number.isNaN(limit) || Number.isNaN(offset)) return null;
  return {
    cols,
    table: value.table,
    ...(typeof value.alias === 'string' ? { alias: value.alias } : {}),
    ...(typeof value.schema === 'string' ? { schema: value.schema } : {}),
    ...(joins.length ? { joins } : {}),
    where,
    order,
    limit,
    offset,
  };
}

export function tablesOf(value: unknown): QueryTable[] | null {
  if (!Array.isArray(value)) return null;
  const tables: QueryTable[] = [];
  for (const item of value) {
    if (!isObj(item) || typeof item.name !== 'string' || !Array.isArray(item.columns) || item.columns.length > MAX_COLUMNS) return null;
    if (!item.columns.every((column) => typeof column === 'string')) return null;
    tables.push({ name: item.name, columns: item.columns as string[] });
  }
  return tables;
}

interface Piece {
  sql: string;
  params: unknown[];
}

function colSql(ref: ColumnRef): string | null {
  const name = ident(ref.name);
  if (!name) return null;
  if (!ref.qual) return name;
  const qual = ident(ref.qual);
  return qual ? `${qual}.${name}` : null;
}

function operand(o: Operand): Piece | null {
  if (o.t === 'col') {
    const sql = colSql(o);
    return sql ? { sql, params: [] } : null;
  }
  if (o.kind === 'null') return { sql: 'NULL', params: [] };
  if (o.kind === 'bool') return { sql: o.v ? 'TRUE' : 'FALSE', params: [] };
  return { sql: '?', params: [o.v] };
}

function exprPiece(e: Expr): Piece | null {
  switch (e.t) {
    case 'and':
    case 'or': {
      const a = exprPiece(e.a);
      const b = exprPiece(e.b);
      if (!a || !b) return null;
      return { sql: `(${a.sql} ${e.t === 'and' ? 'AND' : 'OR'} ${b.sql})`, params: [...a.params, ...b.params] };
    }
    case 'not': {
      const inner = exprPiece(e.e);
      return inner ? { sql: `(NOT ${inner.sql})`, params: inner.params } : null;
    }
    case 'cmp': {
      const l = operand(e.l);
      const r = operand(e.r);
      if (!l || !r) return null;
      return { sql: `${l.sql} ${e.op} ${r.sql}`, params: [...l.params, ...r.params] };
    }
    case 'like': {
      const l = operand(e.l);
      const r = operand(e.r);
      if (!l || !r) return null;
      // LIKE follows the column's collation, which is case-insensitive for the usual MySQL charsets.
      // LIKE BINARY keeps the case, which is what a plain LIKE means here.
      return { sql: `${l.sql}${e.neg ? ' NOT' : ''} ${e.ci ? 'LIKE' : 'LIKE BINARY'} ${r.sql}`, params: [...l.params, ...r.params] };
    }
    case 'isnull': {
      const l = operand(e.l);
      return l ? { sql: `${l.sql} IS ${e.neg ? 'NOT ' : ''}NULL`, params: l.params } : null;
    }
    case 'between': {
      const l = operand(e.l);
      const a = operand(e.a);
      const b = operand(e.b);
      if (!l || !a || !b) return null;
      return { sql: `${l.sql}${e.neg ? ' NOT' : ''} BETWEEN ${a.sql} AND ${b.sql}`, params: [...l.params, ...a.params, ...b.params] };
    }
    case 'in': {
      const l = operand(e.l);
      if (!l) return null;
      const items: Piece[] = [];
      for (const item of e.list) {
        const piece = operand(item);
        if (!piece) return null;
        items.push(piece);
      }
      return { sql: `${l.sql}${e.neg ? ' NOT' : ''} IN (${items.map((item) => item.sql).join(', ')})`, params: [...l.params, ...items.flatMap((item) => item.params)] };
    }
  }
}

function tableSql(name: string, schema?: string | null, alias?: string): string | null {
  const table = ident(name);
  if (!table) return null;
  if (schema && !ident(schema)) return null;
  const as = alias ? ident(alias) : '';
  if (alias && !as) return null;
  return `${schema ? `${ident(schema)}.${table}` : table}${as ? ` AS ${as}` : ''}`;
}

interface Listed {
  sql: string;
  preferred: string;
  fallback: string;
}

function listSql(items: Listed[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.preferred, (counts.get(item.preferred) ?? 0) + 1);
  const used = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    let name = (counts.get(item.preferred) ?? 0) > 1 ? item.fallback : item.preferred;
    if (used.has(name)) {
      name = item.fallback;
      let n = 2;
      while (used.has(name)) name = `${item.fallback}_${n++}`;
    }
    used.add(name);
    const as = aliasSql(name);
    if (!as) return null;
    out.push(`${item.sql} AS ${as}`);
  }
  return out.join(', ');
}

/**
 * The statement that runs `query`, or null when a name is not one the bridge will quote.
 * `tables` expands `*`. The limit and the offset stay as they are: the caller caps the limit.
 */
export function mysqlSelectSql(query: Select, tables: readonly QueryTable[]): { sql: string; params: unknown[] } | null {
  const from = tableSql(query.table, query.schema, query.alias);
  if (!from) return null;
  const params: unknown[] = [];
  const joins: string[] = [];
  for (const join of query.joins ?? []) {
    const table = tableSql(join.table, join.schema, join.alias);
    const on = exprPiece(join.on);
    if (!table || !on) return null;
    joins.push(`${join.type === 'LEFT' ? 'LEFT JOIN' : 'INNER JOIN'} ${table} ON ${on.sql}`);
    params.push(...on.params);
  }
  let listed: Listed[];
  if (query.cols) {
    listed = [];
    for (const col of query.cols) {
      const sql = colSql(col);
      if (!sql) return null;
      const qual = col.qual ?? '';
      listed.push({ sql, preferred: col.alias ?? col.name, fallback: qual ? `${qual}.${col.name}` : col.name });
    }
  } else {
    const sources = [{ name: query.table, alias: query.alias }, ...(query.joins ?? []).map((join) => ({ name: join.table, alias: join.alias }))];
    listed = [];
    for (const source of sources) {
      const table = tables.find((item) => item.name === source.name);
      const qual = source.alias ?? source.name;
      const q = ident(qual);
      if (!table || !q) return null;
      for (const column of table.columns) {
        const c = ident(column);
        if (!c) return null;
        listed.push({ sql: `${q}.${c}`, preferred: column, fallback: `${qual}.${column}` });
      }
    }
  }
  if (!listed.length || listed.length > MAX_COLUMNS) return null;
  const columns = listSql(listed);
  if (!columns) return null;
  let where = '';
  if (query.where) {
    const piece = exprPiece(query.where);
    if (!piece) return null;
    where = ` WHERE ${piece.sql}`;
    params.push(...piece.params);
  }
  let order = '';
  if (query.order.length) {
    const keys: string[] = [];
    for (const item of query.order) {
      const sql = colSql(item.col);
      if (!sql || (item.dir !== 'ASC' && item.dir !== 'DESC')) return null;
      keys.push(`${sql} ${item.dir}`);
    }
    order = ` ORDER BY ${keys.join(', ')}`;
  }
  const limit = query.limit === null ? '' : ' LIMIT ?';
  const offset = query.offset === null ? '' : ' OFFSET ?';
  if (query.limit !== null) params.push(query.limit);
  if (query.offset !== null) params.push(query.offset);
  return { sql: `SELECT ${columns} FROM ${from}${joins.length ? ` ${joins.join(' ')}` : ''}${where}${order}${limit}${offset}`, params };
}

/** The same query with the row cap applied. `probe` reads one extra row so a cut can be told from an exact count. */
export function boundedSelect(query: Select): { query: Select; probe: boolean } {
  if (query.limit !== null && query.limit <= QUERY_MAX_ROWS) return { query, probe: false };
  return { query: { ...query, limit: QUERY_MAX_ROWS + 1 }, probe: true };
}
