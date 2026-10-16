import { describe, expect, it } from 'vitest';
import { insertRow, removeRows, replaceRow, restoreRows } from './rows';
import type { Row } from '.';

const rows: Row[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

describe('row edits', () => {
  it('insert puts a row at the end, or at a position', () => {
    expect(insertRow(rows, { id: 5 }).map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(insertRow(rows, { id: 5 }, 1).map((r) => r.id)).toEqual([1, 5, 2, 3, 4]);
    expect(insertRow(rows, { id: 5 }, 99).map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(insertRow(rows, { id: 5 }, -3).map((r) => r.id)).toEqual([5, 1, 2, 3, 4]);
    expect(rows).toHaveLength(4);
  });

  it('replace changes one row and leaves the list it came from', () => {
    expect(replaceRow(rows, 2, { id: 30 }).map((r) => r.id)).toEqual([1, 2, 30, 4]);
    expect(replaceRow(rows, 9, { id: 30 })).toEqual(rows);
    expect(rows[2]).toEqual({ id: 3 });
  });

  it('remove takes rows out and says where they were', () => {
    const out = removeRows(rows, [3, 1]);
    expect(out.rows.map((r) => r.id)).toEqual([1, 3]);
    expect(out.removed).toEqual([{ index: 1, row: { id: 2 } }, { index: 3, row: { id: 4 } }]);
    expect(removeRows(rows, [])).toEqual({ rows, removed: [] });
    expect(removeRows(rows, [7]).removed).toEqual([]);
  });

  it('restore is the other way of remove, whichever rows went', () => {
    for (const indexes of [[0], [3], [1, 2], [0, 1, 2, 3], [0, 2], [1, 3]]) {
      const out = removeRows(rows, indexes);
      expect(restoreRows(out.rows, out.removed)).toEqual(rows);
    }
  });
});
