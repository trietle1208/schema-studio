import { t } from '../../i18n';
import type { Column, Table } from '../../model';
import { cellKind } from '../cells';
import { MOMENTS, momentKind, type Moment } from '../fields';
import type { Expr, Literal, Select } from './ast';
import { printQuery } from './print';

// The Builder: a filter written by choosing instead of typing. `QuerySpec` is what the Builder
// holds; `buildQuery` writes it as SQL, which is what runs.

export type QueryOp = 'eq' | 'ne' | 'gt' | 'lt' | 'before' | 'after' | 'between' | 'contains' | 'starts' | 'null' | 'notnull';

/** One condition, with what was typed in it as text. */
export interface QueryCondition {
  column: string;
  op: QueryOp;
  value: string;
  value2: string;
}

/** A group of conditions that are all to match (`AND`) or any of them (`OR`). Groups nest. */
export interface QueryGroup {
  op: 'AND' | 'OR';
  items: (QueryCondition | QueryGroup)[];
}

export interface QuerySort {
  column: string;
  dir: 'asc' | 'desc';
}

export interface QuerySpec {
  table: string;
  where: QueryGroup;
  /** The columns to select; null for all of them. */
  columns: string[] | null;
  sort: QuerySort | null;
  /** The rows to stop at; null for no limit. */
  limit: number | null;
}

/** A condition problem and where the condition is: the index in each group, from the top. */
export interface QueryProblem {
  path: number[];
  message: string;
}

/** The limits the Builder offers; the one a query has that is not among them is added to the list. */
export const QUERY_LIMITS: readonly number[] = [10, 25, 50, 100, 500, 1000];
export const DEFAULT_QUERY_LIMIT = 100;

export function isGroup(item: QueryCondition | QueryGroup): item is QueryGroup {
  return 'items' in item;
}

/** An empty query over `table`: every row, the first 100. */
export function defaultQuery(table: Pick<Table, 'name'>): QuerySpec {
  return { table: table.name, where: { op: 'AND', items: [] }, columns: null, sort: null, limit: DEFAULT_QUERY_LIMIT };
}

// ------------------------------------------------------------------------------------- operators

export interface OperatorOption {
  value: QueryOp;
  label: string;
}

const NULL_OPS = (): OperatorOption[] => [
  { value: 'null', label: 'IS NULL' },
  { value: 'notnull', label: 'IS NOT NULL' },
];

/** The operators of a condition by what the column holds. The labels are built when asked for, in the language of the app. */
export function queryOps(column: Pick<Column, 'type'>): OperatorOption[] {
  switch (cellKind(column.type)) {
    case 'number':
      return [{ value: 'eq', label: '=' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }, { value: 'between', label: t('query.op.between') }, ...NULL_OPS()];
    case 'time':
      return [
        { value: 'before', label: t('query.op.before') },
        { value: 'after', label: t('query.op.after') },
        { value: 'between', label: t('query.op.between') },
        ...NULL_OPS(),
      ];
    case 'boolean':
      return [{ value: 'eq', label: '=' }, ...NULL_OPS()];
    default:
      return [
        { value: 'eq', label: '=' },
        { value: 'ne', label: '≠' },
        { value: 'contains', label: t('query.op.contains') },
        { value: 'starts', label: t('query.op.startsWith') },
        ...NULL_OPS(),
      ];
  }
}

/** `IS NULL` and `IS NOT NULL` take no value. */
export function isBare(op: QueryOp): boolean {
  return op === 'null' || op === 'notnull';
}

/** A new condition, on the first column of the table. */
export function newCondition(table: Pick<Table, 'columns'>): QueryCondition {
  const column = table.columns[0];
  return { column: column.name, op: queryOps(column)[0].value, value: cellKind(column.type) === 'boolean' ? 'true' : '', value2: '' };
}

/** The condition after its column changed: the operator and the value stay when the new column can keep them. */
export function withColumn(condition: QueryCondition, from: Pick<Column, 'type'>, to: Column): QueryCondition {
  const kind = cellKind(from.type);
  const next = cellKind(to.type);
  const ops = queryOps(to);
  return {
    column: to.name,
    op: ops.some((o) => o.value === condition.op) ? condition.op : ops[0].value,
    value: next === kind ? condition.value : next === 'boolean' ? 'true' : '',
    value2: next === kind ? condition.value2 : '',
  };
}

// ------------------------------------------------------------------------------------- problems

/** A date, with a time of day if it likes: `2026-03-01`, `2026-03-01 08:30`, `2026-03-01 08:30:12`. */
export const QUERY_DATE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function realDate(m: RegExpExecArray): boolean {
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    (m[4] === undefined || (Number(m[4]) < 24 && Number(m[5]) < 60 && (m[6] === undefined || Number(m[6]) < 60)))
  );
}

/** A moment typed for a query: a date, with a time of day if it likes, or a time. */
export function validQueryMoment(kind: Moment, text: string): boolean {
  if (kind === 'time') {
    const m = MOMENTS.time.re.exec(text);
    return !!m && Number(m[1]) < 24 && Number(m[2]) < 60 && Number(m[3]) < 60;
  }
  const m = (kind === 'date' ? MOMENTS.date.re : QUERY_DATE).exec(text);
  return !!m && realDate(m);
}

/** What is wrong with one value typed for a column, or null. */
export function valueProblem(column: Column, text: string): string | null {
  const kind = cellKind(column.type);
  const v = text.trim();
  if (kind === 'boolean') return null;
  if (v === '') return t('query.problem.empty');
  if (kind === 'number') return Number.isNaN(Number(v)) ? t('query.problem.number') : null;
  if (kind === 'time') {
    const moment = momentKind(column.type);
    return validQueryMoment(moment, v) ? null : t(moment === 'date' ? 'query.problem.date' : moment === 'time' ? 'query.problem.time' : 'query.problem.timestamp');
  }
  return null;
}

