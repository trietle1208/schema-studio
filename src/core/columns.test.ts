import { describe, expect, it } from 'vitest';
import { addColumn, draftColumn, removeColumn, setColumn, setNullable, setPrimaryKey } from './columns';
import { ecommerceSnapshot, tableNamed } from './fixtures/testing';
import { validateColumns } from './validate';

const orders = () => tableNamed(ecommerceSnapshot(), 'orders');
const columnNames = (t: { columns: { name: string }[] }) => t.columns.map((c) => c.name);

describe('addColumn', () => {
  it('appends a blank, nullable TEXT draft that fails validation until it is named', () => {
    const before = orders();
    const after = addColumn(before);

    expect(after.columns).toHaveLength(6);
    expect(after.columns[5]).toEqual({ name: '', type: 'TEXT', nullable: true, draft: true });
    expect(after.columns.slice(0, 5)).toEqual(before.columns);
    expect(before.columns).toHaveLength(5);
    expect(validateColumns(after)).toEqual({ 5: 'Column name cannot be empty.' });
  });

  it('appends a given column and keeps the rest of the table', () => {
    const before = orders();
    const after = addColumn(before, { name: 'note', type: 'TEXT', nullable: true });
    expect(columnNames(after)).toEqual(['id', 'user_id', 'status', 'total', 'created_at', 'note']);
    expect(after.indexes).toBe(before.indexes);
    expect(after.comment).toBe(before.comment);
  });

  it('gives each draft its own object', () => {
    expect(draftColumn()).not.toBe(draftColumn());
  });
});

describe('setColumn', () => {
  it('replaces one column and keeps the identity of the others', () => {
    const before = orders();
    const status = { ...before.columns[2], name: 'state' };
    const after = setColumn(before, 2, status);

    expect(columnNames(after)).toEqual(['id', 'user_id', 'state', 'total', 'created_at']);
    expect(after.columns[2]).toBe(status);
    expect(after.columns[1]).toBe(before.columns[1]);
    expect(columnNames(before)).toEqual(['id', 'user_id', 'status', 'total', 'created_at']);
  });

  it('returns the same table when nothing would change', () => {
    const before = orders();
    expect(setColumn(before, 2, before.columns[2])).toBe(before);
    expect(setColumn(before, 9, before.columns[2])).toBe(before);
    expect(setColumn(before, -1, before.columns[2])).toBe(before);
  });
});

describe('removeColumn', () => {
  it('removes the column at the index', () => {
    const before = orders();
    const after = removeColumn(before, 1);
    expect(columnNames(after)).toEqual(['id', 'status', 'total', 'created_at']);
    expect(columnNames(before)).toHaveLength(5);
  });

  it('returns the same table for an index that does not exist', () => {
    const before = orders();
    expect(removeColumn(before, 5)).toBe(before);
    expect(removeColumn(before, -1)).toBe(before);
  });
});

describe('setPrimaryKey', () => {
  it('makes a nullable column NOT NULL when it becomes the primary key', () => {
    const name = tableNamed(ecommerceSnapshot(), 'users').columns[2];
    expect(name.nullable).toBe(true);
    expect(setPrimaryKey(name, true)).toEqual({ ...name, pk: true, nullable: false });
  });

  it('leaves the column NOT NULL when the key is removed', () => {
    const id = orders().columns[0];
    expect(setPrimaryKey(id, false)).toEqual({ ...id, pk: false, nullable: false });
  });
});

describe('setNullable', () => {
  it('toggles NOT NULL on an ordinary column', () => {
    const status = orders().columns[2];
    expect(setNullable(status, true)).toEqual({ ...status, nullable: true });
    expect(setNullable(setNullable(status, true), false)).toEqual(status);
  });

  it('does not make a primary key nullable', () => {
    const id = orders().columns[0];
    expect(setNullable(id, true)).toBe(id);
  });
});
