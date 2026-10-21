import { describe, expect, it } from 'vitest';
import { mysqlRowsSql, type RowsQuery } from './rows.ts';

const query = (changes: Partial<RowsQuery> = {}): RowsQuery => ({
  table: 'users',
  columns: ['id', 'email'],
  limit: 50,
  offset: 0,
  ...changes,
});

describe('mysqlRowsSql', () => {
  it('quotes the table and the columns and leaves the page as placeholders', () => {
    expect(mysqlRowsSql(query({ offset: 100 }))).toEqual({
      select: 'SELECT `id`, `email` FROM `users` LIMIT ? OFFSET ?',
      count: 'SELECT COUNT(*) AS total FROM `users`',
    });
    expect(mysqlRowsSql(query({ orderBy: { column: 'email', dir: 'desc' } }))).toEqual({
      select: 'SELECT `id`, `email` FROM `users` ORDER BY `email` DESC LIMIT ? OFFSET ?',
      count: 'SELECT COUNT(*) AS total FROM `users`',
    });
    expect(mysqlRowsSql(query({ orderBy: { column: 'id', dir: 'asc' } }))?.select).toContain('ORDER BY `id` ASC');
  });

  it('refuses a name, a limit or an order that is not a plain page of known columns', () => {
    expect(mysqlRowsSql(query({ table: 'users; DROP TABLE users' }))).toBeNull();
    expect(mysqlRowsSql(query({ table: 'user name' }))).toBeNull();
    expect(mysqlRowsSql(query({ columns: ['id', 'e mail'] }))).toBeNull();
    expect(mysqlRowsSql(query({ columns: [] }))).toBeNull();
    expect(mysqlRowsSql(query({ limit: 0 }))).toBeNull();
    expect(mysqlRowsSql(query({ limit: 201 }))).toBeNull();
    expect(mysqlRowsSql(query({ limit: 1.5 }))).toBeNull();
    expect(mysqlRowsSql(query({ offset: -1 }))).toBeNull();
    expect(mysqlRowsSql(query({ orderBy: { column: 'password', dir: 'asc' } }))).toBeNull();
    expect(mysqlRowsSql(query({ orderBy: { column: 'id', dir: 'asc; DROP TABLE users' as 'asc' } }))).toBeNull();
  });

  it('accepts a full page', () => {
    expect(mysqlRowsSql(query({ limit: 200, offset: 0 }))?.select).toContain('LIMIT ? OFFSET ?');
  });
});