/** The hint in the empty box of a value. */
export function valueHint(column: Column): string {
  const kind = cellKind(column.type);
  if (kind === 'time') {
    const moment = momentKind(column.type);
    return moment === 'timestamp' ? MOMENTS.date.text : MOMENTS[moment].text;
  }
  return kind === 'number' ? t('query.hint.number') : t('query.hint.value');
}

function conditionProblem(c: QueryCondition, table: Pick<Table, 'columns'>): string | null {
  const column = table.columns.find((x) => x.name === c.column);
  if (!column) return t('query.problem.noColumn');
  if (isBare(c.op)) return null;
  return valueProblem(column, c.value) ?? (c.op === 'between' ? valueProblem(column, c.value2) : null);
}

/** The conditions that cannot be written yet, with where each is. */
export function queryProblems(spec: QuerySpec, table: Pick<Table, 'columns'>): QueryProblem[] {
  const out: QueryProblem[] = [];
  const walk = (group: QueryGroup, path: number[]) =>
    group.items.forEach((item, i) => {
      if (isGroup(item)) walk(item, [...path, i]);
      else {
        const message = conditionProblem(item, table);
        if (message) out.push({ path: [...path, i], message });
      }
    });
  walk(spec.where, []);
  return out;
}

// ------------------------------------------------------------------------------------- writing

function literalOf(text: string, kind: ReturnType<typeof cellKind>): Literal {
  const v = text.trim();
  if (kind === 'number') return { t: 'lit', kind: 'num', v: Number(v) };
  if (kind === 'boolean') return { t: 'lit', kind: 'bool', v: text !== 'false' };
  return { t: 'lit', kind: 'str', v: kind === 'time' ? v : text };
}

/** A text as the pattern of a `LIKE`: its own `%`, `_` and `\` are plain characters. */
function likeText(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

function conditionExpr(c: QueryCondition, table: Pick<Table, 'columns'>): Expr | null {
  const column = table.columns.find((x) => x.name === c.column);
  if (!column || conditionProblem(c, table)) return null;
  const kind = cellKind(column.type);
  const ref = { t: 'col', name: column.name } as const;
  const cmp = (op: '=' | '<>' | '<' | '>', v: string): Expr => ({ t: 'cmp', op, l: ref, r: literalOf(v, kind) });
  const like = (pattern: string): Expr => ({ t: 'like', ci: true, neg: false, l: ref, r: { t: 'lit', kind: 'str', v: pattern } });
  switch (c.op) {
    case 'null':
      return { t: 'isnull', neg: false, l: ref };
    case 'notnull':
      return { t: 'isnull', neg: true, l: ref };
    case 'eq':
      return cmp('=', c.value);
    case 'ne':
      return cmp('<>', c.value);
    case 'gt':
    case 'after':
      return cmp('>', c.value);
    case 'lt':
    case 'before':
      return cmp('<', c.value);
    case 'contains':
      return like(`%${likeText(c.value)}%`);
    case 'starts':
      return like(`${likeText(c.value)}%`);
    case 'between':
      return { t: 'between', neg: false, l: ref, a: literalOf(c.value, kind), b: literalOf(c.value2, kind) };
  }
}

function groupExpr(group: QueryGroup, table: Pick<Table, 'columns'>): Expr | null {
  const nodes = group.items.map((item) => (isGroup(item) ? groupExpr(item, table) : conditionExpr(item, table))).filter((e): e is Expr => e !== null);
  const t = group.op === 'OR' ? 'or' : 'and';
  return nodes.length ? nodes.reduce((a, b) => ({ t, a, b })) : null;
}

/** What the Builder holds as the query it stands for. A condition that is not complete is left out. */
export function specQuery(spec: QuerySpec, table: Pick<Table, 'columns'>): Select {
  const some = spec.columns && spec.columns.length > 0 && spec.columns.length < table.columns.length;
  return {
    table: spec.table,
    cols: some ? spec.columns!.map((name) => ({ t: 'col', name })) : null,
    where: groupExpr(spec.where, table),
    order: spec.sort ? [{ col: { t: 'col', name: spec.sort.column }, dir: spec.sort.dir === 'desc' ? 'DESC' : 'ASC' }] : [],
    limit: spec.limit,
    offset: null,
  };
}

/** The SQL the Builder writes. Conditions that are not complete are not in it (see `queryProblems`). */
export function buildQuery(spec: QuerySpec, table: Pick<Table, 'columns'>): string {
  return printQuery(specQuery(spec, table));
}

// ------------------------------------------------------------------------------------- editing

/** The group at the end of `path` changed by `fn`, the rest as it was. */
export function mapAt(group: QueryGroup, path: readonly number[], fn: (group: QueryGroup) => QueryGroup): QueryGroup {
  if (!path.length) return fn(group);
  const [first, ...rest] = path;
  return { ...group, items: group.items.map((item, k) => (k === first && isGroup(item) ? mapAt(item, rest, fn) : item)) };
}

/** The condition or group at the end of `path` taken out. */
export function removeAt(group: QueryGroup, path: readonly number[]): QueryGroup {
  const last = path[path.length - 1];
  return mapAt(group, path.slice(0, -1), (g) => ({ ...g, items: g.items.filter((_, k) => k !== last) }));
}

/** How many conditions there are, groups not counted. */
export function countConditions(group: QueryGroup): number {
  return group.items.reduce((n, item) => n + (isGroup(item) ? countConditions(item) : 1), 0);
}
