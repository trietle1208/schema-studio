import type { RecordValue, Row } from '.';

/** One condition on a column, as SQL writes it. The two NULL tests carry no `value`. */
export type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';

export interface RecordFilter {
  column: string;
  op: FilterOp;
  value?: RecordValue;
}

const FILTER_OPS: readonly FilterOp[] = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IS NULL', 'IS NOT NULL'];

export function filterOps(): readonly FilterOp[] {
  return FILTER_OPS;
}

function like(value: string, pattern: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
  return re.test(value);
}

/** Whether `row` passes every filter. NULL fails every comparison except the two NULL tests. */
export function rowMatches(row: Row, filters: readonly RecordFilter[]): boolean {
  return filters.every((f) => {
    const v = row[f.column] ?? null;
    if (f.op === 'IS NULL') return v === null;
    if (f.op === 'IS NOT NULL') return v !== null;
    if (v === null || f.value === undefined) return false;
    if (f.op === 'LIKE') return typeof v === 'string' && like(v, String(f.value));
    if (f.op === '=') return v === f.value;
    if (f.op === '!=') return v !== f.value;
    return f.op === '>' ? v > f.value! : f.op === '>=' ? v >= f.value! : f.op === '<' ? v < f.value! : v <= f.value!;
  });
}

/** The rows that pass every filter. An empty list keeps every row. */
export function filterRows(rows: readonly Row[], filters: readonly RecordFilter[]): Row[] {
  if (!filters.length) return rows.slice();
  return rows.filter((row) => rowMatches(row, filters));
}
