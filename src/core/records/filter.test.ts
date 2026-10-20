import { describe, expect, it } from 'vitest';
import { filterRows, type RecordFilter } from './filter';
import type { Row } from '.';

const rows: Row[] = [
  { id: 1, name: 'Ada', score: 10, note: null },
  { id: 2, name: 'Bob', score: 20, note: 'hi' },
  { id: 3, name: 'Cid', score: 15, note: null },
];

const ids = (list: Row[]) => list.map((r) => r.id);

describe('filterRows', () => {
  it('keeps every row when there are no filters', () => {
    expect(ids(filterRows(rows, []))).toEqual([1, 2, 3]);
  });

  it('matches equality and inequality', () => {
    expect(ids(filterRows(rows, [{ column: 'name', op: '=', value: 'Bob' }]))).toEqual([2]);
    expect(ids(filterRows(rows, [{ column: 'name', op: '!=', value: 'Bob' }]))).toEqual([1, 3]);
  });

  it('compares numbers and leaves NULL out of comparisons', () => {
    expect(ids(filterRows(rows, [{ column: 'score', op: '>', value: 15 }]))).toEqual([2]);
    expect(ids(filterRows(rows, [{ column: 'score', op: '<=', value: 15 }]))).toEqual([1, 3]);
  });

  it('handles LIKE and the NULL tests', () => {
    expect(ids(filterRows(rows, [{ column: 'name', op: 'LIKE', value: 'A%' }]))).toEqual([1]);
    expect(ids(filterRows(rows, [{ column: 'note', op: 'IS NULL' }]))).toEqual([1, 3]);
    expect(ids(filterRows(rows, [{ column: 'note', op: 'IS NOT NULL' }]))).toEqual([2]);
  });

  it('applies every filter together', () => {
    const filters: RecordFilter[] = [
      { column: 'score', op: '>=', value: 10 },
      { column: 'note', op: 'IS NULL' },
    ];
    expect(ids(filterRows(rows, filters))).toEqual([1, 3]);
  });
});
